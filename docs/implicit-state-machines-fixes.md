# Correction plan: the 10 implicit machines worth fixing

Companion to `docs/implicit-state-machines.md`. Industry analogs, then a BGB-shaped fix. Not XState-for-everything — keep the existing flag/queue style, close the holes mature products already closed.

Do not implement from this file until asked to 落地. Uncommitted. **W0–3 landed** (folders 0.2.7, loader `loading`/instance boundary, sidebar `requestId`, PTT owed-once, helper coalesce, watchdog pid, setup residual).

## Waves

| Wave | When | Items |
| --- | --- | --- |
| **0** | User-visible, we already hit | 1 UI create vs persistEdit · 2 rename blur-commit |
| **1** | Status/UI lies, cheap | 4 `status()` before `define()` · 3 boundary sticky · 10 drag capture |
| **2** | Races under load | 5 sidebar timeout unknown · 7 PTT owed create · 8 helper given-up |
| **3** | Install/update residual | 9 setup undo half-fail · 6 update watchdog ownership |

Do not start wave 3 as a rewrite of the binary journal — that part already exists.

---

## 1. Folders: UI `createFolder` vs `persistEdit`

**Now:** Folders bar `+` / rail / empty-space menu call `sectionCommands.create([])` then `beginFolderRename`. That is **off** the `executeSidebar` queue and **off** `persistEdit`. `renameFolder` is a raw `store.edit`. Agent `create-folder` goes through `persistEdit` and confirms the host name. Two writers.

**Industry:** VS Code contributions go through `commands.executeCommand`; `activate()` is a Thenable, not a side channel.[1][2] Slack/Open WebUI “new section/folder” is one command: create → inline rename → the same store commit. No second unofficial `store.edit`.

**Fix (wave 0):**

1. Put UI create/rename/delete/drop on the same `commands` promise mutex as `executeSidebar` (one writer).
2. `renameFolder` / post-create name must use `persistEdit`, not naked `store.edit`.
3. Keep `create([])` for the optimistic row (snappy + overlay), but the **name commit** is the owned write.
4. Esc on a brand-new folder: leave “New folder” (Finder/VS Code Untitled) *or* `delete-folder` via the same queue — pick one and test it. Do not leave a second writer.

**Files:** `plugins/sidebar-folders/runtime.ts` (`createFolder`, `renameFolder`, `dropAgent`, `executeSidebar`)

**Test:** UI create while an `executeSidebar` move is in flight; name commit must not confirm on an older identical `intent`.

---

## 2. Rename overlay re-entry commits on blur

**Now:** Native-handoff sets `data-bgb-abort` then `remove()`. `beginFolderRename` entry does `querySelector(RENAME)?.remove()` **without** abort. Removing a focused input fires `blur` → `finish(true)` → default “New folder” committed.

**Industry:** One rename session; replacing it is cancel, not save. HTML `AbortController` / a session token: teardown always goes through `finish(false)` unless Enter. Finder/VS Code: Esc discards; a new rename replaces the field without writing the old buffer.

**Fix (wave 0):**

```ts
function abortRenameOverlay(root: Document): void {
  const overlay = root.querySelector(`.${RENAME_INPUT_CLASS}`);
  if (overlay instanceof HTMLElement) overlay.setAttribute("data-bgb-abort", "");
  overlay?.remove();
}
```

Use that in `beginFolderRename` (the current unguarded `remove()`), native-handoff, and folder delete. Never `remove()` a focused overlay without abort.

**Files:** `plugins/sidebar-folders/runtime.ts`, existing `beginFolderRename` tests

**Test:** overlay open → `beginFolderRename` again → `onCommit` not called.

---

## 3. `createBoundary` sticky fail

**Now:** `let failed` sits **outside** the class, shared by every instance of that boundary. One throw → that tree is `null` until process quit. Intentional for “don’t rethrow,” accidental as a process-global latch. Layout is correctly **not** wrapped.

**Industry:** React error boundaries stay failed until the **instance** remounts; reset is a new `key` (or `resetKeys`).[10] `react-error-boundary` does the same. Do not share a closure flag across mounts.

**Fix (wave 1):**

1. Store `failed` only in `this.state` (and `getDerivedStateFromError`). Drop the outer `let failed`.
2. Keep `reported` per instance so logs stay once-per-crash.
3. Key the pane boundary on tab id / plugin id so switching Plugins → Themes remounts a clean boundary.
4. Still never wrap native Settings layout.

Sticky-until-remount remains (good). Sticky-until-quit goes away.

**Files:** `loader/boundary.ts`, `loader/hooks.ts`, `loader/runtime.ts`, `loader/boundary` tests

