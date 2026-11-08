/**
 * Plugin cards match Void++ `BaseCard` / `PluginCard` (icon chip, 2-line desc,
 * author footer, blue switch). Toolbar/grid tokens stay Userscript++.
 * Scroll/padding match native General — do not put overflow on
 * `.sand-settings-panel__body` or a 15px classic scrollbar eats width.
 */
import type { UiPrimitives } from "../../sdk/index.ts";
import type { H } from "./h.ts";
import type { PluginRowModel } from "./model.ts";

export const CARDS_STYLE_ID = "core:settings-cards";

export const CARDS_CSS = `
[id^="sand-settings-panel-bgb"] .sand-settings-panel__body {
	overflow: hidden !important;
	display: flex;
	flex-direction: column;
	min-height: 0;
}
.sand-settings-nav .sand-settings-nav__item:has([data-icon-name="robot"]) {
	position: relative;
	margin-top: 16px;
}
.sand-settings-nav .sand-settings-nav__item:has([data-icon-name="robot"])::before {
	content: "";
	position: absolute;
	left: 10px;
	right: 10px;
	top: -8px;
	height: 1px;
	background: color-mix(in srgb, currentColor 16%, transparent);
	pointer-events: none;
}
.ui-dialog:has(.bgb-settings-scroll),
[role="dialog"]:has(.bgb-settings-scroll) {
	width: min(1060px, calc(100vw - 40px)) !important;
	max-width: min(1060px, calc(100vw - 40px)) !important;
}
.bgb-settings-scroll {
	flex: 1 1 auto;
	min-height: 0;
	height: 100%;
	display: flex;
	flex-direction: column;
	overflow: hidden;
	--uspp-surface-base: #151517;
	--uspp-surface-l1: #1c1c1f;
	--uspp-surface-l2: #26262a;
	--uspp-surface-l3: #3f3f46;
	--uspp-fg-primary: #f4f4f5;
	--uspp-fg-secondary: #a1a1aa;
	--uspp-fg-tertiary: #71717a;
	--uspp-fg-danger: #f06a6e;
	--uspp-border-l1: rgb(255 255 255 / .1);
	--uspp-border-l2: rgb(255 255 255 / .16);
	--uspp-ring: #a1a1aa;
	--uspp-button-ghost-hover: rgb(255 255 255 / .08);
	color: var(--uspp-fg-primary);
	font-size: 14px;
	font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
}
.bgb-settings-scroll:not(:has(> .uspp-sticky)) {
	overflow-y: auto;
	scrollbar-width: none;
}
.bgb-settings-scroll::-webkit-scrollbar,
.bgb-settings-pane::-webkit-scrollbar { display: none; width: 0; height: 0; }
.uspp-sticky {
	flex: 0 0 auto;
	display: flex;
	flex-direction: column;
	gap: 16px;
	padding: 22px 32px 0;
	background: transparent;
}
.uspp-sticky-inner { display: flex; flex-direction: column; gap: 16px; }
.bgb-settings-scroll:has(> .uspp-sticky) .bgb-settings-pane {
	flex: 1 1 auto;
	min-height: 0;
	overflow-x: hidden;
	overflow-y: auto;
	scrollbar-width: none;
	padding-top: 16px;
}
.bgb-settings-pane {
	box-sizing: border-box;
	width: 100%;
	padding: 22px 32px 28px;
}
.uspp-page { display: flex; flex-direction: column; gap: 16px; padding-bottom: 24px; min-width: 0; }
.uspp-toolbar { display: flex; gap: 8px; align-items: center; }
.uspp-toolbar .uspp-input { flex: 1; }
.uspp-input, .uspp-select {
	box-sizing: border-box; background: var(--uspp-surface-l2); color: var(--uspp-fg-primary);
	border: 1px solid var(--uspp-border-l1); border-radius: 12px; padding: 8px 12px; font: inherit; outline: none;
}
.uspp-input { width: 100%; min-width: 0; }
.uspp-input:focus, .uspp-select:focus { border-color: var(--uspp-ring); }
.uspp-select {
	width: auto;
	min-width: 140px;
	padding-right: 28px;
	background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
	background-repeat: no-repeat;
	background-position: right 10px center;
	background-color: var(--uspp-surface-l2);
}
.uspp-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
@media (max-width: 720px) { .uspp-grid { grid-template-columns: 1fr; } }
.uspp-card {
	box-sizing: border-box;
	display: flex; flex-direction: column; padding: 0;
	border: 1px solid var(--uspp-border-l1); border-radius: 8px; background: var(--uspp-surface-l1);
	min-width: 0; min-height: 7.5rem; overflow: hidden;
	font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
}
.uspp-card[data-failed="true"] { border-color: var(--uspp-fg-danger); background: color-mix(in srgb, var(--uspp-fg-danger) 8%, transparent); }
.uspp-card-body { padding: 10px 12px; flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.uspp-card-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 0; }
.uspp-card-title { display: flex; align-items: center; gap: 6px; min-width: 0; flex: 1; overflow: hidden; }
.uspp-card-name { font-weight: 500; font-size: 14px; line-height: 20px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.uspp-card-controls { margin-left: auto; display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.uspp-card-controls .uspp-btn-icon { width: 24px !important; height: 24px !important; min-width: 24px; min-height: 24px; }
.uspp-card-desc {
	color: var(--uspp-fg-secondary); font-size: 13px; line-height: 1.5; margin-top: 4px;
	display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.uspp-card-separator { height: 1px; background: var(--uspp-border-l1); flex-shrink: 0; }
.uspp-card-footer { display: flex; align-items: center; padding: 6px 12px; gap: 6px; min-width: 0; }
.uspp-card-authors { color: var(--uspp-fg-tertiary); font-size: 11.2px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.uspp-icon-badge {
	display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
	width: 24px; height: 24px; border-radius: 8px; color: var(--uspp-fg-primary);
	background: color-mix(in srgb, var(--uspp-fg-primary) 10%, transparent);
}
.uspp-icon-badge.uspp-warn { color: var(--uspp-fg-danger); background: color-mix(in srgb, var(--uspp-fg-danger) 12%, transparent); }
.uspp-site-badge { font-size: 11px; padding: 0 6px; border-radius: 6px; color: var(--uspp-fg-secondary); border: 1px solid var(--uspp-border-l1); white-space: nowrap; flex-shrink: 0; }
.uspp-switch { position: relative; width: 36px; height: 20px; border-radius: 9999px; background: var(--uspp-surface-l3); border: none; cursor: pointer; flex-shrink: 0; padding: 0; transition: background .15s; }
.uspp-switch[data-checked="true"] { background: var(--sand-fill-accent, var(--cursor-bg-blue-primary, #0a84ff)); }
.uspp-switch::after { content: ""; position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: transform .15s; }
.uspp-switch[data-checked="true"]::after { transform: translateX(16px); }
.uspp-switch:disabled { opacity: .5; cursor: not-allowed; }
.uspp-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 36px; padding: 0 14px; border-radius: 9999px; border: 1px solid var(--uspp-border-l2); background: transparent; color: var(--uspp-fg-primary); font: inherit; font-weight: 500; cursor: pointer; white-space: nowrap; }
.uspp-btn:hover:not(:disabled) { background: var(--uspp-button-ghost-hover); }
.uspp-btn:disabled { opacity: .5; cursor: default; }
.uspp-btn-icon { width: 32px !important; height: 32px !important; min-width: 32px; min-height: 32px; padding: 0 !important; border-color: transparent; color: var(--uspp-fg-secondary); box-shadow: none; background: transparent; }
.uspp-btn-icon:hover:not(:disabled) { color: var(--uspp-fg-primary); }
.uspp-btn-icon.uspp-active { color: var(--uspp-fg-primary); }
.uspp-badge { display: inline-flex; align-items: center; height: 18px; padding: 0 6px; border-radius: 6px; font-size: 11px; font-weight: 600; background: var(--uspp-fg-primary); color: var(--uspp-surface-base); flex-shrink: 0; }
.uspp-btn, .uspp-switch, .uspp-input, .uspp-select, .uspp-chip {
	appearance: none;
	-webkit-appearance: none;
}
.uspp-tabs { display: flex; flex-wrap: wrap; gap: 6px; }
.uspp-chip { height: 30px; padding: 0 12px; border-radius: 9999px; border: 1px solid var(--uspp-border-l1); background: transparent; color: var(--uspp-fg-secondary); font: inherit; font-size: 13px; cursor: pointer; }
.uspp-chip:hover { background: var(--uspp-button-ghost-hover); }
.uspp-chip[aria-selected="true"] { background: var(--uspp-fg-primary); color: var(--uspp-surface-base); border-color: transparent; }
.uspp-btn-danger { background: var(--uspp-fg-danger); color: #fff; border-color: transparent; }
.uspp-btn-danger:hover:not(:disabled) { background: var(--uspp-fg-danger); opacity: .88; }
.uspp-muted { color: var(--uspp-fg-secondary); }
.uspp-small { font-size: 12px; }
.uspp-empty { padding: 32px 8px; text-align: center; color: var(--uspp-fg-secondary); }
dialog.uspp-modal {
	position: relative;
	width: min(560px, 100%);
	max-height: min(85vh, 760px);
	margin: auto;
	padding: 0;
	border: 1px solid var(--uspp-border-l1);
	border-radius: 24px;
	background: var(--uspp-surface-l1);
	color: var(--uspp-fg-primary);
	box-shadow: 0 16px 48px rgb(0 0 0 / .35);
	display: flex;
	flex-direction: column;
	overflow: hidden;
	font-size: 14px;
}
dialog.uspp-modal::backdrop { background: rgb(0 0 0 / 0.5); }
.uspp-modal-header { padding: 20px 56px 8px 24px; }
.uspp-modal-title { font-size: 18px; font-weight: 600; margin: 0; }
.uspp-modal-subtitle { color: var(--uspp-fg-secondary); margin-top: 4px; }
.uspp-modal-body { padding: 8px 24px 16px; overflow-y: auto; }
.uspp-modal-footer { padding: 12px 24px 20px; display: flex; gap: 8px; justify-content: flex-end; border-top: 1px solid var(--uspp-border-l1); }
.uspp-modal-close { position: absolute; top: 14px; right: 14px; }
`;

