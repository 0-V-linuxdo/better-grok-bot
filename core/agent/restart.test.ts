import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { AGENT_LABEL, agentPlistPath, respawnAgent, underLaunchd } from "./restart.ts";
import { fakePlatform, tempContext } from "./testing.ts";

let home: string;

beforeEach(async () => {
	home = await mkdtemp(path.join(tmpdir(), "bgb-respawn-"));
});

afterEach(async () => {
	await rm(home, { recursive: true, force: true });
});

test("underLaunchd is the agent LaunchAgent's XPC service name", () => {
	expect(underLaunchd({ XPC_SERVICE_NAME: AGENT_LABEL })).toBe(true);
	expect(underLaunchd({ XPC_SERVICE_NAME: "other" })).toBe(false);
	expect(underLaunchd({})).toBe(false);
});

test("respawnAgent with a Darwin LaunchAgent plist kickstarts and does not spawn --replace", async () => {
	const platform = fakePlatform("darwin");
	const ctx = await tempContext(platform);
	try {
		const plist = agentPlistPath(home);
		await mkdir(path.dirname(plist), { recursive: true });
		await writeFile(plist, "<plist/>");
		const spawned: string[][] = [];
		respawnAgent(ctx, {
			home,
			spawn: (argv) => {
				spawned.push([...argv]);
				return 1;
			},
		});
		await Promise.resolve();
		expect(platform.calls).toEqual(["startAgent"]);
		expect(spawned).toEqual([]);
	} finally {
		await ctx.cleanup();
	}
});

test("respawnAgent without a plist spawns agent --replace", async () => {
	const platform = fakePlatform("darwin");
	const ctx = await tempContext(platform);
	try {
		const spawned: string[][] = [];
		respawnAgent(ctx, {
			home,
			spawn: (argv) => {
				spawned.push([...argv]);
				return 1;
			},
		});
		expect(platform.calls).toEqual([]);
		expect(spawned).toHaveLength(1);
		expect(spawned[0]?.slice(-2)).toEqual(["agent", "--replace"]);
	} finally {
		await ctx.cleanup();
	}
});
