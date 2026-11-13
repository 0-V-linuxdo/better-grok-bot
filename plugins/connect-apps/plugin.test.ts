import { expect, test } from "bun:test";
import { compileFind } from "../../sdk/index.ts";
import definition from "./plugin.ts";

const EXTRACT = "/Users/zhutaiyu/.hermes/cache/scratch/grokbot-renderer-1.0.1/assets/index.eager-app-C1EubAxZ.js";

test("connect-apps-icons-only matches the 1.0.1 layout helper once", async () => {
	const patch = definition.patches?.find((entry) => entry.id === "connect-apps-icons-only");
	expect(patch).toBeDefined();
	if (patch === undefined || typeof patch.replace !== "string") return;
	const source = await Bun.file(EXTRACT).text();
	const find = compileFind(patch.find);
	const matches = [...source.matchAll(find)];
	expect(matches).toHaveLength(patch.expect ?? 1);
	const original = matches[0]?.[0];
	const name = matches[0]?.[1];
	const left = matches[0]?.[2];
	const right = matches[0]?.[3];
	expect(original).toBeDefined();
	expect(name).toBeDefined();
	expect(left).toBeDefined();
	expect(right).toBeDefined();
	expect(original).toBe(`function ${name}(${left},${right}){return ${left}!==void 0&&${left}>=${right}?\`iconsOnly\`:\`labeled\`}`);
	const next = source.replace(find, patch.replace);
	expect(next).toContain(`function ${name}(${left},${right}){return \`iconsOnly\`}`);
	expect(next).not.toContain(original);
	new Bun.Transpiler({ loader: "js" }).scan(next);
});
