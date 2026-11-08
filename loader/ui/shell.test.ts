import { expect, test } from "bun:test";
import type { ReactLike } from "../../sdk/index.ts";
import { createFakeReact, type FakeElement } from "../test/fakes.ts";
import { BGB_PLUGINS_TAB, BGB_SETTINGS_TAB, BGB_TABS, createSettingsShell } from "./shell.ts";

function statefulReact(): ReactLike {
	const react = createFakeReact();
	let slot: unknown;
	let inited = false;
	react.useState = <S>(initial: S | (() => S)): [S, (next: S | ((previous: S) => S)) => void] => {
		if (!inited) {
			slot = typeof initial === "function" ? (initial as () => S)() : initial;
			inited = true;
		}
		return [
			slot as S,
			(next) => {
				slot = typeof next === "function" ? (next as (previous: S) => S)(slot as S) : next;
			},
		];
	};
	return react;
}

test("the BGB tab reuses a native heading-link anchor so OL[anchor].label does not throw", () => {
	// pane-header always renders heading-link with `anchor: r.anchor`. That looks
	// up AL/OL in eager-app (`ML`); unknown keys throw
	// `Cannot read properties of undefined (reading 'label')` and the native
	// overlay error boundary eats Settings.
	expect(BGB_TABS.every((tab) => tab.anchor === "general")).toBe(true);
	expect(BGB_TABS.map((tab) => tab.id)).toEqual(["bgb", "bgb-plugins", "bgb-themes"]);
	expect(BGB_SETTINGS_TAB.icon).toBe("robot");
	expect(BGB_PLUGINS_TAB.icon).toBe("puzzle-piece");
});

test("the shell appends a Better Grok Bot tab and keeps native children until it is selected", () => {
	const Shell = createSettingsShell(statefulReact(), () => "pane");
	const native = { id: "general", label: { id: "Weq9zb" }, icon: "settings-gear", anchor: "general" };
	const selected: unknown[] = [];
	const props = {
		Layout: "Layout",
		activeSection: native,
		sections: [native],
		onSelectSection: (section: unknown) => selected.push(section),
		children: "general-pane",
		onClose: () => {},
	};
	const first = Shell(props) as FakeElement;
	expect(first.type).toBe("Layout");
	expect(first.props.sections).toEqual([native, ...BGB_TABS]);
	expect(first.props.activeSection).toBe(native);
	expect(first.props.children).toBe("general-pane");

	(first.props.onSelectSection as (section: unknown) => void)(BGB_SETTINGS_TAB);
	expect(selected).toEqual([]);
	const second = Shell(props) as FakeElement;
	expect(second.props.activeSection).toBe(BGB_SETTINGS_TAB);
	const wrap = second.props.children as FakeElement;
	const kids = wrap.props.children as FakeElement[];
	expect(Array.isArray(kids)).toBe(true);
	expect(kids[0]?.props.hidden).toBe(true);
	expect(kids[0]?.props.children).toBe("general-pane");
	expect(kids[1]).toBe("pane" as unknown as FakeElement);

	(second.props.onSelectSection as (section: unknown) => void)(BGB_PLUGINS_TAB);
	expect(selected).toEqual([]);
	expect((Shell(props) as FakeElement).props.activeSection).toBe(BGB_PLUGINS_TAB);

	(second.props.onSelectSection as (section: unknown) => void)(native);
	expect(selected).toEqual([native]);
	const third = Shell(props) as FakeElement;
	expect(third.props.activeSection).toBe(native);
	expect(third.props.children).toBe("general-pane");
});
