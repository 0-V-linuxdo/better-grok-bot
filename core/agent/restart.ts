import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import * as path from "node:path";
import type { CoreContext } from "../context.ts";
import { errorMessage } from "../errors.ts";
import type { Logger } from "../log.ts";
import { BGB_COMPILED } from "../version.ts";

/** launchd label of the agent job. */
export const AGENT_LABEL = "io.github.unravl.bettergrokbot.agent";

/** `~/Library/LaunchAgents/<AGENT_LABEL>.plist`. */
export function agentPlistPath(home = homedir()): string {
	return path.join(home, "Library", "LaunchAgents", `${AGENT_LABEL}.plist`);
}

/** True when launchd runs this agent (its `KeepAlive` starts a fresh one after we exit). */
export function underLaunchd(env: Record<string, string | undefined> = process.env): boolean {
	return env.XPC_SERVICE_NAME === AGENT_LABEL;
}

export interface RespawnAgentOptions {
	/** Test seam: fake home so we do not touch `~/Library/LaunchAgents`. */
	home?: string;
	/** Test seam: do not actually detach a process. */
	spawn?: typeof spawnDetached;
}

/**
 * Restarts this `DATA`'s agent after `stop(true)`.
 *
 * Darwin with a LaunchAgent plist: `startAgent` (bootstrap + `kickstart -k`) is the only writer —
 * never `bgb agent --replace`, which would race KeepAlive. Win/Linux, and Darwin without a plist,
 * still spawn `agent --replace`.
 */
export function respawnAgent(ctx: CoreContext, opts: RespawnAgentOptions = {}): void {
	if (ctx.platform.id === "darwin" && existsSync(agentPlistPath(opts.home))) {
		const bin = path.join(ctx.paths.bin, ctx.platform.binName());
		void ctx.platform.startAgent(bin, ctx.paths).catch((error) => {
			ctx.log.error(`cannot kickstart the agent LaunchAgent: ${errorMessage(error)}`);
		});
		return;
	}
	const argv = BGB_COMPILED
		? [path.join(ctx.paths.bin, ctx.platform.id === "win32" ? "bgbw.exe" : ctx.platform.binName()), "agent", "--replace"]
		: [process.execPath, ...process.argv.slice(1, 2), "agent", "--replace"];
	(opts.spawn ?? spawnDetached)(argv, { BGB_DATA_DIR: ctx.paths.root }, ctx.log);
}

/** Starts a process that outlives this one (no stdio, own process group, hidden window on Windows). */
export function spawnDetached(argv: readonly string[], env: Record<string, string>, log: Logger): number | undefined {
	const [file, ...args] = argv;
	if (!file) throw new Error("spawnDetached: empty argv");
	const child = spawn(file, args, { detached: true, stdio: "ignore", windowsHide: true, env: { ...process.env, ...env } });
	child.on("error", (error) => log.error(`cannot start ${file}: ${errorMessage(error)}`));
	child.unref();
	return child.pid ?? undefined;
}
