import { definePlugin, type PatchMatch } from "@better-grok-bot/sdk";

const ENTRY_CHUNK = /^assets\/index\.eager-app-[\w-]+\.js$/;

export default definePlugin({
	id: "weekly-usage",
	name: "Weekly Usage",
	description:
		"Shows weekly usage as a Void++-style ring in the composer, from the same usage summary as Settings → Usage.",
	version: "0.1.3",
	apiVersion: 1,
	runtime: "runtime.ts",
	styles: "styles.css",
	patches: [
		{
			// Composer trailing cluster (voice buttons). Prepend the ring as a sibling of those controls.
			id: "composer-usage-ring",
			file: ENTRY_CHUNK,
			find: /sand-prompt-actions-trailing`,\i\.className\)[^]*?\(0,(\i)\.jsx\)\(`div`,\{className:\i,ref:\i,style:\i\.style,children:(\i)\}\)/,
			replace: (m: PatchMatch) => {
				const jsx = m.groups[0] ?? "";
				const kids = m.groups[1] ?? "";
				return m.match.replace(
					`children:${kids}}`,
					`children:[globalThis.BetterGrokBot?${jsx}.jsx(globalThis.BetterGrokBot.component("weekly-usage","ComposerRing",{jsx:${jsx}.jsx}),{}):null,${kids}]}`,
				);
			},
			expect: 1,
		},
	],
});