export function injectCardsCss(doc: Document | undefined): void {
	if (doc === undefined) return;
	let style = doc.querySelector<HTMLStyleElement>(`style[data-bgb-style="${CARDS_STYLE_ID}"]`);
	if (style === null) {
		style = doc.createElement("style");
		style.dataset.bgbStyle = CARDS_STYLE_ID;
		(doc.head ?? doc.documentElement).append(style);
	}
	style.textContent = CARDS_CSS;
}

export function pluginAuthorsLine(plugin: PluginRowModel, fallback = ""): string {
	if (plugin.authors.length > 0) return plugin.authors.join(", ");
	if (plugin.source === "bundled" || plugin.source === "core") return "Unravl";
	return fallback;
}

export function pluginHasConfig(plugin: PluginRowModel, extra: Readonly<Record<string, string>>): boolean {
	return Object.keys(plugin.settings).length > 0 || extra[plugin.id] !== undefined;
}

export function filterPlugins(
	plugins: readonly PluginRowModel[],
	query: string,
	enabled: "all" | "enabled" | "disabled" = "all",
): PluginRowModel[] {
	const q = query.trim().toLowerCase();
	const matched =
		q === "" ? [...plugins] : plugins.filter((plugin) => `${plugin.name} ${plugin.label} ${plugin.description}`.toLowerCase().includes(q));
	if (enabled === "enabled") return matched.filter((plugin) => plugin.enabled);
	if (enabled === "disabled") return matched.filter((plugin) => !plugin.enabled);
	return matched;
}

