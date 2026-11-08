/**
 * Weekly usage bar in the sidebar footer, directly above Connect Apps.
 *
 * Reuses the app's own usage source: the client's `usageSummary` store (the one behind Settings → Usage,
 * read there through `useSyncExternalStore(client.usageSummary.snapshots…)`), which the app fills from
 * `desktop.getCursorUsageSummary()`. No new fetching: the bar subscribes to that store and asks it to `load()`,
 * which the store itself throttles (it skips reloads within 30 s of the last one).
 */
import type { ComponentFactory, PluginContext } from "@better-grok-bot/sdk";

/** The usage summary fields the bar reads (the app's summary has more). */
export interface UsageSummary {
	sandUsagePercent?: number | null;
	sandUsageResetTimestampMs?: number | null;
	enterpriseTeamId?: string | null;
}

/** A snapshot of the app's usage-summary store. */
export interface UsageSnapshot {
	status?: string;
	value?: UsageSummary | null;
	previous?: UsageSummary | null;
}

interface UsageStore {
	snapshots: { get(): UsageSnapshot; subscribe(listener: () => void): () => void };
	load?: () => void;
}

export type BarView =
	| { kind: "hidden" }
	| { kind: "loading" }
	| {
			kind: "meter";
			percent: number;
			label: string;
			/** Void++ UsageDisplay tones: warning ≥70%, danger ≥90%. */
			tone: "normal" | "warning" | "danger";
			/** Relative reset, shown inline after the percentage ("Resets in 3 days"). */
			resetLabel: string | null;
			/** Exact reset date and time for the hover title; null when unknown or already past. */
			resetTitle: string | null;
			/** Reset epoch for the Void++ live countdown; null when unknown. */
			resetMs: number | null;
	  };

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_SECONDS = 86_400;
/** Void++ ChatBarButton tooltip: delayDuration 100, side top, offset 8. */
const HOVER_DELAY_MS = 100;
/** Void++ UsageDisplay ring. */
const RING_SIZE = 18;
const RING_RADIUS = 7;
const RING_CENTER = RING_SIZE / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
/** How often the mounted bar asks the store to revalidate (the store throttles on its own too). */
const RELOAD_MS = 5 * 60 * 1000;

/** The store's current summary, as Settings → Usage picks it: `value` when ready, else the last good one. */
export function currentSummary(snapshot: UsageSnapshot | undefined): UsageSummary | null {
	if (snapshot === undefined) return null;
	if (snapshot.status === "ready") return snapshot.value ?? null;
	if (snapshot.status === "loading" || snapshot.status === "failed") return snapshot.previous ?? null;
	return null;
}

/** Formats like the app's usage meter: clamped to 0–100, anything in (0, 1) shows as 1%. */
export function formatPercent(percent: number): string {
	const clamped = Number.isFinite(percent) ? Math.min(Math.max(percent, 0), 100) : 0;
	const shown = clamped > 0 && clamped < 1 ? 1 : Math.round(clamped);
	return new Intl.NumberFormat(undefined, { style: "percent" }).format(shown / 100);
}

/** Relative reset wording: whole days rounded up ("Resets in 1 day", "Resets in 3 days"), "Resets soon" once past, null when unknown. */
export function resetLabel(resetMs: number | null | undefined, nowMs: number): string | null {
	if (resetMs == null || !Number.isFinite(resetMs)) return null;
	const remaining = resetMs - nowMs;
	if (remaining <= 0) return "Resets soon";
	const days = Math.ceil(remaining / DAY_MS);
	return days === 1 ? "Resets in 1 day" : `Resets in ${days} days`;
}

const RESET_DATE_FORMAT: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" };

