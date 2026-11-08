// The app resolver loads per command (literal specifier, so the compiled binary bundles it).
import { RENDERER_URL_ENV } from "../../sdk/index.ts";
import { readLiveAgent, waitForAgent } from "../agent-record.ts";
import { readConfig } from "../config.ts";
import type { CoreContext } from "../context.ts";
import { errorMessage } from "../errors.ts";
import { rendererUrl } from "../paths.ts";
import { readState } from "../state.ts";
import { parseArgs } from "./args.ts";
import { type CommandEnv, installedBinary } from "./env.ts";

async function launchctlGetenv(name: string): Promise<string> {
	const proc = Bun.spawn(["launchctl", "getenv", name], { stdout: "pipe", stderr: "ignore" });
	const text = await new Response(proc.stdout).text();
	await proc.exited;
	return text.trim();
}

/** macOS: export the renderer URL ourselves. Do not wait for `bgb agent` — it can take minutes to boot. */
async function exportLaunchdHook(ctx: CoreContext, url: string): Promise<void> {
	const current = await launchctlGetenv(RENDERER_URL_ENV);
	if (current !== "" && current !== url) {
		throw new Error(`${RENDERER_URL_ENV} is set to ${current} by something else`);
	}
	if (current !== url) {
		const proc = Bun.spawn(["launchctl", "setenv", RENDERER_URL_ENV, url], { stdout: "ignore", stderr: "pipe" });
		const stderr = await new Response(proc.stderr).text();
		if ((await proc.exited) !== 0) throw new Error(`launchctl setenv failed: ${stderr.trim()}`);
	}
	ctx.log.info(`login: ${RENDERER_URL_ENV} is exported`);
}

/**
 * `bgb login`, run once per login session by the autostart artifacts only: make sure the agent (and on
 * macOS the hook) is up, then open Grok Bot when `openAtLogin` is set and it isn't running yet.
 */
export async function runLogin(env: CommandEnv, argv: readonly string[]): Promise<number> {
	parseArgs(argv, { usage: "bgb login" });
	const ctx = await env.context();
	const config = await readConfig(ctx.paths);
	const url = rendererUrl(ctx.paths);
	let failed = false;
	try {
		if (ctx.platform.id === "darwin") {
			if ((await readState(ctx.paths)).hook) await exportLaunchdHook(ctx, url);
		} else {
			if (!(await readLiveAgent(ctx.paths))) await ctx.platform.startAgent(installedBinary(ctx), ctx.paths);
			await waitForAgent(ctx.paths, config.bridgePort, { timeoutMs: 60_000 });
		}
	} catch (error) {
		// Grok Bot still opens; its Settings section reports the missing agent.
		ctx.log.error(`login: ${errorMessage(error)}`);
		failed = true;
	}
	if (config.openAtLogin) {
		try {
			const { resolveApp } = await import("../app/resolve.ts");
			const app = await resolveApp(ctx, config.appPath);
			if (await ctx.platform.findRunningApp(app)) {
				ctx.log.info("login: Grok Bot is already running");
			} else {
				await ctx.platform.launchApp(app, { [RENDERER_URL_ENV]: url }, []);
				ctx.log.info(`login: opened Grok Bot ${app.version}`);
			}
		} catch (error) {
			ctx.log.error(`login: cannot open Grok Bot: ${errorMessage(error)}`);
			failed = true;
		}
	}
	return failed ? 1 : 0;
}