export function wrapSettingsPane(h: H, child: unknown, sticky?: unknown): unknown {
	return h(
		"div",
		{ className: "bgb-settings-scroll", "data-bgb-plugins": "" },
		sticky !== undefined && h("div", { className: "uspp-sticky" }, sticky),
		h("div", { className: "bgb-settings-pane" }, child),
	);
}

export interface PluginCardHandlers {
	ui: UiPrimitives;
	extra: Readonly<Record<string, string>>;
	offline: boolean;
	busy: (action: string) => boolean;
	starred: readonly string[];
	pinned: readonly string[];
	toggle: (ui: UiPrimitives, label: string, isChecked: boolean, isDisabled: boolean, onToggle: (next: boolean) => void) => unknown;
	button: (ui: UiPrimitives, key: string, label: string, disabled: boolean, onClick: () => void) => unknown;
	onToggle: (plugin: PluginRowModel, enabled: boolean) => void;
	onStar: (plugin: PluginRowModel) => void;
	onPin: (plugin: PluginRowModel) => void;
	onUpdate: (plugin: PluginRowModel) => void;
	onUninstall: (plugin: PluginRowModel) => void;
	onConfigure: (plugin: PluginRowModel) => void;
}

type IconPart =
	| { tag: "path"; d: string }
	| { tag: "circle"; cx: number; cy: number; r: number }
	| { tag: "line"; x1: number; y1: number; x2: number; y2: number }
	| { tag: "polyline"; points: string };

