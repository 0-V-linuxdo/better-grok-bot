import type { JsxFn, PluginLogger, ReactLike } from "../sdk/index.ts";

/** Stand-in for any component that cannot be built: renders nothing. */ 
export const NullComponent = (): null => null;

interface BoundaryState {
	failed: boolean;
}

/**
 * Wraps a component in an error boundary built from the app's own React. A crash is sticky for
 * that mounted instance until React remounts it (a new `key`). Do not share a closure flag across
 * instances — that made Settings/plugin UI unrecoverable until process quit.
 */
export function createBoundary(React: ReactLike, jsx: JsxFn, inner: unknown, label: string, log: PluginLogger): unknown {
	class BetterGrokBotBoundary extends React.Component {
		static displayName = label;

		static getDerivedStateFromError(): BoundaryState {
			return { failed: true };
		}

		declare state: BoundaryState;
		private reported = false;

		constructor(props: Record<string, unknown>) {
			super(props);
			this.state = { failed: false };
		}

		componentDidCatch(error: unknown): void {
			if (this.reported) return;
			this.reported = true;
			log.error(`${label} crashed and now renders nothing:`, error);
		}

		render(): unknown {
			const state = this.state as BoundaryState;
			return state.failed ? null : jsx(inner, this.props);
		}
	}

	return BetterGrokBotBoundary;
}

/** `jsx(type, props, key)` on top of `React.createElement`, for callers that have no `jsx` runtime. */
export function jsxFromReact(React: ReactLike): JsxFn {
	return (type, props, key) => React.createElement(type, key === undefined ? props : { ...props, key });
}
