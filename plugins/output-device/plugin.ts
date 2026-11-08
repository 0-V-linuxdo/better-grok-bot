import { definePlugin } from "@better-grok-bot/sdk";
import { SYSTEM_CHILDREN_FIND, injectAfterMicrophone } from "../settings-inject.ts";

const APP_CHUNK = /^assets\/index\.eager-app-[\w-]+\.js$/;
const SETTINGS_VIEW_CHUNK = /^assets\/chunk-(?:view|general-pane)-[\w-]+\.js$/;

export default definePlugin({
	id: "output-device",
	name: "Output Device",
	description: "Choose which speaker or headset voice mode plays through (Settings → General → Speaker).",
	version: "0.1.0",
	apiVersion: 1,
	runtime: "runtime.ts",
	patches: [
		{
			// Voice call audio engine: the context that plays every speech chunk.
			id: "voice-call-context",
			file: APP_CHUNK,
			find: /(\i)=new AudioContext\((\{sampleRate:\i\})\);(let \i=\1\.createMediaStreamSource\(\i\),\i=\1\.createScriptProcessor\()/,
			replace:
				'$1=globalThis.BetterGrokBot?.call("output-device","createAudioContext",$2,"voice-call")??new AudioContext($2);$3',
		},
		{
			// Chime played when a voice call ends.
			id: "hangup-chime-context",
			file: APP_CHUNK,
			find: /(\i)=new AudioContext\(\{sampleRate:(\i)\}\)(,\i=\1\.createBuffer\(1,\i\.length,\2\))/,
			replace:
				'$1=globalThis.BetterGrokBot?.call("output-device","createAudioContext",{sampleRate:$2},"voice-hangup")??new AudioContext({sampleRate:$2})$3',
		},
		{
			// `voicePreviewPlayer`: plays the greeting sample when a voice is previewed in the voice picker.
			id: "voice-preview-element",
			file: APP_CHUNK,
			find: /let (\i)=new Audio;(return \1\.addEventListener\(`ended`,)/,
			replace: 'const $1=new Audio;globalThis.BetterGrokBot?.call("output-device","trackMediaElement",$1,"voice-preview");$2',
		},
		{
			// Settings → General: render the Speaker row right after the Microphone row
			// by making the Microphone row component return both rows.
			id: "speaker-settings-row",
			file: SETTINGS_VIEW_CHUNK,
			find: SYSTEM_CHILDREN_FIND,
			replace: injectAfterMicrophone("output-device", "SpeakerRow", (p) => ({React:p.react,Row:p.row,Select:p.select})),
		},
	],
});
