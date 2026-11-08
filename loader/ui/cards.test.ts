import { expect, test } from "bun:test";
import { pluginStatus } from "../test/fakes.ts";
import { buildPluginRows } from "./model.ts";
import { CARDS_CSS, filterPlugins, pluginAuthorsLine, pluginHasConfig, pluginIcon, pluginIconPaths } from "./cards.ts";

test("pluginHasConfig is true for schema fields or an extra settings component", () => {
	const [withFields] = buildPluginRows([pluginStatus({ id: "push-to-talk", settings: { key: { type: "key", label: "Key", default: "AltRight" } } })], [], []);
	const [bare] = buildPluginRows([pluginStatus({ id: "chat-search" })], [], []);
	expect(pluginHasConfig(withFields!, {})).toBe(true);
	expect(pluginHasConfig(bare!, {})).toBe(false);
	expect(pluginHasConfig(bare!, { "chat-search": "SettingsRows" })).toBe(true);
	const [disabled] = buildPluginRows([pluginStatus({ id: "output-device", state: "disabled", settings: {} })], [], []);
	expect(pluginHasConfig(disabled!, { "output-device": "SpeakerRow" })).toBe(true);
});

test("pluginAuthorsLine uses Unravl for bundled plugins with empty authors", () => {
	const [bundled] = buildPluginRows([pluginStatus({ id: "output-device" })], [], []);
	const [community] = buildPluginRows([pluginStatus({ id: "vpp-cleaner", source: "community", authors: ["Void++ Contributors"] })], [], []);
	const [anon] = buildPluginRows([pluginStatus({ id: "other", source: "community", authors: [] })], [], []);
	expect(pluginAuthorsLine(bundled!)).toBe("Unravl");
	expect(pluginAuthorsLine(community!)).toBe("Void++ Contributors");
	expect(pluginAuthorsLine(anon!, "Unknown")).toBe("Unknown");
});

test("card CSS matches native General pane padding and does not overflow the panel body", () => {
	expect(CARDS_CSS).toContain('[id^="sand-settings-panel-bgb"] .sand-settings-panel__body');
	expect(CARDS_CSS).toContain("overflow: hidden !important");
	expect(CARDS_CSS).toContain("padding: 22px 32px 28px");
	expect(CARDS_CSS).toContain("@media (max-width: 720px)");
	expect(CARDS_CSS).not.toContain("container-type");
	expect(CARDS_CSS).toContain(".uspp-switch { position: relative; width: 44px; height: 24px");
	expect(CARDS_CSS).toContain('data-icon-name="robot"');
	expect(CARDS_CSS).toContain("top: -8px");
	expect(CARDS_CSS).toContain(".uspp-card-title {");
	expect(CARDS_CSS).toContain('[role="dialog"]:has(.bgb-settings-scroll)');
	expect(CARDS_CSS).toContain(".uspp-sticky {");
	expect(CARDS_CSS).not.toContain("overflow-y: auto !important");
});

test("plugin icons differ by plugin id", () => {
	expect(pluginIconPaths("chat-search")).not.toEqual(pluginIconPaths("push-to-talk"));
	expect(pluginIconPaths("bot-instructions")).not.toEqual(pluginIconPaths("sidebar-folders"));
	expect(pluginIconPaths("unknown-plugin")).toEqual(pluginIconPaths("also-unknown"));
	expect(pluginIcon("vpp-cleaner")).toEqual([
		{ tag: "path", d: "m16 22-1-4" },
		{ tag: "path", d: "M19 13.99a1 1 0 0 0 1-1V12a2 2 0 0 0-2-2h-3a1 1 0 0 1-1-1V4a2 2 0 0 0-4 0v5a1 1 0 0 1-1 1H6a2 2 0 0 0-2 2v.99a1 1 0 0 0 1 1" },
		{ tag: "path", d: "M5 14h14l1.973 6.767A1 1 0 0 1 20 22H4a1 1 0 0 1-.973-1.233z" },
		{ tag: "path", d: "m8 22 1-4" },
	]);
	expect(pluginIcon("vpp-composer-opacity")).toEqual([
		{ tag: "circle", cx: 9, cy: 9, r: 7 },
		{ tag: "circle", cx: 15, cy: 15, r: 7 },
	]);
	expect(pluginIcon("vpp-streamer-mode")[3]).toEqual({ tag: "path", d: "m2 2 20 20" });
});

test("filterPlugins matches name and description", () => {
	const rows = buildPluginRows(
		[
			pluginStatus({ id: "chat-search", name: "Chat Search", description: "Find in this conversation." }),
			pluginStatus({ id: "connect-apps", name: "Compact Connect Apps", description: "Keep the plus button." }),
		],
		[],
		[],
	);
	expect(filterPlugins(rows, "").map((row) => row.id)).toEqual(["chat-search", "connect-apps"]);
	expect(filterPlugins(rows, "plus").map((row) => row.id)).toEqual(["connect-apps"]);
	expect(filterPlugins(rows, "CHAT").map((row) => row.id)).toEqual(["chat-search"]);
});
