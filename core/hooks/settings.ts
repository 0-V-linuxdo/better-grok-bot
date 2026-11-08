import { definePlugin, IDENTIFIER_PATTERN, type PatchMatch } from "../../sdk/index.ts";

const I = IDENTIFIER_PATTERN;
const escape = (pattern: string): RegExp => new RegExp(pattern.replaceAll("\\i", I), "g");

/** Primitive name → pattern whose group 1 captures its identifier (group 2 for Button = text styles). */
const SECTION = escape(String.raw`\.jsx\)\((\i),\{anchorId:` + "`[^`]+`" + String.raw`,title:`);
const ROW = escape(String.raw`\.jsx\)\((\i),\{anchorId:` + "`[^`]+`" + String.raw`,description:`);
const TOGGLE = escape(String.raw`\.jsx\)\((\i),\{[^{}]*isChecked:\i,isDisabled:`);
const SELECT = escape(String.raw`\.jsx\)\((\i),\{"aria-label":\i,[^{}]*onValueChange:\i,[^{}]*options:\i,[^{}]*placement:`);
const BUTTON = escape(
	String.raw`\.jsx\)\((\i),\{onClick:\i,size:` +
		"`md`" +
		String.raw`,style:(\i)\.body2,type:` +
		"`button`" +
		String.raw`,variant:` +
		"`secondary`",
);

/** The single identifier every match of `pattern` captures in `group`; throws unless there is ≥ 1 match and all agree. */
function unique(name: string, pattern: RegExp, text: string, group = 1): string {
	const values = new Set<string>();
	for (const match of text.matchAll(pattern)) {
		const value = match[group];
		if (value !== undefined) values.add(value);
	}
	const [only] = values;
	if (values.size !== 1 || only === undefined) throw new Error(`settings primitive ${name} not found unambiguously`);
	return only;
}

function settingsCall(text: string): string {
	const section = unique("Section", SECTION, text);
	const row = unique("Row", ROW, text);
	const toggle = unique("Toggle", TOGGLE, text);
	const select = unique("Select", SELECT, text);
	const button = unique("Button", BUTTON, text);
	const textStyles = unique("textStyles", BUTTON, text, 2);
	return `globalThis.BetterGrokBot?.settingsSection({Section:${section},Row:${row},Toggle:${toggle},Select:${select},Button:${button},textStyles:${textStyles}})`;
}

/** Records UI primitives when General mounts, without adding a section child. */
export function captureReplace(m: PatchMatch): string {
	const ident = m.groups[0] ?? "";
	const he = m.groups[1] ?? "";
	const heArgs = m.groups[2] ?? "";
	return `${ident}=(${settingsCall(m.text)},${he}(\`sand-settings-general\`${heArgs})`;
}

/** Adds the Better Grok Bot tab to Settings (not a section at the bottom of General). */
export const settingsHook = definePlugin({
	id: "bgb-settings",
	name: "Settings section",
	description: "Adds a Better Grok Bot tab to Settings.",
	version: "1.1.0",
	apiVersion: 1,
	patches: [
		{
			id: "capture-ui",
			file: /^assets\/chunk-(?:view|general-pane)-[\w-]+\.js$/,
			find: /(\i)=(\i)\(`sand-settings-general`(,\{className:`[^`]+`\}\.className\))/,
			replace: captureReplace,
			expect: 1,
		},
		{
			id: "layout-shell",
			file: /^assets\/chunk-layout-[\w-]+\.js$/,
			find: /(\(0,(\i)\.jsx\)\()(\i),\{(activeSection:\i,boxActionError:\i\.boxActionError,navFooter:\i,onClose:\i,onSelectSection:\i,presentation:\i\.presentation,sections:\i,children:\i)\}/,
			replace: "globalThis.BetterGrokBot?.settingsShell({jsx:$2.jsx,Layout:$3,$4})??$1$3,{$4}",
			expect: 1,
		},
		{
			id: "nav-label",
			file: /^assets\/chunk-layout-[\w-]+\.js$/,
			find: /children:(\i)\._\(e\.label\)/,
			replace: "children:typeof e.label==`string`?e.label:$1._(e.label)",
			expect: 1,
		},
		{
			id: "header-label",
			file: /^assets\/chunk-layout-[\w-]+\.js$/,
			find: /(\i)\._\(r\.label\)/,
			replace: "typeof r.label==`string`?r.label:$1._(r.label)",
			expect: 1,
		},
	],
});
