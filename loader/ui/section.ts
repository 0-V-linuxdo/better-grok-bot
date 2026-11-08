import {
	isValidSettingValue,
	type BridgeMethod,
	type BridgeMethods,
	type BuildManifest,
	type PluginLogger,
	type PluginSettings,
	type PluginStatus,
	type ReactLike,
	type SettingField,
	type SettingValue,
	type UiPrimitives,
} from "../../sdk/index.ts";
import { describeError } from "../logger.ts";
import { jsxFromReact } from "../boundary.ts";
import type { LoaderStore } from "../store.ts";
import { createH } from "./h.ts";
import {
	filterPlugins,
	injectCardsCss,
	renderPluginGrid,
	renderPluginModal,
	renderSwitch,
	wrapSettingsPane,
} from "./cards.ts";
import { BGB_PLUGINS_TAB, BGB_SETTINGS_TAB, BGB_THEMES_TAB } from "./shell.ts";
import {
	buildPluginRows,
	buildThemeRows,
	consentConfirmMessage,
	INPUT_STYLE,
	installConfirmMessage,
	showReloadButton,
	statusDescription,
	type PluginRowModel,
} from "./model.ts";

export interface SectionDeps {
	store: LoaderStore;
	request<M extends BridgeMethod>(method: M, params: BridgeMethods[M]["params"]): Promise<BridgeMethods[M]["result"]>;
	refreshStatus(): Promise<void>;
	manifest: BuildManifest;
	/** `BetterGrokBot.status()`: this page's runtime failures. */
	localStatus(): PluginStatus[];
	settingsFor(id: string, fields: Readonly<Record<string, SettingField>>): PluginSettings;
	reload(): void;
	confirm(message: string): boolean;
	log: PluginLogger;
}

interface SettingRowProps {
	ui: UiPrimitives;
	settings: PluginSettings;
	name: string;
	field: SettingField;
	disabled: boolean;
}

interface InstallRowProps {
	ui: UiPrimitives;
	disabled: boolean;
}

/** `currentTarget.value` of a React input event. */
function inputValue(event: unknown): string | undefined {
	const target = typeof event === "object" && event !== null ? Reflect.get(event, "currentTarget") : undefined;
	return target instanceof HTMLInputElement ? target.value : undefined;
}

/** The `bgb-settings` hook validated `ui` before rendering the section. */
export interface SectionProps {
	ui: UiPrimitives;
	tab?: string;
}

/** Custom settings components previously injected into Settings → General → System. */
const EXTRA_SETTINGS: Record<string, string> = {
	"output-device": "SpeakerRow",
	"push-to-talk": "SettingsRows",
	"startup": "SettingsRows",
	"voice-keepalive": "SettingsRow",
	"voice-mcp": "SettingsRow",
};

function readIdList(key: string): string[] {
	try {
		const raw = globalThis.localStorage?.getItem(key);
		const parsed: unknown = raw === null || raw === undefined ? [] : JSON.parse(raw);
		return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
	} catch {
		return [];
	}
}

function writeIdList(key: string, ids: readonly string[]): void {
	try {
		globalThis.localStorage?.setItem(key, JSON.stringify(ids));
	} catch {
		/* quota / private mode */
	}
}

function toggleId(list: readonly string[], id: string, front: boolean): string[] {
	if (list.includes(id)) return list.filter((item) => item !== id);
	return front ? [id, ...list] : [...list, id];
}

/**
 * Builds the "Better Grok Bot" pane of Settings from the app's React and its own
 * settings primitives (`ui.Section/Row/Toggle/Select/Button`). With the agent disconnected every
 * control is disabled except "Reload to apply", which reloads locally.
 */
