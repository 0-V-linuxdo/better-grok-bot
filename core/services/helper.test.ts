import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { nullLogger } from "../log.ts";
import { type DataPaths, dataPaths, ensureDataDir } from "../paths.ts";
import { HelperController, type HelperProcess, type HelperSpawner } from "./helper.ts";

let paths: DataPaths;

beforeEach(async () => {
	paths = dataPaths(await mkdtemp(path.join(tmpdir(), "bgb-helper-")));
	await ensureDataDir(paths);
});

afterEach(async () => {
	await rm(paths.root, { recursive: true, force: true });
});

function controller(spawn: HelperSpawner, extra: { maxFailures?: number; givenUpMs?: number; helloMs?: number } = {}): HelperController {
	return new HelperController({
		paths,
		log: nullLogger,
		platform: "linux",
		arch: "x64",
		manifest: { version: 1, tag: "v1", assets: { "linux-x64": { name: "h", sha256: "a".repeat(64) } } },
		env: { BGB_HELPER_PATH: "/dev/null" },
		fetch: async () => {
			throw new Error("no fetch");
		},
		run: async () => ({ code: 0, stdout: "", stderr: "" }),
		spawn,
		launchAgentsDir: path.join(paths.root, "agents"),
		uid: 501,
		endpoint: () => ({ port: 1, token: "t" }),
		requestQuit: () => false,
		onChange() {},
		idleMs: 60_000,
		restartBaseMs: 60_000,
		maxFailures: extra.maxFailures ?? 2,
		givenUpMs: extra.givenUpMs ?? 40,
		helloMs: extra.helloMs,
	});
}

test("overlapping ensureRunning coalesces into one follow-up instead of dropping the second start", async () => {
	let spawns = 0;
	const helper = controller(() => {
		spawns++;
		throw new Error("spawn failed");
	});
	helper.setWanted(true);
	const second = helper.ensureRunning();
	await Promise.all([second, Bun.sleep(20)]);
	expect(spawns).toBeGreaterThanOrEqual(2);
	expect(helper.failures).toBeGreaterThanOrEqual(2);
	await helper.stop();
});

test("given-up expires after the clock, then a wanted helper may start again", async () => {
	let spawns = 0;
	const helper = controller(
		() => {
			spawns++;
			throw new Error("spawn failed");
		},
		{ maxFailures: 1, givenUpMs: 40 },
	);
	helper.setWanted(true);
	await Bun.sleep(10);
	const afterGiveUp = spawns;
	expect(afterGiveUp).toBe(1);
	await helper.ensureRunning();
	expect(spawns).toBe(1);
	await Bun.sleep(50);
	await helper.ensureRunning();
	expect(spawns).toBe(2);
	await helper.stop();
});

test("given-up self-arms one ensureRunning after the clock without a new setWanted", async () => {
	let spawns = 0;
	const helper = controller(
		() => {
			spawns++;
			throw new Error("spawn failed");
		},
		{ maxFailures: 1, givenUpMs: 20 },
	);
	helper.setWanted(true);
	await Bun.sleep(10);
	expect(spawns).toBe(1);
	const started = Date.now();
	while (spawns < 2 && Date.now() - started < 200) await Bun.sleep(5);
	expect(spawns).toBe(2);
	await helper.stop();
});

test("resetFailures clears a given-up helper so the next ensureRunning can spawn", async () => {
	let spawns = 0;
	const helper = controller(
		() => {
			spawns++;
			throw new Error("spawn failed");
		},
		{ maxFailures: 1, givenUpMs: 60_000 },
	);
	helper.setWanted(true);
	await Bun.sleep(10);
	expect(spawns).toBe(1);
	helper.resetFailures();
	await helper.ensureRunning();
	expect(spawns).toBe(2);
	await helper.stop();
});

test("wanted 0→1 resets a given-up helper immediately", async () => {
	let spawns = 0;
	const helper = controller(
		() => {
			spawns++;
			throw new Error("spawn failed");
		},
		{ maxFailures: 1, givenUpMs: 60_000 },
	);
	helper.setWanted(true);
	await Bun.sleep(10);
	expect(spawns).toBe(1);
	helper.setWanted(false);
	helper.setWanted(true);
	await Bun.sleep(10);
	expect(spawns).toBe(2);
	await helper.stop();
});

test("a live child is not double-spawned", async () => {
	let resolveExit!: (code: number) => void;
	const child: HelperProcess = {
		pid: 9,
		exited: new Promise((resolve) => {
			resolveExit = resolve;
		}),
		kill() {
			resolveExit(-1);
		},
	};
	let spawns = 0;
	const helper = controller(() => {
		spawns++;
		return child;
	});
	helper.setWanted(true);
	await Bun.sleep(10);
	await helper.ensureRunning();
	await helper.ensureRunning();
	expect(spawns).toBe(1);
	await helper.stop();
});

test("a child that never hellos is killed and counts as a failed start", async () => {
	let kills = 0;
	let resolveExit!: (code: number) => void;
	const child: HelperProcess = {
		pid: 11,
		exited: new Promise((resolve) => {
			resolveExit = resolve;
		}),
		kill() {
			kills++;
			resolveExit(-1);
		},
	};
	const helper = controller(() => child, { maxFailures: 2, helloMs: 20, givenUpMs: 60_000 });
	helper.setWanted(true);
	await Bun.sleep(10);
	expect(kills).toBe(0);
	const started = Date.now();
	while ((kills < 1 || helper.failures < 1) && Date.now() - started < 400) await Bun.sleep(5);
	expect(kills).toBe(1);
	expect(helper.failures).toBe(1);
	await helper.stop();
});
