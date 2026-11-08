import { expect, test } from "bun:test";
import { compileFind } from "../../sdk/index.ts";
import { settingsHook } from "./settings.ts";

const PANE = "/Users/zhutaiyu/.hermes/cache/scratch/grokbot-renderer-0.79.3/assets/chunk-general-pane-DeppiHAn.js";
const LAYOUT = "/Users/zhutaiyu/.hermes/cache/scratch/grokbot-renderer-0.79.3/assets/chunk-layout-Cc6z1g0Q.js";

function patch(id: string) {
	const found = settingsHook.patches?.find((entry) => entry.id === id);
	expect(found).toBeDefined();
	return found!;
}

test("capture-ui matches the 0.79.3 general pane once and does not append a section child", async () => {
	const source = await Bun.file(PANE).text();
	const entry = patch("capture-ui");
	const find = compileFind(entry.find);
	const matches = [...source.matchAll(find)];
	expect(matches).toHaveLength(entry.expect ?? 1);
	expect(matches[0]?.[0]).toContain("He(`sand-settings-general`");
	const replace = entry.replace;
	if (typeof replace === "string") throw new Error("expected function replacer");
	const next = source.replace(find, (match, ...rest: unknown[]) => {
		const groupCount = (new RegExp(`${find.source}|`, find.flags).exec("")?.length ?? 1) - 1;
		return replace({
			match,
			groups: rest.slice(0, groupCount) as (string | undefined)[],
			named: {},
			offset: rest[groupCount] as number,
			text: rest[groupCount + 1] as string,
			file: "assets/chunk-general-pane-DeppiHAn.js",
		});
	});
	expect(next).toContain("BetterGrokBot?.settingsSection({Section:fn,Row:X,Toggle:bt,Select:ce,Button:q,textStyles:K})");
	expect(next).not.toContain("children:[l,f,p,m,y,b,h,g,_,v,x,S,C,T,E,globalThis.BetterGrokBot");
	new Bun.Transpiler({ loader: "js" }).scan(next);
});

test("layout-shell wraps the 0.79.3 settings layout once", async () => {
	const source = await Bun.file(LAYOUT).text();
	const entry = patch("layout-shell");
	const find = compileFind(entry.find);
	expect([...source.matchAll(find)]).toHaveLength(entry.expect ?? 1);
	const replace = entry.replace;
	const next =
		typeof replace === "string"
			? source.replace(find, replace)
			: source.replace(find, (match, ...rest: unknown[]) => {
					const groupCount = (new RegExp(`${find.source}|`, find.flags).exec("")?.length ?? 1) - 1;
					return replace({
						match,
						groups: rest.slice(0, groupCount) as (string | undefined)[],
						named: {},
						offset: rest[groupCount] as number,
						text: rest[groupCount + 1] as string,
						file: "assets/chunk-layout-Cc6z1g0Q.js",
					});
				});
	expect(next).toContain("BetterGrokBot?.settingsShell({jsx:E.jsx,Layout:_e,");
	expect(next).toContain("??(0,E.jsx)(_e,{activeSection:w,");
	new Bun.Transpiler({ loader: "js" }).scan(next);
});

test("nav and header labels accept a string on 0.79.3", async () => {
	const source = await Bun.file(LAYOUT).text();
	let next = source;
	for (const id of ["nav-label", "header-label"]) {
		const entry = patch(id);
		const find = compileFind(entry.find);
		expect([...next.matchAll(find)]).toHaveLength(entry.expect ?? 1);
		if (typeof entry.replace !== "string") throw new Error(`${id} should be a string replace`);
		next = next.replace(find, entry.replace);
	}
	expect(next).toContain("typeof e.label==`string`?e.label:l._(e.label)");
	expect(next).toContain("typeof r.label==`string`?r.label:l._(r.label)");
	new Bun.Transpiler({ loader: "js" }).scan(next);
});
