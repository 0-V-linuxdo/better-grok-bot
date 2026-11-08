import { definePlugin } from "@better-grok-bot/sdk";

const APP_CHUNK = /^assets\/index\.eager-app-[\w-]+\.js$/;

export default definePlugin({
	id: "voice-keepalive",
	name: "Voice Keepalive",
	description:
		"Reconnects voice calls when the line drops (e.g. after ~15 minutes of silence) instead of hanging up (Settings → Better Grok Bot → Keep-alive voice).",
	version: "0.2.1",
	apiVersion: 1,
	runtime: "runtime.ts",
	patches: [
		{
			// Voice-call store `onClosed`: redial instead of ending the call when the line drops.
			// The app gates this on the `sand_voice_reconnect` Statsig gate.
			id: "reconnect-on-close",
			file: APP_CHUNK,
			find: /(\i)\.featureGates\(\)\?\.sand_voice_resumption===!0&&(\i)\.closeIsRecoverable\((\i),/,
			replace:
				'(globalThis.BetterGrokBot?.call("voice-keepalive","shouldReconnect",$3)??$1.featureGates()?.sand_voice_reconnect===!0)&&$2.closeIsRecoverable($3,',
		},
		{
			// `mayReconnect` for the first dial and every redial: marks a dropped live socket as recoverable.
			id: "session-may-reconnect",
			file: APP_CHUNK,
			find: /mayReconnect:\(\)=>(\i)\.featureGates\(\)\?\.sand_voice_resumption===!0/,
			replace:
				'mayReconnect:()=>globalThis.BetterGrokBot?.call("voice-keepalive","shouldReconnect")??$1.featureGates()?.sand_voice_reconnect===!0',
			expect: 2,
		},
	],
});
