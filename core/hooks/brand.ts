import { definePlugin } from "../../sdk/index.ts";

const I18N_CHUNK = /^assets\/index\.eager-(?:common|vendor)-[\w-]+\.js$/;

/** Calls the app Better Grok Bot; the renderer side lives in `loader/brand.ts`. */
export const brandHook = definePlugin({
	id: "bgb-brand",
	name: "Branding",
	description:
		"Calls the app Better Grok Bot: the window title and the messages where the app names itself.",
	version: "1.0.0",
	apiVersion: 1,
	patches: [
		{
			id: "window-title",
			file: /^index\.html$/,
			find: /<title>Grok Bot<\/title>/,
			replace: "<title>Better Grok Bot</title>",
			expect: 1,
		},
		{
			id: "catalog-activate",
			file: I18N_CHUNK,
			// Lingui I18n.loadAndActivate — 0.79.3 lives in the common chunk.
			find: /(loadAndActivate\(\{locale:\i,locales:\i,messages:(\i)\}\)\{)/,
			replace: "$1$2=globalThis.BetterGrokBot?.brandCatalog($2)??$2;",
			expect: 1,
		},
		{
			id: "catalog-load",
			file: I18N_CHUNK,
			// 0.79.3 uses `let`, not `const`, for the existing catalog entry.
			find: /(_load\((\i),(\i)\)\{)(let \i=this\._messages\[\2\];)/,
			replace: "$1$3=globalThis.BetterGrokBot?.brandCatalog($3)??$3;$4",
			expect: 1,
		},
	],
});
