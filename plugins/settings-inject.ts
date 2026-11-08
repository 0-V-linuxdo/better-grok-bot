import { IDENTIFIER_PATTERN, type PatchMatch } from "@better-grok-bot/sdk";

const I = IDENTIFIER_PATTERN;
const rx = (pattern: string): RegExp => new RegExp(pattern.replaceAll("\\i", I), "g");

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

export interface SettingsPrimitives {
	react: string;
	jsx: string;
	row: string;
	toggle: string;
	select: string;
	button: string;
	textStyles: string;
}

/** Primitives from the 0.79.3 general-pane chunk. */
export function settingsPrimitives(text: string, jsx: string): SettingsPrimitives {
	return {
		react: unique("React", rx(String.raw`(\i)\.useSyncExternalStore`), text),
		jsx,
		row: unique("Row", rx(String.raw`\.jsx\)\((\i),\{anchorId:` + "`[^`]+`" + String.raw`,description:`), text),
		toggle: unique("Toggle", rx(String.raw`\.jsx\)\((\i),\{[^{}]*isChecked:\i,isDisabled:`), text),
		select: unique("Select", rx(String.raw`\.jsx\)\((\i),\{"aria-label":\i,[^{}]*onValueChange:\i,[^{}]*options:`), text),
		button: unique("Button", rx(String.raw`\.jsx\)\((\i),\{onClick:\i,size:` + "`md`" + String.raw`,style:(\i)\.body2,type:` + "`button`" + String.raw`,variant:` + "`secondary`"), text),
		textStyles: unique("textStyles", rx(String.raw`\.jsx\)\((\i),\{onClick:\i,size:` + "`md`" + String.raw`,style:(\i)\.body2,type:` + "`button`" + String.raw`,variant:` + "`secondary`"), text, 2),
	};
}

/** System section children: `(0,$.jsxs)(fn,{anchorId:`system`,children:[i,a,s]})`. */
export const SYSTEM_CHILDREN_FIND =
	/(\(0,(\i)\.jsxs\)\((\i),\{anchorId:`system`,children:\[)(\i),/;

/** Insert a plugin component after the Microphone child of Settings → System. */
export function injectAfterMicrophone(pluginId: string, component: string, deps: (p: SettingsPrimitives) => string) {
	return (m: PatchMatch): string => {
		const head = m.groups[0] ?? "";
		const jsx = m.groups[1] ?? "";
		const child = m.groups[3] ?? "";
		const p = settingsPrimitives(m.text, jsx);
		return `${head}${child},globalThis.BetterGrokBot?${jsx}.jsx(globalThis.BetterGrokBot.component("${pluginId}","${component}",{jsx:${jsx}.jsx,${deps(p)}}),{}):null,`;
	};
}
