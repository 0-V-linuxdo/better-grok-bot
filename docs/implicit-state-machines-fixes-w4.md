# Correction plan: leftover implicit machines (after W0–3)

Companion to `docs/implicit-state-machines.md` § Needs further thought. W0–3 already landed; this is the next 10. Industry analogs, then a BGB-shaped fix. Not XState — keep flag/queue style.

**W4–6 landed** (2026-11-10).

## Waves

| Wave | When | Items |
| --- | --- | --- |
| **4** | User-visible leftovers of W0–1 | 2 UI `create([])` · 3 cards never `loading` · 4 `NullComponent` cache · 7 bot-instructions row |
| **5** | Races leftover of W2 | 1 `sidebar.execute` new UUID · 5 PTT owed generation · 6 helper given-up self-arm |
| **6** | Native / storage | 8 macOS tapEnable order · 9 MCP session vs report · 10 storage split-brain |

Do not reopen W0–3 holes (rename abort, process-global boundary, timer as second `response.create`, doctor swapping `bin/`).

---

## 1. `sidebar.execute` always mints a new `requestId`

**Now:** Renderer replays an identical `requestId`. `methods.ts` still `crypto.randomUUID()` per RPC; the method accepts only `command` + `rendererConnectionId`. MCP `invoke` cannot pass a key. Timeout is still `{outcome:"unknown"}`. A retry of `bgb_create_folder` / move / delete is a new intent.

**Industry:** The client generates the idempotency key and **supplies it on every attempt**, including retries across separate SDK calls.[1] On network timeout you do not know if the POST ran; retry with the **same** key and parameters, or **reconcile** (GET) before a new key. A new key can start a second operation.[2]

**Fix (wave 5):**

1. Allow optional `requestId` on `sidebar.execute` (string, non-empty). Default remains a fresh UUID for callers that do not care.
2. MCP mutating tools (`bgb_create_folder`, move, delete) take optional `requestId` in the tool args and forward it. Lists stay keyless.
3. Timeout path: do **not** auto-retry with a new key. Return unknown + “list then retry with the same `requestId`”.
4. Keep renderer LRU replay as the server-side cache of the first result.

**Files:** `core/bridge/methods.ts`, `core/mcp-sidebar.ts`, `sdk/bridge.ts`

**Test:** two `sidebar.execute` with the same `requestId` hit `requestSidebar` once; MCP create without `requestId` still works.

**Not doing:** JSON-RPC `id` as the idempotency key (it only correlates a response). Blind retry with a new UUID.

---

## 2. UI `+` still `create([])` then overlay

**Now:** W0 put UI create on the `commands` mutex and made the **name** `persistEdit`. Optimistic `create([])` is still a second writer vs agent `create-folder` (one owned write). Esc leaves “New folder”.

**Industry:** VS Code untitled buffers exist until save; closing without save discards — they are not a second writer off the workspace API.[12] Finder commits a real “untitled folder” on create. One product, one store.

**Fix (wave 4):** Pick **one** and test it:

1. **Preferred:** wrap the UI create in the same `persistEdit` as agent `create-folder` (create + default name in one owned write). Overlay still opens for rename; Enter is a second `persistEdit` rename. Esc on a folder that was never renamed: `delete-folder` via `enqueueUi` (VS Code close-untitled).
2. Alternative (Finder): keep optimistic `create([])`, accept leftover “New folder” as the committed default. Document it. Do not add a third writer.

**Files:** `plugins/sidebar-folders/runtime.ts` (`createFolder`)

**Test:** Esc after `+` with no Enter → folder gone (preferred) or named “New folder” (alternative) — never a row that `list-folders` then misses.

---

## 3. Settings cards never show `loading`

**Now:** `BetterGrokBot.status()` overlays `loading` until `define()`. Cards use agent `status.get` then the disk manifest (neither is ever `loading`). Local overlay is only `runtime-failed`. Toggle stays on during the gap.

**Industry:** VS Code `Extension.isActive` is true only after `activate()` has run; `activate()` is a Thenable, invoked **once** when an activation event fires.[3][4] Contributions can appear before activate; the extension is not “active” during that wait.

**Fix (wave 4):**

1. Overlay local `BetterGrokBot.status()` `loading` the same way `runtime-failed` is overlaid (`buildPluginRows` `local` argument).
2. `canToggle` already false for `loading`; cards already have “Starting…”. Agent `active` + local `loading` → show Starting…, disable toggle.
3. Do not write `loading` into the build manifest.

**Files:** `loader/ui/model.ts`, `loader/ui/section.ts`

**Test:** agent says `active`, local `status()` says `loading` → row `canToggle: false`, description contains Starting….

