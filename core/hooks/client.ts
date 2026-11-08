import { definePlugin } from "../../sdk/index.ts";

/** `SandClientProvider`: hands the app's client (roster, auth, voice call, …) to the loader. */
export const clientHook = definePlugin({
	id: "bgb-client",
	name: "App client",
	description: "Gives plugins the app's client.",
	version: "1.0.0",
	apiVersion: 1,
	patches: [
		{
			id: "sand-client",
			file: /^assets\/index\.eager-app-[\w-]+\.js$/,
			// 0.79.3: createElement(Context, {value: e.client}, …) — no `.Provider`.
			find: /(\(0,\i\.createElement\)\(\i,\{value:)(\i)\.client/,
			replace: "$1globalThis.BetterGrokBot?.provideClient($2.client)??$2.client",
			expect: 1,
		},
	],
});
