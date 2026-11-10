import { describe, expect, test } from "bun:test";
import { botRow, canEdit, createBotInstructions, pendingSave } from "./runtime.ts";
import type { PluginContext } from "@better-grok-bot/sdk";

describe("botRow", () => {
	test("accepts a bot row and defaults a missing description", () => {
		expect(botRow({ id: "a", name: "A" })?.description).toBe("");
		expect(botRow({ id: "a", name: "A", description: "Be brief." })?.description).toBe("Be brief.");
		expect(botRow({ id: "", name: "A" })).toBeNull();
		expect(botRow(null)).toBeNull();
		expect(botRow({ id: "a" })).toBeNull();
	});
});

describe("canEdit", () => {
	test("owners and managers, not group chats or teammates' bots", () => {
		expect(canEdit({ id: "a", name: "A", description: "" })).toBe(true);
		expect(canEdit({ id: "a", name: "A", description: "", viewerIsOwner: false })).toBe(false);
		expect(canEdit({ id: "a", name: "A", description: "", viewerIsOwner: false, viewerCanManage: true })).toBe(true);
		expect(canEdit({ id: "a", name: "A", description: "", isGroup: true })).toBe(false);
	});
});

describe("pendingSave", () => {
	test("trimmed text when it changed, else null", () => {
		expect(pendingSave("Be brief.", "Be brief.  ")).toBeNull();
		expect(pendingSave("Be brief.", " Answer in Thai. ")).toBe("Answer in Thai.");
		expect(pendingSave("Old", "")).toBe("");
	});
});

describe("row identity", () => {
	test("the inner editor is keyed by bot id", () => {
		const ctx = {
			id: "bot-instructions",
			log: { info() {}, warn() {}, error() {} },
			app: { client: { roster: { updateAgent: async () => {} } }, onClient: () => () => {} },
		} as unknown as PluginContext;
		const React = {
			Component: class {
				props: Record<string, unknown>;
				state: unknown = null;
				constructor(props: Record<string, unknown>) {
					this.props = props;
				}
				setState(state: unknown): void {
					this.state = state;
				}
			},
			Fragment: Symbol("Fragment"),
			createElement(type: unknown, props?: Record<string, unknown> | null): unknown {
				return { type, props: props ?? {} };
			},
			useState: <S>(initial: S | (() => S)): [S, () => void] => [typeof initial === "function" ? (initial as () => S)() : initial, () => {}],
			useRef: <T>(initial: T): { current: T } => ({ current: initial }),
			useEffect() {},
			useMemo: <T>(factory: () => T): T => factory(),
			useCallback: <T>(callback: T): T => callback,
			useSyncExternalStore: <T>(_subscribe: (onChange: () => void) => () => void, getSnapshot: () => T): T => getSnapshot(),
		};
		const jsx = (type: unknown, props: Record<string, unknown>, key?: string) => ({ type, props, key });
		const Editor = createBotInstructions(ctx).Editor({ React, jsx } as never, ctx) as (props: Record<string, unknown>) => { key?: string };
		expect(Editor({ agent: { id: "bot-a", name: "A", description: "" } }).key).toBe("bot-a");
		expect(Editor({ agent: { id: "bot-b", name: "B", description: "" } }).key).toBe("bot-b");
	});
});

