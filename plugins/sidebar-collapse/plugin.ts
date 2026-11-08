import { definePlugin } from "@better-grok-bot/sdk";

export default definePlugin({
	id: "sidebar-collapse",
	name: "Sidebar Chrome",
	description:
		"Hide the compact-sidebar control that native Grok Bot only shows under assistiveTech (CDP / bgb agent turns that on). Does not move Search / New Bot.",
	version: "0.1.3",
	apiVersion: 1,
	runtime: "runtime.ts",
	styles: "styles.css",
});
