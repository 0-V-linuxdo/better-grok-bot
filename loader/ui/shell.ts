import type { ReactLike } from "../../sdk/index.ts";
import { injectCardsCss } from "./cards.ts";
import { createH } from "./h.ts";

export interface SettingsTab {
	id: string;
	label: unknown;
	icon: string;
	anchor: string;
}

/** All extra tabs share `anchor: "general"` — heading-link `ML` throws on unknown keys. */
const ANCHOR = "general";

export const BGB_SETTINGS_TAB: SettingsTab = {
	id: "bgb",
	label: "Better Grok Bot",
	icon: "robot",
	anchor: ANCHOR,
};

export const BGB_PLUGINS_TAB: SettingsTab = {
	id: "bgb-plugins",
	label: "Plugins",
	icon: "puzzle-piece",
	anchor: ANCHOR,
};

export const BGB_THEMES_TAB: SettingsTab = {
	id: "bgb-themes",
	label: "Themes",
	icon: "sparkle",
	anchor: ANCHOR,
};

export const BGB_TABS: readonly SettingsTab[] = [BGB_SETTINGS_TAB, BGB_PLUGINS_TAB, BGB_THEMES_TAB];

const BGB_IDS = new Set(BGB_TABS.map((tab) => tab.id));

export function isBgbSettingsTab(id: string): boolean {
	return BGB_IDS.has(id);
}

export interface ShellProps {
	Layout: unknown;
	activeSection: SettingsTab;
	sections: SettingsTab[];
	onSelectSection: (section: SettingsTab) => void;
	children: unknown;
	[rest: string]: unknown;
}

/**
 * Native nav + a Userscript++ group: divider, then Better Grok Bot / Plugins / Themes.
 * Selecting those must not call `entrypoint.link()`.
 */
export function createSettingsShell(React: ReactLike, renderPane: (tabId: string) => unknown): (props: ShellProps) => unknown {
	const h = createH(React);
	return function SettingsShell(props: ShellProps): unknown {
		const { Layout, jsx: _jsx, activeSection, sections, onSelectSection, children, ...rest } = props;
		React.useEffect(() => injectCardsCss(globalThis.document), []);
		const [page, setPage] = React.useState<string | null>(null);
		const onSelect = (section: SettingsTab): void => {
			if (isBgbSettingsTab(section.id)) {
				setPage(section.id);
				return;
			}
			setPage(null);
			onSelectSection(section);
		};
		const current = BGB_TABS.find((tab) => tab.id === page);
		const pane = current === undefined ? null : renderPane(current.id);
		return h(Layout, {
			...rest,
			activeSection: current ?? activeSection,
			sections: [...sections, ...BGB_TABS],
			onSelectSection: onSelect,
			children:
				current === undefined ? children : h(React.Fragment, null, h("div", { hidden: true, "aria-hidden": true }, children), pane),
		});
	};
}