function asIconParts(icon: readonly IconPart[] | readonly string[]): IconPart[] {
	if (icon.length === 0) return [];
	if (typeof icon[0] === "string") return (icon as readonly string[]).map((d) => ({ tag: "path", d }));
	return [...(icon as readonly IconPart[])];
}

function strokeIcon(h: H, icon: readonly IconPart[] | readonly string[], sizePx: number, fill = "none"): unknown {
	return h(
		"svg",
		{
			width: sizePx,
			height: sizePx,
			viewBox: "0 0 24 24",
			fill,
			stroke: fill === "none" ? "currentColor" : undefined,
			strokeWidth: fill === "none" ? 2 : undefined,
			strokeLinecap: "round",
			strokeLinejoin: "round",
			"aria-hidden": true,
			style: { flexShrink: 0 },
		},
		...asIconParts(icon).map(({ tag, ...props }) => h(tag, props)),
	);
}

const PLUG_PATHS = ["M9 2v6", "M15 2v6", "M6 8h12v3a6 6 0 0 1-12 0V8z", "M12 17v5"] as const;
const SEARCH_PATHS = ["M21 21l-6-6", "M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16z"] as const;
const FILE_PATHS = ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6", "M16 13H8", "M16 17H8", "M10 9H8"] as const;
const MIC_PATHS = ["M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z", "M19 10v2a7 7 0 0 1-14 0v-2", "M12 19v3"] as const;
const SPEAKER_PATHS = ["M11 5 6 9H2v6h4l5 4z", "M15.54 8.46a5 5 0 0 1 0 7.07"] as const;
const FOLDER_PATHS = ["M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"] as const;
const SIDEBAR_PATHS = ["M3 5h18v14H3z", "M9 5v14"] as const;
const POWER_PATHS = ["M12 2v10", "M6.3 6.3a8 8 0 1 0 11.4 0"] as const;
const ACTIVITY_PATHS = ["M22 12h-4l-3 9L9 3l-3 9H2"] as const;
const SERVER_PATHS = ["M3 5h18v6H3z", "M3 13h18v6H3z", "M7 8h.01", "M7 16h.01"] as const;
const CHART_PATHS = ["M3 3v18h18", "M7 16v-5", "M12 16V8", "M17 16v-9"] as const;
const LINK_PATHS = ["M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71", "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"] as const;
const SLIDERS_PATHS = ["M4 6h10", "M18 6h2", "M4 12h4", "M12 12h8", "M4 18h12", "M20 18h0", "M16 4v4", "M10 10v4", "M18 16v4"] as const;
const CLOSE_PATHS = ["M18 6 6 18", "M6 6l12 12"] as const;
const STAR_PATHS = ["M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"] as const;
const PIN_PATHS = ["M12 17v5", "M9 3h6l-1 6 4 4H6l4-4z"] as const;
const WARN_PATHS = ["M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z", "M12 9v4", "M12 17h.01"] as const;

