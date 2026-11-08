import { definePlugin } from "@better-grok-bot/sdk";

const ENTRY_CHUNK = /^assets\/index\.eager-app-[\w-]+\.js$/;

export default definePlugin({
	id: "startup",
	name: "Startup",
	description:
		"Start a voice chat with a chosen bot when Grok Bot starts (Settings → Better Grok Bot → Start voice on startup). Opening Grok Bot at login is in the same tab.",
	version: "0.1.1",
	apiVersion: 1,
	runtime: "runtime.ts",
	patches: [
		{
			// Chat view: the composer's voice-call button handler (`onStartVoiceCall`) for the bot on screen,
			// defined only while that bot can be called and no call is up.
			id: "composer-voice-call",
			file: ENTRY_CHUNK,
			find: /((\i)=\i\.currentAgent,[^]*?Nf\(`grok_bot_multiplayer`\)[^]*?)(\i)=(\i\.kind===`idle`&&\i!==null\?\i:void 0),/,
			replace: '$1$3=globalThis.BetterGrokBot?.call("startup","offerVoiceCall",$2?.id??null,$4)??($4),',
		},
	],
});