---

## 4. `component()` caches `NullComponent` once React exists

**Now:** Missing React is uncached (retry). After React, a not-yet-defined plugin or factory miss is cached for the page lifetime. A later `define()` cannot recover without reload.

**Industry:** VS Code invokes `activate()` only once; a failed activation stays failed until window reload.[4] That is correct for a **thrown** factory. It is wrong for “script has not run yet” — that is still the activation wait, not a failure.

**Fix (wave 4):**

1. Do **not** cache `NullComponent` when the plugin is not in `defined` yet (same as missing React).
2. Cache `NullComponent` only after a factory throw or “export is not a function” **after** `define()`.
3. Successful factories stay cached as the boundary class.

**Files:** `loader/runtime.ts`

**Test:** `component()` before `define()` with React present returns `NullComponent` uncached; after `define()` the real component is cached.

---

## 5. PTT owed leftovers

**Now:** Timer is warn-only (W2). No generation: two commits before `response.created` each send `create` (`inFlight` is only set on created); `startTurn` / `response.created` `settleOwed(false)` can drop a deferred create; timer does not give up, so a later unrelated `done` can still create.

**Industry:** OpenAI Realtime: `response.cancel` is safe if nothing is in progress (error, session stays up). After cancel, wait for `response.done` (`cancelled` | `completed` | error), then **one** `response.create`. Client `event_id` identifies the event; `response_id` identifies which response to cancel.[5] Do not treat “someone else’s `created`” as covering an owed turn without matching ids.

**Fix (wave 5):**

```
generation++ on every press that starts a turn
owed = { generation } on cancel-while-in-flight
on done|cancelled: create once iff owed.generation === current, then clear
response.created: set inFlight; do not drop owed unless its generation is already covered
timer: log + clear owed (give up), still never create
```

Set `responseInFlight = true` when **sending** `response.create`, not only on `created` (prevents dual-create before ack). Keep cancel-is-safe.

**Files:** `plugins/push-to-talk/runtime.ts`

**Test:** two commits before `created` → one create; barge-in after owed → no create for the abandoned generation; timer fire → no create, later `done` no create.

---

## 6. Helper given-up does not self-arm

**Now:** Clock + `wanted` 0→1 work if something calls `ensureRunning`. No restart timer after give-up. `doctor --repair` was planned and is absent. Darwin is still launchd (leave it).

**Industry:** systemd `StartLimitBurst` / `StartLimitIntervalSec`: more than *burst* starts in *interval* are not permitted.[6] Hitting the limit stops **automatic** restarts; the unit is not permanently dead — a later start (manual, timer, socket) re-activates `Restart=`. `systemctl reset-failed` flushes the counter now.

**Fix (wave 5):**

1. When `givenUpAt` expires **and** `wanted`, arm **one** `ensureRunning` (the interval elapsed; try again).
2. `bgb doctor --repair` (or reuse an existing repair flag) resets `failureCount` / `givenUpAt` like `reset-failed`. Without `--repair`, doctor only reports.
3. Do not merge macOS launchd into this child machine.

**Files:** `core/services/helper.ts`, `core/commands/doctor.ts`

**Test:** `maxFailures: 1`, `givenUpMs: 20`, `wanted` stays true → a second spawn after 20ms without a new `setWanted` edge.

---

## 7. Bot Instructions save-across-row

**Now:** `rowId` effect clears `draft`+`failed` but not `saving`. Switch bots while saving: textarea stays disabled until the old promise settles; a failed old save sets `failed` on the new row.

**Industry:** React state is tied to tree position. Switching recipients without a `key` keeps the draft (and would keep `saving`). Give the editor `key={row.id}` so React remounts a clean tree — the documented chat-form pattern.[7]

**Fix (wave 4):**

1. Render `BotInstructionsEditor` with `key: row.id` from the parent (or the factory wraps an inner component keyed on `rowId`).
2. Ignore stale promise results: `then`/`catch` no-op if `row.id` changed (generation / abort).
3. Do not add a fourth `useState` flag.

**Files:** `plugins/bot-instructions/runtime.ts`

**Test:** start save on bot A, switch to B before settle → B is not `saving`, A’s failure does not set B’s `failed`.

---

## 8. macOS event tap re-enable race

**Now:** `setTap` calls `CGEvent.tapEnable` **before** flipping `tapEnabled`. Own `tapEnable(false)` arrives as `tapDisabledByUserInput`. If that callback is synchronous, `guard tapEnabled` still passes, the handler re-enables, then `tapEnabled=false` with the tap still on.

