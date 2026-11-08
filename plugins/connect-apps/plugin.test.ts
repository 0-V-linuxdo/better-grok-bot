import { expect, test } from "bun:test";
import { compileFind } from "../../sdk/index.ts";
import definition from "./plugin.ts";

const EXTRACT = "/Users/zhutaiyu/.hermes/cache/scratch/grokbot-renderer-0.79.3/assets/index.eager-app-Bpx4jnxc.js";

test("connect-apps-icons-only matches the 0.79.3 layout helper once", async () => {
	const patch = definition.patches?.find((entry) => entry.id === "connect-apps-icons-only");
	expect(patch).toBeDefined();
	if (patch === undefined || typeof patch.replace !== "string") return;
	const source = await Bun.file(EXTRACT).text();
	const find = compileFind(patch.find);
	const matches = [...source.matchAll(find)];
	expect(matches).toHaveLength(patch.expect ?? 1);
	const original = "function stt(e,t){return e!==void 0&&e>=t?`iconsOnly`:`labeled`}";
	expect(matches[0]?.[0]).toBe(original);
	const next = source.replace(find, patch.replace);
	expect(next).toContain("function stt(e,t){return `iconsOnly`}");
	expect(next).not.toContain(original);
});