---

## 4. `status()` reports `active` before `define()`

**Now:** Manifest `PluginState` is explicit (`active` | `disabled` | `patch-failed` | …).[sdk] Loader `status()` still returns **`active` while `define()` has not run**. `call()` is unavailable. Cards look on.

**Industry:** VS Code `Extension.isActive` is `true` only after `activate()` has run; `activate()` returns a Thenable.[1][2] Extensions are not “active” during the activation event.

**Fix (wave 1):**

Additive SDK state, not a lie:

```ts
export type PluginState =
  | "loading" | "active" | "disabled" | "patch-failed"
  | "runtime-failed" | "invalid" | "unsupported-platform";
```

- Manifest `active` + script not in `defined` → **`loading`**
- `define()` ok → `active`
- factory throw → `runtime-failed` (already)

Cards: `loading` is not failed, toggle disabled until `active`. Doctor: `loading` after boot N seconds → warn, not green.

If SDK churn is too high for one PR: overlay in `status()` only (`hasRuntime && !defined.has(id)` → treat as loading in UI) and add the enum in the same PR as cards. Do not ship a silent overlay without the type — that’s how this hole appeared.

**Files:** `sdk/manifest.ts`, `loader/runtime.ts`, `loader/ui/model.ts`, `loader/ui/cards.ts`

---

## 5. `sidebar.req` timeout = outcome unknown

**Now:** One `sidebar.req`, never replayed. Timeout/disconnect reject `unavailable` `{outcome:"unknown"}`. A retry can double-apply (second create, second move).

**Industry:** Stripe: on network timeout you **do not know** if the POST ran; retry with the **same idempotency key**, or **reconcile** (GET) before a new key. Do not mint a new key while the first outcome is unknown.[3][4]

**Fix (wave 2):**

1. Client generates `requestId` (UUID) per user intent; renderer echoes it on `sidebar.res`.
2. Timeout → **do not** auto-retry the mutation. `executeSidebar` caller: `list-folders` / `list-bots` reconcile, then either return the existing object or retry **with the same `requestId`**.
3. Renderer: if `requestId` already applied, return the first result (no second `create([])`).
4. Keep `{outcome:"unknown"}` on the wire; doctor/UI copy: “check the sidebar, then retry” — never “failed, try again” as a blind POST.

**Files:** `core/bridge/server.ts`, `core/bridge/methods.ts`, `loader/bridge-client.ts`, `plugins/sidebar-folders/runtime.ts` (`executeSidebar`)

---

## 6. Self-update `pending` vs dead watchdog

**Now:** Success sets `update.pending`, spawns `bin/previous update-watchdog` (90s `/health`), then `stop(true)`. New agent clears pending iff `pending.version === BGB_VERSION`. If the watchdog process dies and the new agent never comes up, pending sticks until `doctor` / `setup --yes`. Restore failure can start whatever is in `bin/`.

**Industry:** OTA launchers treat **the new process’s health ping** as source of truth, not the old helper. A bundle that does not report healthy within `health.launchTimeout` (example: 60s, max 3 attempts) rolls back.[9] Watchdog is an orphan reaper, not the owner of “pending.”

**Fix (wave 3, small):**

1. Document the invariant that already exists: **new agent clears pending**. Watchdog only `restorePrevious` if `/health` never shows the new version.
2. Watchdog pid in `state.update.watchdogPid`; `doctor` if pending set and pid dead and health ≠ pending → fail with `bgb setup --yes`, do not start the new binaries from a half-restore.
3. Do not add a second writer of `bin/`. `commitBinaries` lock stays the only swap.

No need to copy a full OTA launcher.

**Files:** `core/update/self-update.ts`, `core/commands/doctor.ts`, `core/agent/agent.ts`

---

## 7. PTT owed `response.create`

**Now:** Interrupt sends `response.cancel`, arms a **3s timer**, and may `response.create` when the timer fires *or* on `response.done`. Two producers.

**Industry:** OpenAI Realtime PTT: on down, `response.cancel` (and truncate/clear playback); on up, commit then **one** `response.create`.[5] `response.cancel` is safe if nothing is in progress (server errors, session stays up).[6] Wait for `response.done` (`cancelled` | `completed` | error-no-in-progress), then create **once**. Do not use a timer as a second create.

**Fix (wave 2):**

```
owed = true on cancel-while-in-flight
on response.done | cancel-error: if owed && generation matches → create once, owed = false
timer: log + give up, do not create
```

Generation++ on every press so a late `done` cannot create for a turn that was abandoned.

**Files:** `plugins/push-to-talk/runtime.ts` (+ tests)

---

## 8. Helper `given-up` / `launching` drops overlapping starts

