import { definePlugin } from "@better-grok-bot/sdk";

const APP_CHUNK = /^assets\/index\.eager-app-[\w-]+\.js$/;

/**
 * Native Connect apps uses a labeled Gmail/Drive/Calendar strip when fewer than 4 apps are
 * connected. Collapsing the sidebar unmounts that control; expanding remounts it and replays the
 * strip. Force the compact plus button (the same layout as 4+ connected apps).
 */
export default definePlugin({
	id: "connect-apps",
	name: "Compact Connect Apps",
	description: "Keep Connect apps as the compact plus button. Expanding the sidebar will not replay the Gmail/Drive/Calendar logo strip.",
	version: "0.1.1",
	apiVersion: 1,
	runtime: "runtime.ts",
	patches: [
		{
			id: "connect-apps-icons-only",
			file: APP_CHUNK,
			find: /function (\i)\((\i),(\i)\)\{return \2!==void 0&&\2>=\3\?`iconsOnly`:`labeled`\}/,
			replace: "function $1($2,$3){return `iconsOnly`}",
		},
	],
});