const PLUGIN_ICONS: Record<string, readonly IconPart[] | readonly string[]> = {
	"bot-instructions": FILE_PATHS,
	"chat-search": SEARCH_PATHS,
	"connect-apps": LINK_PATHS,
	"output-device": SPEAKER_PATHS,
	"push-to-talk": MIC_PATHS,
	"sidebar-collapse": SIDEBAR_PATHS,
	"sidebar-folders": FOLDER_PATHS,
	startup: POWER_PATHS,
	"voice-dock": ["M4 12h2", "M8 8v8", "M12 4v16", "M16 8v8", "M20 12h2"],
	"voice-keepalive": ACTIVITY_PATHS,
	"voice-mcp": SERVER_PATHS,
	"weekly-usage": CHART_PATHS,
	"vpp-auto-collapse": [
		{ tag: "path", d: "m7 20 5-5 5 5" },
		{ tag: "path", d: "m7 4 5 5 5-5" },
	],
	"vpp-better-links": [
		{ tag: "path", d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" },
		{ tag: "path", d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" },
	],
	"vpp-cleaner": [
		{ tag: "path", d: "m16 22-1-4" },
		{ tag: "path", d: "M19 13.99a1 1 0 0 0 1-1V12a2 2 0 0 0-2-2h-3a1 1 0 0 1-1-1V4a2 2 0 0 0-4 0v5a1 1 0 0 1-1 1H6a2 2 0 0 0-2 2v.99a1 1 0 0 0 1 1" },
		{ tag: "path", d: "M5 14h14l1.973 6.767A1 1 0 0 1 20 22H4a1 1 0 0 1-.973-1.233z" },
		{ tag: "path", d: "m8 22 1-4" },
	],
	"vpp-complete-toast": [
		{ tag: "circle", cx: 12, cy: 12, r: 10 },
		{ tag: "path", d: "m9 12 2 2 4-4" },
	],
	"vpp-composer-opacity": [
		{ tag: "circle", cx: 9, cy: 9, r: 7 },
		{ tag: "circle", cx: 15, cy: 15, r: 7 },
	],
	"vpp-export-chat": [
		{ tag: "path", d: "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" },
		{ tag: "path", d: "M14 2v4a2 2 0 0 0 2 2h4" },
		{ tag: "path", d: "M12 18v-6" },
		{ tag: "path", d: "m9 15 3 3 3-3" },
	],
	"vpp-input-history": [
		{ tag: "path", d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" },
		{ tag: "path", d: "M3 3v5h5" },
		{ tag: "path", d: "M12 7v5l4 2" },
	],
	"vpp-message-timestamps": [
		{ tag: "circle", cx: 12, cy: 12, r: 10 },
		{ tag: "polyline", points: "12 6 12 12 16 14" },
	],
	"vpp-no-dictation": [
		{ tag: "line", x1: 2, y1: 2, x2: 22, y2: 22 },
		{ tag: "path", d: "M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" },
		{ tag: "path", d: "M5 10v2a7 7 0 0 0 12 5" },
		{ tag: "path", d: "M15 9.34V5a3 3 0 0 0-5.68-1.33" },
		{ tag: "path", d: "M9 9v3a3 3 0 0 0 5.12 2.12" },
		{ tag: "line", x1: 12, y1: 19, x2: 12, y2: 22 },
	],
	"vpp-no-share-link": [
		{ tag: "path", d: "M9 17H7A5 5 0 0 1 7 7" },
		{ tag: "path", d: "M15 7h2a5 5 0 0 1 4 8" },
		{ tag: "line", x1: 8, y1: 12, x2: 12, y2: 12 },
		{ tag: "line", x1: 2, y1: 2, x2: 22, y2: 22 },
	],
	"vpp-no-sidebar-identity": [
		{ tag: "path", d: "M2 21a8 8 0 0 1 11.873-7" },
		{ tag: "circle", cx: 10, cy: 8, r: 5 },
		{ tag: "path", d: "m17 17 5 5" },
		{ tag: "path", d: "m22 17-5 5" },
	],
	"vpp-response-notification": [
		{ tag: "path", d: "M10.268 21a2 2 0 0 0 3.464 0" },
		{ tag: "path", d: "M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" },
	],
	"vpp-settings-flyout": [
		{ tag: "path", d: "M20 7h-9" },
		{ tag: "path", d: "M14 17H5" },
		{ tag: "circle", cx: 17, cy: 17, r: 3 },
		{ tag: "circle", cx: 7, cy: 7, r: 3 },
	],
	"vpp-streamer-mode": [
		{ tag: "path", d: "M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" },
		{ tag: "path", d: "M14.084 14.158a3 3 0 0 1-4.242-4.242" },
		{ tag: "path", d: "M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" },
		{ tag: "path", d: "m2 2 20 20" },
	],
	"vpp-user-quotes": [
		{ tag: "path", d: "M21 6H8" },
		{ tag: "path", d: "M21 12H8" },
		{ tag: "path", d: "M3 6v6" },
		{ tag: "path", d: "M21 18H3" },
	],
	"vpp-wider-chat": [
		{ tag: "path", d: "M16 12h6" },
		{ tag: "path", d: "M8 12H2" },
		{ tag: "path", d: "M12 2v2" },
		{ tag: "path", d: "M12 8v2" },
		{ tag: "path", d: "M12 14v2" },
		{ tag: "path", d: "M12 20v2" },
		{ tag: "path", d: "m19 15 3-3-3-3" },
		{ tag: "path", d: "m5 9-3 3 3 3" },
	],
};

export function pluginIcon(id: string): readonly IconPart[] {
	return asIconParts(PLUGIN_ICONS[id] ?? PLUG_PATHS);
}

export function pluginIconPaths(id: string): readonly string[] {
	return pluginIcon(id).flatMap((part) => (part.tag === "path" ? [part.d] : []));
}

function iconButton(
	h: H,
	opts: { paths: readonly string[]; label: string; active?: boolean; filled?: boolean; disabled?: boolean; onClick: () => void },
): unknown {
	return h(
		"button",
		{
			type: "button",
			className: opts.active === true ? "uspp-btn uspp-btn-icon uspp-active" : "uspp-btn uspp-btn-icon",
			"aria-label": opts.label,
			title: opts.label,
			disabled: opts.disabled === true,
			onClick: opts.onClick,
		},
		strokeIcon(h, opts.paths, 14, opts.filled === true ? "currentColor" : "none"),
	);
}

export function renderSwitch(
	h: H,
	opts: { checked: boolean; disabled: boolean; label: string; onChange: (next: boolean) => void },
): unknown {
	return h("button", {
		type: "button",
		role: "switch",
		className: "uspp-switch",
		"aria-checked": opts.checked,
		"aria-label": opts.label,
		"data-checked": String(opts.checked),
		disabled: opts.disabled,
		onClick: () => {
			if (!opts.disabled) opts.onChange(!opts.checked);
		},
	});
}

export function renderPluginCard(h: H, plugin: PluginRowModel, handlers: PluginCardHandlers): unknown {
	const failed = plugin.state === "runtime-failed" || plugin.state === "patch-failed" || plugin.state === "invalid";
	const hasConfig = pluginHasConfig(plugin, handlers.extra);
	const starred = handlers.starred.includes(plugin.id);
	const pinned = handlers.pinned.includes(plugin.id);
	const authors = pluginAuthorsLine(plugin);
	return h(
		"div",
		{ className: "uspp-card", "data-bgb-plugin": plugin.id, "data-failed": String(failed), key: plugin.key },
		h(
			"div",
			{ className: "uspp-card-body" },
			h(
				"div",
				{ className: "uspp-card-head" },
				h(
					"div",
					{ className: "uspp-card-title" },
					h("span", { className: "uspp-icon-badge" }, strokeIcon(h, pluginIcon(plugin.id), 14)),
					h("span", { className: "uspp-card-name" }, plugin.name),
					failed && h("span", { className: "uspp-icon-badge uspp-warn" }, strokeIcon(h, WARN_PATHS, 14)),
				),
				h(
					"div",
					{ className: "uspp-card-controls" },
					iconButton(h, {
						paths: STAR_PATHS,
						label: starred ? "Unstar" : "Star",
						active: starred,
						filled: starred,
						onClick: () => handlers.onStar(plugin),
					}),
					iconButton(h, {
						paths: PIN_PATHS,
						label: pinned ? "Unpin" : "Pin",
						active: pinned,
						filled: pinned,
						onClick: () => handlers.onPin(plugin),
					}),
					hasConfig &&
						iconButton(h, {
							paths: SLIDERS_PATHS,
							label: "Configure",
							disabled: handlers.offline,
							onClick: () => handlers.onConfigure(plugin),
						}),
					renderSwitch(h, {
						checked: plugin.enabled,
						disabled: handlers.busy(`toggle:${plugin.id}`) || !plugin.canToggle,
						label: plugin.name,
						onChange: (enabled) => handlers.onToggle(plugin, enabled),
					}),
				),
			),
			h("div", { className: "uspp-card-desc" }, plugin.description),
		),
		h("div", { className: "uspp-card-separator", "aria-hidden": true }),
		h("div", { className: "uspp-card-footer" }, h("div", { className: "uspp-card-authors" }, authors === "" ? "\u00A0" : authors)),
	);
}

export interface PluginDetailHandlers {
	ui: UiPrimitives;
	button: (ui: UiPrimitives, key: string, label: string, disabled: boolean, onClick: () => void) => unknown;
	toggle: PluginCardHandlers["toggle"];
	busy: PluginCardHandlers["busy"];
	onToggle: PluginCardHandlers["onToggle"];
	onUpdate: PluginCardHandlers["onUpdate"];
	onUninstall: PluginCardHandlers["onUninstall"];
	onReset: () => void;
	fields: unknown[];
	extra: unknown;
	onClose: () => void;
}

export function renderPluginModal(h: H, plugin: PluginRowModel, handlers: PluginDetailHandlers): unknown {
	return h(
		"dialog",
		{
			className: "uspp-modal",
			"data-bgb-plugin-modal": plugin.id,
			ref: (node: unknown) => {
				if (node instanceof HTMLDialogElement && !node.open) {
					try {
						node.showModal();
					} catch {
						/* not in the document yet */
					}
				}
			},
			onClose: handlers.onClose,
			onCancel: (event: unknown) => {
				if (typeof event === "object" && event !== null) {
					const prevent = Reflect.get(event, "preventDefault");
					if (typeof prevent === "function") prevent.call(event);
				}
				handlers.onClose();
			},
		},
		h(
			"button",
			{ type: "button", className: "uspp-btn uspp-btn-icon uspp-modal-close", "aria-label": "Close", onClick: handlers.onClose },
			strokeIcon(h, CLOSE_PATHS, 16),
		),
		h(
			"div",
			{ className: "uspp-modal-header" },
			h("h2", { className: "uspp-modal-title" }, plugin.name),
			h("div", { className: "uspp-modal-subtitle" }, plugin.description),
		),
		h(
			"div",
			{ className: "uspp-modal-body" },
			h("div", { className: "uspp-muted uspp-small", style: { marginBottom: 8 } }, "Authors: ", pluginAuthorsLine(plugin, "Unknown")),
			...handlers.fields,
			handlers.extra,
			handlers.fields.length === 0 && (handlers.extra == null || handlers.extra === false)
				? h("div", { className: "uspp-empty" }, plugin.enabled ? "No configurable settings." : "Enable this plugin to configure it.")
				: false,
		),
		(handlers.fields.length > 0 || plugin.community) &&
			h(
				"div",
				{ className: "uspp-modal-footer" },
				handlers.fields.length > 0 &&
					h("button", { type: "button", className: "uspp-btn uspp-btn-danger", onClick: handlers.onReset }, "Reset"),
				plugin.community &&
					h(
						"button",
						{
							type: "button",
							className: "uspp-btn",
							disabled: handlers.busy(`update:${plugin.id}`),
							onClick: () => handlers.onUpdate(plugin),
						},
						"Update",
					),
				plugin.community &&
					h(
						"button",
						{
							type: "button",
							className: "uspp-btn uspp-btn-danger",
							disabled: handlers.busy(`uninstall:${plugin.id}`),
							onClick: () => handlers.onUninstall(plugin),
						},
						"Uninstall",
					),
			),
	);
}

export function renderPluginGrid(h: H, plugins: readonly PluginRowModel[], handlers: PluginCardHandlers): unknown {
	if (plugins.length === 0) return h("div", { className: "uspp-empty" }, "No plugins match your search.");
	return h("div", { className: "uspp-grid" }, ...plugins.map((plugin) => renderPluginCard(h, plugin, handlers)));
}
