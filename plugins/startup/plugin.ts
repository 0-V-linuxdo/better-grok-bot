import { definePlugin } from "@better-grok-bot/sdk";
import { SYSTEM_CHILDREN_FIND, injectAfterMicrophone } from "../settings-inject.ts";

const ENTRY_CHUNK = /^assets\/index\.eager-app-[\w-]+\.js$/;
const SETTINGS_VIEW_CHUNK = /^assets\/chunk-(?:view|general-pane)-[\w-]+\.js$/;

export default definePlugin({
	id: "startup",
	name: "Startup",
	description:
		"Start a voice chat with a chosen bot when Grok Bot starts (Settings → General → System → Start voice on startup). Opening Grok Bot at login is in the Better Grok Bot section.",
	version: "0.1.0",
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
		{
			// Settings → General → System: the startup rows right after the section's first row (Microphone,
			// plus the rows other plugins render inside it). Select comes from the Microphone row, Toggle and Row
			// from the Hardware Acceleration row, React from the Network Debugger row; the section is the one
			// gated on "grok_bot_network_debugger".
			id: "settings-rows",
			file: SETTINGS_VIEW_CHUNK,
			find: SYSTEM_CHILDREN_FIND,
			replace: injectAfterMicrophone("startup", "SettingsRows", (p) => ({React:p.react,Row:p.row,Toggle:p.toggle,Select:p.select})),
		},
	],
});