export function createBgbSection(React: ReactLike, deps: SectionDeps): (props: SectionProps) => unknown {
	const h = createH(React);
	const jsx = jsxFromReact(React);
	const { store, manifest } = deps;

	/** Runs a user action: its controls stay disabled meanwhile; a failure or a returned message shows in the status row. */
	const run = (action: string, task: () => Promise<string | void>): void => {
		store.setBusy(action, true);
		task()
			.then(
				(message) => store.setNotice(message ?? null),
				(error: unknown) => {
					deps.log.warn(`${action} failed: ${describeError(error)}`);
					store.setNotice(describeError(error));
				},
			)
			.finally(() => store.setBusy(action, false));
	};

	const row = (ui: UiPrimitives, key: string, label: string, description: string, ...children: unknown[]): unknown =>
		h(ui.Row, { key, label, description, variant: "card" }, ...children);

	const toggle = (ui: UiPrimitives, label: string, isChecked: boolean, isDisabled: boolean, onToggle: (next: boolean) => void): unknown =>
		h(ui.Toggle, {
			isChecked,
			isDisabled,
			label,
			onToggle: (next: unknown) => {
				if (typeof next === "boolean") onToggle(next);
			},
			size: "md",
		});

	const button = (ui: UiPrimitives, key: string, label: string, disabled: boolean, onClick: () => void): unknown =>
		h(ui.Button, { key, disabled, onClick, size: "md", style: ui.textStyles.body2, type: "button", variant: "secondary" }, label);

	const group = (...children: unknown[]): unknown =>
		h("div", { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" } }, ...children);

	const updatePlugin = async (plugin: PluginRowModel): Promise<string> => {
		const result = await deps.request("plugins.update", { id: plugin.id });
		if (result.state === "current") return `${plugin.name} is up to date`;
		if (result.state === "updated") return `${plugin.name} updated to ${result.version}`;
		if (!deps.confirm(consentConfirmMessage(plugin.name, result.version, result.added))) return `${plugin.name} was not updated`;
		const acceptPermissions = [...new Set([...plugin.granted, ...result.added])];
		await deps.request("plugins.install", { inspectionId: result.inspectionId, acceptPermissions });
		return `${plugin.name} updated to ${result.version}`;
	};

	function SettingRow({ ui, settings, name, field, disabled }: SettingRowProps): unknown {
		const subscribe = React.useCallback((onChange: () => void) => settings.subscribe(name, onChange), [settings, name]);
		const value = React.useSyncExternalStore(subscribe, () => settings.get(name));
		const [draft, setDraft] = React.useState<string | null>(null);
		const [recording, setRecording] = React.useState(false);

		const set = (next: SettingValue): void => {
			try {
				settings.set(name, next);
			} catch (error) {
				deps.log.warn(`setting "${name}" rejected ${JSON.stringify(next)}: ${describeError(error)}`);
			}
		};

		React.useEffect(() => {
			if (!recording) return;
			const onKey = (event: KeyboardEvent): void => {
				event.preventDefault();
				event.stopPropagation();
				if (event.repeat) return;
				if (event.code !== "" && event.code !== "Escape") set(event.code);
				setRecording(false);
			};
			const cancel = (): void => setRecording(false);
			window.addEventListener("keydown", onKey, true);
			window.addEventListener("blur", cancel);
			return () => {
				window.removeEventListener("keydown", onKey, true);
				window.removeEventListener("blur", cancel);
			};
		}, [recording]);

		let control: unknown;
		switch (field.type) {
			case "boolean":
				control = toggle(ui, field.label, value === true, disabled, set);
				break;
			case "select":
				control = h(ui.Select, {
					"aria-label": field.label,
					disabled,
					onValueChange: (next: unknown) => {
						if (typeof next === "string") set(next);
					},
					options: field.options,
					placement: "bottom-end",
					size: "lg",
					value,
				});
				break;
			case "number":
			case "string":
				control = h("input", {
					"aria-label": field.label,
					disabled,
					max: field.type === "number" ? field.max : undefined,
					min: field.type === "number" ? field.min : undefined,
					step: field.type === "number" ? field.step : undefined,
					placeholder: field.type === "string" ? field.placeholder : undefined,
					onBlur: () => setDraft(null),
					onChange: (event: unknown) => {
						const text = inputValue(event);
						if (text === undefined) return;
						setDraft(text);
						const next = field.type === "number" ? (text.trim() === "" ? Number.NaN : Number(text)) : text;
						if (isValidSettingValue(field, next)) set(next);
					},
					style: INPUT_STYLE,
					type: field.type === "number" ? "number" : "text",
					value: draft ?? String(value),
				});
				break;
			case "key":
				control = button(ui, "key", recording ? "Press a key…" : String(value), disabled, () => setRecording((previous) => !previous));
				break;
		}
		const description = recording ? "Press the key to use. Esc cancels." : (field.description ?? "");
		return h(ui.Row, { label: field.label, description, variant: "card" }, control);
	}

	function InstallRow({ ui, disabled }: InstallRowProps): unknown {
		const [source, setSource] = React.useState("");
		const [message, setMessage] = React.useState<string | null>(null);
		const [working, setWorking] = React.useState(false);

		const install = (): void => {
			const trimmed = source.trim();
			if (trimmed === "" || working) return;
			setWorking(true);
			setMessage("Checking the plugin…");
			const task = async (): Promise<string> => {
				const inspected = await deps.request("plugins.inspect", { source: trimmed });
				if (!deps.confirm(installConfirmMessage(inspected))) return `${inspected.name} was not installed`;
				setMessage(`Installing ${inspected.name}…`);
				await deps.request("plugins.install", { inspectionId: inspected.inspectionId, acceptPermissions: inspected.permissions });
				setSource("");
				await deps.refreshStatus().catch(() => undefined);
				return `Installed ${inspected.name} ${inspected.version}; reload to apply once the rebuild finishes`;
			};
			task()
				.then(setMessage, (error: unknown) => setMessage(`Install failed: ${describeError(error)}`))
				.finally(() => setWorking(false));
		};

		return h(
			ui.Row,
			{
				label: "Install plugin",
				description: message ?? "A .bgbplugin link, github:owner/repo, or a plugin file or folder on this computer.",
				variant: "card",
			},
			group(
				h("input", {
					"aria-label": "Plugin source",
					disabled: disabled || working,
					onChange: (event: unknown) => {
						const text = inputValue(event);
						if (text !== undefined) setSource(text);
					},
					onKeyDown: (event: unknown) => {
						if (typeof event === "object" && event !== null && Reflect.get(event, "key") === "Enter") install();
					},
					placeholder: "https://… or github:owner/repo",
					style: { ...INPUT_STYLE, width: "18em" },
					type: "text",
					value: source,
				}),
				button(ui, "install", "Install", disabled || working || source.trim() === "", install),
			),
		);
	}

	return function BgbSection({ ui, tab = BGB_SETTINGS_TAB.id }: SectionProps): unknown {
		React.useEffect(() => injectCardsCss(globalThis.document), []);
		const snapshot = React.useSyncExternalStore(store.subscribe, store.getSnapshot);
		const [openKey, setOpenKey] = React.useState<string | null>(null);
		const [query, setQuery] = React.useState("");
		const [cat, setCat] = React.useState<"favorites" | "all">("all");
		const [filter, setFilter] = React.useState<"all" | "enabled" | "disabled">("all");
		const [starred, setStarred] = React.useState<string[]>(() => readIdList("bgb:starred-plugins"));
		const [pinned, setPinned] = React.useState<string[]>(() => readIdList("bgb:pinned-plugins"));
		const offline = snapshot.bridge !== "connected";
		const busy = (action: string): boolean => offline || snapshot.busy.includes(action);
		const status = snapshot.status;
		const update = snapshot.update;

		const statusRow = row(
			ui,
			"status",
			`Better Grok Bot ${manifest.bgbVersion}`,
			statusDescription(snapshot, manifest),
			group(
				showReloadButton(snapshot) && button(ui, "reload", "Reload to apply", false, () => deps.reload()),
				update?.state === "available" &&
					button(ui, "update", `Update to ${update.latest ?? "the latest version"}`, busy("update"), () =>
						run("update", async () => {
							await deps.request("update.apply", {});
							return "Installing the update…";
						}),
					),
			),
		);

		const settingRow = (key: "openAtLogin" | "autoUpdate", label: string, description: string): unknown =>
			row(
				ui,
				key,
				label,
				description,
				toggle(ui, label, status?.settings[key] ?? false, busy(key) || status === null, (value) =>
					run(key, async () => {
						await deps.request("settings.set", { key, value });
						await deps.refreshStatus();
					}),
				),
			);

		const plugins = buildPluginRows(status?.plugins ?? null, manifest.plugins, deps.localStatus());
		const extraFor = (plugin: PluginRowModel): unknown => {
			const name = EXTRA_SETTINGS[plugin.id];
			if (!plugin.enabled || name === undefined) return false;
			const Extra = globalThis.BetterGrokBot?.component(plugin.id, name, {
				React,
				jsx,
				Row: ui.Row,
				Toggle: ui.Toggle,
				Select: ui.Select,
				Button: ui.Button,
				buttonTextStyle: ui.textStyles.body2,
			});
			return Extra != null && h(Extra, { key: `extra:${plugin.id}` });
		};
		const fieldsFor = (plugin: PluginRowModel): unknown[] =>
			Object.entries(plugin.settings).map(([name, field]) =>
				h(SettingRow, {
					key: `setting:${plugin.id}:${name}`,
					ui,
					settings: deps.settingsFor(plugin.id, plugin.settings),
					name,
					field,
					disabled: offline,
				}),
			);
		const cardHandlers = {
			ui,
			extra: EXTRA_SETTINGS,
			offline,
			busy,
			toggle,
			button,
			onToggle: (plugin: PluginRowModel, enabled: boolean) => {
				run(`toggle:${plugin.id}`, () => deps.request("plugins.setEnabled", { id: plugin.id, enabled }).then(() => undefined));
			},
			onUpdate: (plugin: PluginRowModel) => {
				run(`update:${plugin.id}`, () => updatePlugin(plugin));
			},
			onUninstall: (plugin: PluginRowModel) => {
				if (!deps.confirm(`Uninstall ${plugin.name}?`)) return;
				run(`uninstall:${plugin.id}`, async () => {
					await deps.request("plugins.uninstall", { id: plugin.id });
					return `Uninstalled ${plugin.name}`;
				});
			},
			onConfigure: (plugin: PluginRowModel) => setOpenKey(plugin.key),
			starred,
			pinned,
			onStar: (plugin: PluginRowModel) => {
				const next = toggleId(starred, plugin.id, false);
				setStarred(next);
				writeIdList("bgb:starred-plugins", next);
			},
			onPin: (plugin: PluginRowModel) => {
				const next = toggleId(pinned, plugin.id, true);
				setPinned(next);
				writeIdList("bgb:pinned-plugins", next);
			},
		};
		const open = plugins.find((plugin) => plugin.key === openKey);
		let visible = filterPlugins(plugins, query, filter);
		if (cat === "favorites") visible = visible.filter((plugin) => starred.includes(plugin.id));
		if (cat === "all" || cat === "favorites") {
			const pinnedVisible = pinned.map((id) => visible.find((plugin) => plugin.id === id)).filter((plugin): plugin is PluginRowModel => plugin !== undefined);
			const rest = visible.filter((plugin) => !pinned.includes(plugin.id));
			visible = [...pinnedVisible, ...rest];
		}
		const pluginPane = h(
			"div",
			{ className: "uspp-page", "data-uspp-page": "plugins" },
			renderPluginGrid(h, visible, cardHandlers),
			open !== undefined &&
				renderPluginModal(h, open, {
					ui,
					button,
					toggle,
					busy,
					onToggle: cardHandlers.onToggle,
					onUpdate: cardHandlers.onUpdate,
					onUninstall: cardHandlers.onUninstall,
					onReset: () => {
						const settings = deps.settingsFor(open.id, open.settings);
						for (const { name, field } of open.fields) settings.set(name, field.default);
					},
					fields: fieldsFor(open),
					extra: extraFor(open),
					onClose: () => setOpenKey(null),
				}),
		);
		const pluginSticky = h(
			"div",
			{ className: "uspp-sticky-inner" },
			h(
				"div",
				{ className: "uspp-tabs", role: "tablist" },
				...(
					[
						["favorites", "Favorites"],
						["all", "All"],
					] as const
				).map(([id, label]) =>
					h(
						"button",
						{
							key: id,
							type: "button",
							role: "tab",
							className: "uspp-chip",
							"aria-selected": String(cat === id),
							onClick: () => setCat(id),
						},
						label,
					),
				),
			),
			h(
				"div",
				{ className: "uspp-toolbar" },
				h("input", {
					type: "search",
					className: "uspp-input",
					placeholder: `Search ${plugins.length} plugins...`,
					value: query,
					"aria-label": "Search plugins",
					onChange: (event: unknown) => {
						const text = inputValue(event);
						if (text !== undefined) setQuery(text);
					},
				}),
				h(
					"select",
					{
						className: "uspp-select",
						"aria-label": "Filter",
						value: filter,
						onChange: (event: unknown) => {
							const target = typeof event === "object" && event !== null ? Reflect.get(event, "currentTarget") : undefined;
							if (target instanceof HTMLSelectElement && (target.value === "all" || target.value === "enabled" || target.value === "disabled")) {
								setFilter(target.value);
							}
						},
					},
					h("option", { value: "all" }, "All"),
					h("option", { value: "enabled" }, "Enabled"),
					h("option", { value: "disabled" }, "Disabled"),
				),
			),
		);

		const themeCards = buildThemeRows(status?.themes ?? null, manifest.themes).map((theme) =>
			h(
				"div",
				{ className: "uspp-card", "data-bgb-theme": theme.id, key: theme.id },
				h(
					"div",
					{ className: "uspp-card-head" },
					h("span", { className: "uspp-card-name" }, theme.label),
					h(
						"div",
						{ className: "uspp-card-controls" },
						renderSwitch(h, {
							checked: theme.enabled,
							disabled: busy(`theme:${theme.id}`) || !theme.valid,
							label: theme.label,
							onChange: (enabled) =>
								run(`theme:${theme.id}`, () => deps.request("themes.setEnabled", { id: theme.id, enabled }).then(() => undefined)),
						}),
					),
				),
				h("div", { className: "uspp-card-desc" }, theme.description),
			),
		);

		const openFolder = (target: "plugins" | "themes" | "logs", label: string): unknown =>
			button(ui, target, label, busy("open"), () => run("open", () => deps.request("system.openPath", { target }).then(() => undefined)));

		if (tab === BGB_PLUGINS_TAB.id) {
			return wrapSettingsPane(h, pluginPane, pluginSticky);
		}
		if (tab === BGB_THEMES_TAB.id) {
			return wrapSettingsPane(
				h,
				h(
					"div",
					{ className: "uspp-page", "data-uspp-page": "themes" },
					h(
						"div",
						{ className: "uspp-toolbar" },
						h(
							"button",
							{ type: "button", className: "uspp-btn", disabled: busy("open"), onClick: () => run("open", () => deps.request("system.openPath", { target: "themes" }).then(() => undefined)) },
							"Open themes folder",
						),
					),
					themeCards.length > 0
						? h("div", { className: "uspp-grid" }, ...themeCards)
						: h("div", { className: "uspp-empty" }, "No themes installed."),
				),
			);
		}
		return wrapSettingsPane(
			h,
			h(
				ui.Section,
				{ title: "Better Grok Bot" },
				statusRow,
				settingRow("openAtLogin", "Open Grok Bot at login", "Starts Grok Bot when you log in to this computer."),
				settingRow("autoUpdate", "Install Better Grok Bot updates automatically", "Checks for new versions every few hours."),
				h(InstallRow, { key: "install", ui, disabled: offline }),
				row(
					ui,
					"folders",
					"Open folder",
					"Add theme files to the themes folder; logs help when something breaks.",
					group(openFolder("plugins", "Plugins"), openFolder("themes", "Themes"), openFolder("logs", "Logs")),
				),
			),
		);
	};
}