/** Exact reset moment in the user's locale ("Resets Mon, Oct 19, 9:00 AM"), or null when unknown or already past. */
export function resetTitle(resetMs: number | null | undefined, nowMs: number): string | null {
	if (resetMs == null || !Number.isFinite(resetMs) || resetMs <= nowMs) return null;
	return `Resets ${new Intl.DateTimeFormat(undefined, RESET_DATE_FORMAT).format(resetMs)}`;
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** Void++ `formatCountdown`: `m:ss` or `h:mm:ss`. */
export function formatCountdown(totalSeconds: number): string {
	if (totalSeconds <= 0) return "0:00";
	const h = Math.floor(totalSeconds / 3600);
	const m = Math.floor((totalSeconds % 3600) / 60);
	const s = totalSeconds % 60;
	return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
}

/** Void++ UsageDisplay hover: `1d 4:19:00` or `12:05`. */
export function formatResetCountdown(totalSeconds: number): string {
	if (totalSeconds <= 0) return formatCountdown(0);
	const days = Math.floor(totalSeconds / DAY_SECONDS);
	const rest = totalSeconds % DAY_SECONDS;
	return days > 0 ? `${days}d ${formatCountdown(rest)}` : formatCountdown(rest);
}

/** Void++ UsageDisplay: danger ≥90%, warning ≥70%. */
export function usageTone(percent: number | null): "waiting" | "normal" | "warning" | "danger" {
	if (percent === null) return "waiting";
	if (percent >= 90) return "danger";
	if (percent >= 70) return "warning";
	return "normal";
}

export function barView(snapshot: UsageSnapshot | undefined, nowMs: number): BarView {
	const summary = currentSummary(snapshot);
	if (summary === null) {
		const status = snapshot?.status;
		return status === "loading" || status === "idle" ? { kind: "loading" } : { kind: "hidden" };
	}
	// Enterprise seats and plans without an included weekly pool have no percentage; Settings shows no weekly meter either.
	const raw = summary.sandUsagePercent;
	if (summary.enterpriseTeamId != null || raw == null || !Number.isFinite(raw)) return { kind: "hidden" };
	const percent = Math.min(Math.max(raw, 0), 100);
	return {
		kind: "meter",
		percent,
		label: formatPercent(raw),
		tone: percent >= 90 ? "danger" : percent >= 70 ? "warning" : "normal",
		resetLabel: resetLabel(summary.sandUsageResetTimestampMs, nowMs),
		resetTitle: resetTitle(summary.sandUsageResetTimestampMs, nowMs),
		resetMs: summary.sandUsageResetTimestampMs ?? null,
	};
}

function usageStore(client: unknown): UsageStore | undefined {
	if (typeof client !== "object" || client === null) return undefined;
	const store = (client as { usageSummary?: unknown }).usageSummary;
	if (typeof store !== "object" || store === null) return undefined;
	const snapshots = (store as { snapshots?: unknown }).snapshots;
	if (typeof snapshots !== "object" || snapshots === null) return undefined;
	const { get, subscribe } = snapshots as { get?: unknown; subscribe?: unknown };
	if (typeof get !== "function" || typeof subscribe !== "function") return undefined;
	return store as UsageStore;
}

const noop = (): void => {};

function createWeeklyUsage(ctx: PluginContext) {
	const subscribeClient = (onChange: () => void): (() => void) => ctx.app.onClient(onChange);
	const readClient = (): unknown => ctx.app.client;

	/** Composer trailing ring (Void++ UsageDisplay trigger). Hover is the WeekBlock panel, not a native title. */
	const ComposerRing: ComponentFactory = ({ React, jsx }) =>
		function WeeklyUsageRing() {
			const client = React.useSyncExternalStore(subscribeClient, readClient);
			const store = usageStore(client);
			const subscribe = React.useCallback(
				(onChange: () => void) => (store === undefined ? noop : store.snapshots.subscribe(onChange)),
				[store],
			);
			const snapshot = React.useSyncExternalStore(subscribe, () => store?.snapshots.get());
			const [open, setOpen] = React.useState(false);
			const [nowMs, setNowMs] = React.useState(() => Date.now());
			const delayRef = React.useRef(0);
			React.useEffect(() => {
				if (store?.load === undefined) return;
				const load = (): void => {
					try {
						store.load?.();
					} catch (error) {
						ctx.log.warn("usage summary load failed", error);
					}
				};
				load();
				const timer = setInterval(load, RELOAD_MS);
				return () => clearInterval(timer);
			}, [store]);
			React.useEffect(() => {
				if (!open) return;
				setNowMs(Date.now());
				const timer = setInterval(() => setNowMs(Date.now()), 1000);
				return () => clearInterval(timer);
			}, [open]);
			React.useEffect(() => () => window.clearTimeout(delayRef.current), []);

			const view = barView(snapshot, nowMs);
			if (view.kind === "hidden") return null;
			const loading = view.kind === "loading";
			const percent = loading ? null : view.percent;
			const fraction = percent === null ? 0 : percent / 100;
			const tone = loading ? "waiting" : view.tone;
			const reset = loading ? null : view.resetLabel;
			const resetMs = loading ? null : view.resetMs;
			const used = loading ? "…" : `${view.label} used`;
			const left = resetMs == null ? 0 : Math.max(0, Math.ceil((resetMs - nowMs) / 1000));
			const show = (): void => {
				window.clearTimeout(delayRef.current);
				delayRef.current = window.setTimeout(() => setOpen(true), HOVER_DELAY_MS);
			};
			const hide = (): void => {
				window.clearTimeout(delayRef.current);
				setOpen(false);
			};
			const panel =
				open && !loading
					? jsx(
							"div",
							{
								className: "bgb-weekly-usage__panel",
								role: "tooltip",
								children: [
									jsx("div", { className: "bgb-weekly-usage__used", children: used }, "used"),
									resetMs == null
										? null
										: jsx("div", { className: "bgb-weekly-usage__reset", children: `Resets in ${formatResetCountdown(left)}` }, "reset"),
								],
							},
							"panel",
						)
					: null;
			return jsx("button", {
				type: "button",
				className: "bgb-weekly-usage",
				"data-tone": tone,
				"data-open": open || undefined,
				"aria-label": loading ? "Weekly usage, loading" : `Weekly usage ${view.label}${reset === null ? "" : `, ${reset.toLowerCase()}`}`,
				"aria-valuemin": 0,
				"aria-valuemax": 100,
				"aria-valuenow": loading ? undefined : percent,
				"aria-busy": loading || undefined,
				onMouseEnter: show,
				onMouseLeave: hide,
				onFocus: () => setOpen(true),
				onBlur: hide,
				children: [
					jsx(
						"svg",
						{
							width: RING_SIZE,
							height: RING_SIZE,
							viewBox: `0 0 ${RING_SIZE} ${RING_SIZE}`,
							className: "bgb-weekly-usage__ring",
							"aria-hidden": true,
							children: [
								jsx("circle", { cx: RING_CENTER, cy: RING_CENTER, r: RING_RADIUS, className: "bgb-weekly-usage__ring-track" }, "track"),
								jsx(
									"circle",
									{
										cx: RING_CENTER,
										cy: RING_CENTER,
										r: RING_RADIUS,
										className: "bgb-weekly-usage__ring-fill",
										strokeDasharray: RING_CIRCUMFERENCE,
										strokeDashoffset: RING_CIRCUMFERENCE * (1 - fraction),
										transform: `rotate(-90 ${RING_CENTER} ${RING_CENTER})`,
									},
									"fill",
								),
							],
						},
						"ring",
					),
					panel,
				],
			});
		};

	return { ComposerRing };
}

globalThis.BetterGrokBot?.define("weekly-usage", createWeeklyUsage);
