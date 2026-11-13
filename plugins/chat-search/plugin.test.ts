import { expect, test } from "bun:test";
import { compileFind } from "../../sdk/index.ts";
import definition from "./plugin.ts";

const EXTRACT = "/Users/zhutaiyu/.hermes/cache/scratch/grokbot-renderer-1.0.1/assets/index.eager-app-C1EubAxZ.js";

test("native-open-command matches the 1.0.1 root command object once", async () => {
	const patch = definition.patches?.find((entry) => entry.id === "native-open-command");
	expect(patch).toBeDefined();
	if (patch === undefined || typeof patch.replace !== "string") return;
	const source = await Bun.file(EXTRACT).text();
	const find = compileFind(patch.find);
	const matches = [...source.matchAll(find)];
	expect(matches).toHaveLength(patch.expect ?? 1);
	expect(matches[0]?.[0]).toContain("chatColumn:");
	expect(matches[0]?.[0]).toContain(".isAnysphereUser");
	expect(matches[0]?.[2]).toMatch(/^[\w$]+$/);
	const next = source.replace(find, patch.replace);
	expect(next).toContain(`openFindInChat:(globalThis.BetterGrokBot?.call("chat-search","captureOpen",${matches[0]?.[2]})??${matches[0]?.[2]}),isTeamAgentsEnabled:`);
	expect(next).not.toContain(matches[0]?.[0]);
	new Bun.Transpiler({ loader: "js" }).scan(next);
});
