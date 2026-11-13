import { appVersionFromUserAgent, type PluginLogger } from "../sdk/index.ts";
import { APP_NAME } from "./brand.ts";
import { BridgeRequestError, type BridgeClient } from "./bridge-client.ts";
import type { Clock } from "./clock.ts";
import { describeError } from "./logger.ts";

export const STALE_RELOADS_KEY = "bgb:stale-build-reloads";
export const STALE_SPLASH_ID = "bgb-stale-splash";
export const MAX_STALE_RELOADS = 30;
export const STALE_RELOAD_DELAY_MS = 500;
/** How long the halted page waits for the agent before falling back to plain reloads. */
export const STALE_CONNECT_MS = 2_000;
/** How long it waits for a build of the running app version once the agent is asked for one. */
export const STALE_REBUILD_WAIT_MS = 120_000;

const SPLASH_CSS =
	"html,body{margin:0;height:100%;background:#161616;color:#ececec;font:14px/1.45 -apple-system,BlinkMacSystemFont,sans-serif}" +
	`#${STALE_SPLASH_ID}{box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;min-height:100%;padding:48px 56px}` +
	`#${STALE_SPLASH_ID} p{margin:0}` +
	`#${STALE_SPLASH_ID} .bgb-stale-splash__brand{opacity:.55;margin-bottom:12px}` +
	`#${STALE_SPLASH_ID} .bgb-stale-splash__title{font-size:20px;font-weight:500;margin-bottom:8px}` +
	`#${STALE_SPLASH_ID} .bgb-stale-splash__hint{opacity:.55}` +
	`#${STALE_SPLASH_ID} .bgb-stale-splash__bar{width:168px;height:2px;margin-top:24px;overflow:hidden;border-radius:1px;background:#ffffff14}` +
	`#${STALE_SPLASH_ID} .bgb-stale-splash__bar>i{display:block;height:100%;width:40%;background:#0a84ff;animation:bgb-stale-slide 1.1s ease-in-out infinite}` +
	"@keyframes bgb-stale-slide{0%{transform:translateX(-120%)}100%{transform:translateX(350%)}}";

export type StaleBridge = Pick<BridgeClient, "state" | "start" | "stop" | "subscribe" | "on" | "request">;

export interface StaleGuardOptions {
	buildAppVersion: string;
	userAgent: string;
	session: Storage | undefined;
	/** `window.stop()`: keeps the app's scripts of the wrong version from loading. */
	stop(): void;
	reload(): void;
	clock: Clock;
	/** A bridge client for this build, or null when it has none. */
	openBridge(): StaleBridge | null;
	log: PluginLogger;
	/** Halt runs in `<head>`: without this the stopped parser never creates `body`, so the window stays blank. */
	document?: Document;
}

/**
 * Fills the halted page so a Grok Bot update is not a blank window for the length of the rebuild
 * (`window.stop()` in `<head>` otherwise prevents `body` from parsing).
 */
export function paintStaleSplash(doc: Document, running: string): void {
	if (doc.getElementById(STALE_SPLASH_ID) !== null) return;
	let body = doc.body;
	if (body === null) {
		body = doc.createElement("body");
		doc.documentElement.append(body);
	}
	const style = doc.createElement("style");
	style.textContent = SPLASH_CSS;
	const root = doc.createElement("div");
	root.id = STALE_SPLASH_ID;
	root.setAttribute("role", "status");
	const brand = doc.createElement("p");
	brand.className = "bgb-stale-splash__brand";
	brand.textContent = APP_NAME;
	const title = doc.createElement("p");
	title.className = "bgb-stale-splash__title";
	title.textContent = `Updating the interface for Grok Bot ${running}`;
	const hint = doc.createElement("p");
	hint.className = "bgb-stale-splash__hint";
	hint.textContent = "After an app update this can take about a minute.";
	const bar = doc.createElement("div");
	bar.className = "bgb-stale-splash__bar";
	bar.setAttribute("aria-hidden", "true");
	bar.append(doc.createElement("i"));
	root.append(brand, title, hint, bar);
	body.append(style, root);
}

/**
 * Grok Bot loads `current`, which right after an app update may still be the previous
 * version's build. Electron's default user agent names the running app version just before
 * ` Chrome/`; when it positively differs from the build's, stop the page before the app's
 * scripts load, ask the agent for a build of the running version and reload once it finishes.
 * Without an agent, reload every 500 ms up to 30 times, then load the stale build anyway.
 * Returns true when it halted this page load.
 */
export function haltIfStaleBuild(options: StaleGuardOptions): boolean {
	const { buildAppVersion, session, log } = options;
	const running = appVersionFromUserAgent(options.userAgent);
	let attempts = 0;
	try {
		if (running === undefined || !/^\d+\.\d+\.\d+/.test(buildAppVersion) || running === buildAppVersion) {
			session?.removeItem(STALE_RELOADS_KEY);
			return false;
		}
		// No sessionStorage: never risk an endless reload loop.
		if (session === undefined) return false;
		attempts = Number(session.getItem(STALE_RELOADS_KEY) ?? "0");
		if (!Number.isInteger(attempts) || attempts < 0) attempts = 0;
		if (attempts >= MAX_STALE_RELOADS) {
			session.removeItem(STALE_RELOADS_KEY);
			log.error(
				`this build is for Grok Bot ${buildAppVersion} but ${running} is running; no fresh build appeared, loading it anyway. Run \`bgb build\` in a terminal.`,
			);
			return false;
		}
		session.setItem(STALE_RELOADS_KEY, String(attempts + 1));
	} catch {
		return false;
	}
	if (attempts === 0) log.warn(`this build is for Grok Bot ${buildAppVersion} but ${running} is running; waiting for the rebuild`);
	if (options.document !== undefined) paintStaleSplash(options.document, running);
	options.stop();
	waitForRebuild(options, running);
	return true;
}

function waitForRebuild(options: StaleGuardOptions, running: string): void {
	const { clock, log } = options;
	const bridge = options.openBridge();
	const cleanups: (() => void)[] = [];
	let done = false;

	/** `fresh`: a build of the running version is published, so the reload gets it right away. */
	const finish = (fresh: boolean): void => {
		if (done) return;
		done = true;
		for (const cleanup of cleanups) cleanup();
		bridge?.stop();
		if (fresh) options.reload();
		else clock.setTimeout(() => options.reload(), STALE_RELOAD_DELAY_MS);
	};

	if (bridge === null) {
		finish(false);
		return;
	}

	const connectTimer = clock.setTimeout(() => finish(false), STALE_CONNECT_MS);
	cleanups.push(() => clock.clearTimeout(connectTimer));
	let asked = false;

	const askForRebuild = (): void => {
		asked = true;
		clock.clearTimeout(connectTimer);
		// Listen before asking: the build may finish (or already be running) before the reply arrives.
		cleanups.push(
			bridge.on("build.finished", (finished) => {
				if (finished.appVersion === running) finish(finished.ok);
			}),
		);
		const waitTimer = clock.setTimeout(() => finish(false), STALE_REBUILD_WAIT_MS);
		cleanups.push(() => clock.clearTimeout(waitTimer));
		bridge.request("build.rebuild", {}).catch((error: unknown) => {
			if (error instanceof BridgeRequestError && error.code === "conflict") return;
			log.warn(`could not ask the background agent for a rebuild: ${describeError(error)}`);
			finish(false);
		});
	};

	cleanups.push(
		bridge.subscribe((state) => {
			if (state === "connected" && !asked) askForRebuild();
			else if (state === "disconnected" && asked) finish(false);
		}),
	);
	bridge.start();
}
