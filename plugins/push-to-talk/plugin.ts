import { definePlugin } from "@better-grok-bot/sdk";

const APP_CHUNK = /^assets\/index\.eager-app-[\w-]+\.js$/;
const ENTRY_CHUNK = /^assets\/index\.eager-app-[\w-]+\.js$/;

export default definePlugin({
	id: "push-to-talk",
	name: "Push to Talk",
	description:
		"Hold a key (or the call's talk button) to speak in voice mode, even with Grok Bot in the background via the optional key helper; letting go ends your turn so Grok answers right away. With the key helper, music players get quieter while Grok speaks (default 20%) and while you talk (default 0%) (Settings → Better Grok Bot → Push to talk).",
	version: "0.5.2",
	apiVersion: 1,
	permissions: ["keys", "media"],
	runtime: "runtime.ts",
	styles: "styles.css",
	patches: [
		{
			// Realtime `session.update`: manual turns (no server VAD) while push to talk is on.
			id: "realtime-turn-detection",
			file: APP_CHUNK,
			find: /turn_detection:\{type:`server_vad`\}/,
			replace: 'turn_detection:globalThis.BetterGrokBot?.call("push-to-talk","turnDetection")??{type:"server_vad"}',
		},
		{
			// Voice call session `listen()`: hand the plugin the realtime socket and a way to feed
			// server events (synthetic VAD speech start/stop) through the app's own event router.
			id: "realtime-session",
			file: APP_CHUNK,
			find: /(this\.socket\.addEventListener\(`message`,(\i)=>\{if\(typeof \2\.data!=`string`\)return;let (\i)=(\i)\.parse\(\2\.data\);[^]*?\3\.kind===`event`&&this\.router\.route\(\3\.event\)\})/,
			replace:
				'$1,globalThis.BetterGrokBot?.call("push-to-talk","attachSession",{socket:this.socket,receive:__bgbPttEvent=>{const __bgbPttParsed=$4.parse(JSON.stringify(__bgbPttEvent));__bgbPttParsed.kind==="event"&&this.router.route(__bgbPttParsed.event)}})',
		},
		{
			// Voice call session `sendFrame`: microphone frames reach the server only while talking.
			id: "realtime-mic-gate",
			file: APP_CHUNK,
			find: /(sendFrame\((\i)\)\{this.isMuted\|\|this.socket.readyState!==WebSocket.OPEN\|\|)(\(this.socket.send\(JSON\.stringify\(\{type:`input_audio_buffer.append`)/,
			replace:
				'$1globalThis.BetterGrokBot?.call("push-to-talk","holdsFrame",$2)===!0||$3'
		},
		{
			// Voice call speaker `schedule()`: each buffer of Grok's voice queued on the call's
			// AudioContext, with the player; the last buffer's `onended` is the moment playback
			// actually finished.
			id: "voice-playback-schedule",
			file: APP_CHUNK,
			find: /(\.start\(\i\),this\.scheduledSpeech\.add\((\i)\),)(\2\.onended=\(\)=>\{this\.scheduledSpeech\.delete\(\2\),!\(this\.scheduledSpeech\.size>0\)&&\(this\.speakingSpans\.clear\(\),)(this\.speechEnded\(\)\)\})/,
			replace:
				'$1globalThis.BetterGrokBot?.call("push-to-talk","voicePlayback","scheduled",this),$3globalThis.BetterGrokBot?.call("push-to-talk","voicePlayback","drained",this),$4',
		},
		{
			// Voice call speaker `dropScheduledSpeech()`: playback cut off (caller interrupted, call teardown).
			id: "voice-playback-drop",
			file: APP_CHUNK,
			find: /(dropScheduledSpeech\(\)\{)(if\(this\.scheduledSpeech\.size===0\)return\[\];)/,
			replace: '$1globalThis.BetterGrokBot?.call("push-to-talk","voicePlayback","dropped",this);$2',
		},
		{
			// Voice call controls: a hold-to-talk button just before the mute button.
			id: "call-talk-button",
			file: ENTRY_CHUNK,
			find: /(=\(0,(\i)\.useState\)\(`closed`\),\[\i,\i\]=\(0,\2\.useState\)\(`transcript`\)[^]*?)(\(0,(\i)\.jsx\)\((\i),\{content:(\i),children:\(0,\4\.jsx\)\((\i),\{"aria-label":\6,"aria-pressed":(\i)\.isMuted,icon:[^]*?(\i)\.controlPressed[^]*?variant:`secondary`\}\)\}\))/,
			replace:
				'$1globalThis.BetterGrokBot?$4.jsx(globalThis.BetterGrokBot.component("push-to-talk","CallButton",{React:$2,jsx:$4.jsx,Tooltip:$5,IconButton:$7,pressedStyle:$9.controlPressed}),{}):null,$3',
		},
	],
});