**Now:** `launching` gate can drop a concurrent `ensureRunning`. Five hello-less deaths → given-up until a new `wanted` edge. macOS is launchd, not this child machine.

**Industry:** systemd: `Restart=` plus **start-rate limiting** (`StartLimitBurst` / `StartLimitIntervalSec`). Hitting the limit marks failed; it is not a silent forever-off — start again after the interval or an explicit reset.[11] BGB’s build scheduler already coalesces: idle / running / one follow-up.

**Fix (wave 2):**

1. Coalesce `ensureRunning` like `core/agent/builder.ts` (`next` waiter, force OR).
2. given-up is a **circuit breaker with a clock**, not a sticky bool: after interval, or `wanted` 0→1, or `bgb doctor --repair`, try again.
3. doctor surfaces given-up (keys/media `error`) instead of looking idle.
4. Do not merge macOS launchd into this child machine.

**Files:** `core/services/helper.ts`, `core/commands/doctor.ts`

---

## 9. Setup reverse-undo half-fail

**Now:** Commit steps push `Undo[]`; throw → undo newest-first; a **failed undo is logged and the rest continue**. Caller can look like a mixed machine. Grok Bot restart after commit is never undone (correct). Agent-start 15s timeout already undoes including the new agent.

**Industry:** Best-effort unwind is fine; **lying that the machine is clean is not**. Stripe: 5xx / timeout → reconcile, don’t assume failure or success.[3] Homebrew will keep going through a batch and still fail the run; it does not report success after a partial extract.

**Fix (wave 3):**

1. Collect undo failures; if any, exit **non-zero** with a residual list (PATH, hook, binaries, agent). Never print a green setup summary after undo ran.
2. Keep continuing remaining undos (best-effort) — that part is right.
3. `bgb doctor` grows a `setup-residual` check from that list if written to `state.setup.residual`.

Do not invent a two-phase commit across launchd + PATH + agent. Too much for this surface.

**Files:** `core/setup/setup.ts`, `core/commands/doctor.ts`

---

## 10. Drag listeners leak until `pointerup`

**Now:** Leaving a folder clears `drag` / highlight but does **not** `stop()`. `pointermove` stays on `window` until up/Escape. `dropAgent` `stop()`s even when it returns `undefined`.

**Industry:** `setPointerCapture` until `pointerup`; capture release is `lostpointercapture`.[7] Chrome’s drag guide: default to capture, **clear dragging state on `lostpointercapture`**; if the handle may unmount, use document listeners and still tear down on up/cancel.[8]

**Fix (wave 1):**

1. On drag start, `setPointerCapture` on the row (or aside).
2. `lostpointercapture` / `pointerup` / `pointercancel` / Escape → **always** `stop()` (remove listeners, clear line, clear `data-bgb-drop`).
3. Leaving a folder: clear highlight, keep capture until up (so a return-to-folder drop still works) — that is capture’s job, not leaked window listeners.
4. If `dropAgent` returns `undefined`, still `stop()` (already) but do not claim the native drop will see plugin Y.

**Files:** `plugins/sidebar-folders/runtime.ts` (`dragOver`, `dropAgent`, `stop`)

---

## What we are not doing

- Rewriting these as a formal `type Phase = …` everywhere. Name a type only where a test needs to exhaust states (`RenameSession`, `HelperLaunch`).
- Wrapping Settings layout in `createBoundary`.
- Auto-retrying `sidebar.req` with a new id.
- Using the PTT 3s timer as a second `response.create`.
- Live-dogfooding collapsed sidebar under CDP.

## Suggested 落地 order

1. Wave 0 in `sidebar-folders` (abort helper + queue UI mutations) — unblocks the empty “New folder” / double-name class of bugs.
2. Wave 1 (`loading` state, boundary instance state, pointer capture).
3. Wave 2 if voice/helper/agent command races show up in dogfood.
4. Wave 3 only with a setup/update dry-run on this machine.

## Sources

[1] https://code.visualstudio.com/api/references/vscode-api
[2] https://code.visualstudio.com/api/references/activation-events
[3] https://docs.stripe.com/error-low-level
[4] https://docs.stripe.com/api/idempotent_requests
[5] https://developers.openai.com/api/docs/guides/realtime-conversations
[6] https://developers.openai.com/api/reference/resources/realtime/client-events
[7] https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture
[8] https://developer.chrome.com/docs/modern-web-guidance/guides/ui-behaviors/drag
[9] https://github.com/moeru-ai/ergosphere-it
[10] https://react.dev/reference/react/Component
[11] https://www.freedesktop.org/software/systemd/man/latest/systemd.unit.html