**Industry:** Apple: taps may become unresponsive or the user may request disable; a `kCGEventTapDisabled` event is passed to the callback; re-enable by calling `tapEnable`.[8] Own disable is not “user requested disable”. Mature helpers re-enable only when they still **intend** the tap on (check a want-flag that is already false).

**Fix (wave 6):**

```
func setTap(enabled want: Bool) {
  guard let tap = eventTap, want != tapEnabled else { return }
  tapEnabled = want          // first
  CGEvent.tapEnable(tap: tap, enable: want)
}
```

Keep `guard tapEnabled` in the disable callback so own disable is a no-op. Only `tapDisabledByTimeout` while `tapEnabled` re-enables.

**Files:** `native/macos-helper/main.swift`

**Test:** unit-level if the helper has Swift tests; otherwise a comment + dogfood: empty watch → tap stays off (`CGEvent.tapIsEnabled`).

---

## 9. MCP session flags vs report `state`

**Now:** `McpServerStatus.state` is the report; `closed` / `initialized` / `discovery` / `closing` are the controller. `tools()` swallows connect failures. `replaceConfigs` vs in-flight `call` → unavailable. Sidebar MCP lazy-connect is fine; mutations still hit (1).

**Industry:** MCP connection lifecycle is **initialize → operation → shutdown**. The client MUST NOT send requests other than pings before `initialize` completes; after shutdown the transport is gone.[9] Implementations SHOULD timeout hung requests. Report state should be those three phases, not a parallel bag of flags that can say `connected` while `closed` is racing.

**Fix (wave 6):**

1. Derive the public `state` from the flags: `connecting` until initialize+initialized; `connected` only when `initialized && !closed`; `error` on failure; never `connected` while `closed`.
2. `tools()` / `call()` throw `unavailable` on connect failure instead of returning `[]` / swallowing.
3. `replaceConfigs` bumps a generation; in-flight calls with the old generation fail unavailable (already the idea).
4. Sidebar MCP stays lazy; mutating tools get `requestId` from (1).

**Files:** `core/services/mcp.ts`

**Test:** after `close()`, `list()`/`tools()` are not `connected`; a failed `initialize` is `error`, not empty tools.

---

## 10. Plugin storage split-brain

**Now:** default `set()` updates the in-memory cache when `setItem` throws. A new `createStorage` or another window sees disk. `requirePersistence` already rejects. Star/pin lists write raw `localStorage`.

**Industry:** Web Storage `setItem` throws `QuotaExceededError` at the origin cap (~5 MiB local). Catch it; do not pretend the write landed.[10][11] Feature-detect with a real `setItem`/`removeItem` round-trip. `storage` events sync **other** documents, not the writer.

**Fix (wave 6):**

1. Default `set()`: if `setItem` throws, **do not** update cache or fire listeners (same as `requirePersistence`). Optional `{ ephemeral: true }` for RAM-only.
2. Star/pin go through `ctx.storage` (or one helper that uses the same try/catch), not raw `localStorage`.
3. Do not call `navigator.storage.persist()` for this (file:// renderer, overkill).

**Files:** `loader/storage.ts`, `loader/ui/section.ts`

**Test:** mock `setItem` throw → `get()` still returns the previous value; `requirePersistence: true` still throws.

---

## What we are not doing

- XState / a `Phase` type on every controller.
- Wrapping Settings layout in `createBoundary`.
- Using the PTT 3s timer as a second `response.create`.
- Auto-retrying `sidebar.execute` with a new UUID.
- Doctor swapping `bin/`.
- Merging macOS launchd helper into the Windows/Linux child machine.
- Writing `loading` into the on-disk build manifest.

## Suggested 落地 order

1. Wave 4 (cards `loading`, NullComponent retry, bot-instructions `key`, UI create Esc-delete) — cheapest user-visible leftovers.
2. Wave 5 (`requestId` on `sidebar.execute` + MCP, PTT generation, helper self-arm).
3. Wave 6 (tap order, MCP derived state, storage) with a helper rebuild for (8).

## Sources

[1] https://docs.stripe.com/api/idempotent_requests
[2] https://docs.stripe.com/error-low-level
[3] https://code.visualstudio.com/api/references/vscode-api
[4] https://code.visualstudio.com/api/references/activation-events
[5] https://developers.openai.com/api/reference/resources/realtime/client-events
[6] https://www.freedesktop.org/software/systemd/man/latest/systemd.unit.html
[7] https://react.dev/learn/preserving-and-resetting-state
[8] <https://developer.apple.com/documentation/coregraphics/cgevent/tapenable(tap:enable:)>
[9] https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle
[10] https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
[11] https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API
[12] https://code.visualstudio.com/docs/editing/workspaces/workspaces
