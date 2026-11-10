# Implicit state machines in Better Grok Bot

Companion correction plans: W0–3 `docs/implicit-state-machines-fixes.md` (landed); leftover 10 of that scan `docs/implicit-state-machines-fixes-w4.md` (landed). **W0–9 landed** (2026-11-10). Post-W0–6 leftover 10: `docs/implicit-state-machines-fixes-w7.md` (landed). This file is a **post-W0–6 rescan** of the current fork, not the pre-fix list.

Local analysis of `0-V-linuxdo/better-grok-bot`. Not a design doc for upstream. Do not treat every entry as a bug.

## Definition

An **implicit state machine** is a set of mutually exclusive (or nearly exclusive) behavioral modes that the code actually walks through, but that is **not** declared as a named type with a single transition function (`type Phase = "idle" | "pending" | …` plus one reducer).

It is encoded as some mix of:

- boolean / handle clusters (`done`, `pending`, `failed`, `stopping`)
- bags of fields (`PersistenceWait`, `wanted` + `saidHello` + `failureCount`)
- promise queues and identity matching (`store.ops`, `next === payload`)
- timers + `MutationObserver`
- DOM / on-disk / launchd artifacts as the live mode (`data-bgb-renaming`, `.staged-*`, `update.pending`)

**Out of scope here:** a lone settings toggle; CSS-only hide; host machines we only *read* (Grok `voiceCall.phase`, native `aria-expanded`, `sand_voice_reconnect` as flipped by Keep-alive). Voice keepalive is a boolean gate into the app’s reconnect path, not a BGB-owned machine.

**Half-explicit:** the SDK already has a *report* type (`PluginState`, `McpServerStatus.state`, `UpdateState`, `KeysState`, `BridgeState`) while the *controller* is still flags, timers, and side effects. Those are listed and marked.

Spider (2026-11-10, post W0–6): six parallel passes over `core/{agent,setup,cli,commands,bridge,services,update,platform,hooks,build,plugins,app}`, `loader/`, `sdk/`, `plugins/*`, `native/helper`, `native/macos-helper`, `scripts/`. Generated, `node_modules`, `dist`, `*.bun-build` skipped. Findings were merged and leftover claims checked against current source.

Do not XState these. Mature products keep flag/queue style: one write path, timeout = reconcile first, no second submit.

---

## Closed in W0–3 (do not re-open as the old holes)

| Wave | Was | Now |
| --- | --- | --- |
| 0 | UI create/rename/drop off `executeSidebar`; rename re-entry blur-committed | `enqueueUi` shares `commands`; `abortRenameOverlay` before every overlay `remove()`; name commit is `persistEdit` |
| 1 | `status()` lied `active` before `define()`; `createBoundary` process-global `let failed`; drag listeners leaked until pointerup | SDK `"loading"` overlay; instance `this.state.failed` + pane `key: tabId`; `setPointerCapture` + `lostpointercapture` always `stop()` |
| 2 | sidebar timeout unknown + retry double-apply; PTT 3s timer as second `response.create`; helper `launching` dropped overlapping starts | `requestId` replay on the renderer; owed boolean + warn-only timer; `nextEnsure` + `givenUpAt` clock |
| 3 | setup undo could look clean after a failed undo; watchdog pid invisible to doctor | `setupResidual` + exit 1; `update.pending.watchdogPid`; doctor fails if pid gone and `/health` ≠ pending — **does not swap `bin/`** |

Layout is still **not** wrapped in `createBoundary`. PTT timer still must not create. Sidebar still must not mint a **new** key to retry an unknown mutation.

## Closed in W4–6 (do not re-open as the old holes)

| Wave | Was | Now |
| --- | --- | --- |
| 4 | UI `+` `create([])` then overlay; cards never `loading`; `NullComponent` cached before `define()`; instructions save across rows | UI create is `persistEdit` + Esc-delete untitled; local `loading` overlays agent `active`; uncached Null until `define()`; Inner keyed by bot id |
| 5 | host minted a new `requestId` per RPC; PTT no generation; helper given-up did not self-arm | caller `requestId` forwarded (mint only if missing); owed carries `owedGeneration`; `givenUpTimer` + `doctor --repair` (`keys.install`) |
| 6 | `tapEnable` before flag; MCP report = raw session; `setItem` fail still cached | flag first; `reportedState()`; persist-fail leaves cache; star/pin after write |

Do not bump `native/helper-manifest.json` for a local Swift rebuild (no GitHub `helper-vN`). Install the rebuilt `.app` over `DATA/helpers/` and keep `version.txt`.

---

## Closed in W7–9 (do not re-open as the old holes)

| Wave | Was | Now |
| --- | --- | --- |
| 7 | host reject after `hostStores` hid every folder; `delete-folder` left a live rename overlay | host reject keeps the last local mirror; `delete-folder` aborts overlay and disconnects `renameWatch` |
| 8 | hung child never given-up; LRU-32 could evict an in-flight `requestId`; `sentCodes`/`sentLevel` set before RPC | hello deadline kills + `fail()`; only settled LRU entries evict; sent snapshot updates on success; last unwatch delivers `false` |
| 9 | Darwin `--replace` raced KeepAlive; restore-fail started `bin/`; RAM journal; Windows hello `granted` before hook; canary issue before state push | plist present → `startAgent`/`kickstart` only; restore-fail starts `bin/previous` or nothing; `DATA/bin/.journal.json` + start recover; hello `denied` until `SetWindowsHookEx`; outbox pending then `gh`, `Report-Hash` idempotent |

Do not reopen W0–6 holes. Do not bump `native/helper-manifest.json` for a local Swift rebuild.

## Needs further thought

These 10 leftover items of the post-W0–6 rescan **landed in W7–9**. See `docs/implicit-state-machines-fixes-w7.md`.

Lower urgency, still real: Windows `--purge` returns 0 then a detached `cmd rmdir`; plugin install crash between live rename and grants commit; asar fingerprint cache is `{path,size,mtimeMs}` not inode (same-size/mtime replace can skip extract); failed core hook still occupies apply order; startup TOCTOU (`idle` then `start()` vs a user-started call); e2e step deadline does not cancel `fn`.

---

## Catalog (grouped)

### 1. Agent process and install

#### Agent lifecycle (singleton / stop / restart)

Unclaimed → already-running (exit 0) | starting → running → stopping (re-entrant latch) → stopped | restarting | failed-start | self-test (no record). No `AgentState`. Live mode is `stopping: Promise | null`, launchd KeepAlive vs `bootout`, identity polls. Darwin plist present: kickstart, not `--replace` (W9).

**Files:** `core/agent/agent.ts`, `core/agent/main.ts`, `core/agent/restart.ts`, `core/agent-record.ts`, `core/platform/agent-control.ts`

#### Serialized build scheduler

Idle → running → queued-followup → idle | stopped (queued fail). `next` / `nextForce` / `running` / `stopped` plus `Agent.building` (report overlay). Coalesces to one waiter (force ORs). Model for helper coalesce.

**Files:** `core/agent/builder.ts`, `core/agent/agent.ts`

#### Grok Bot asar settle-watch

Uninitialized → baseline (missing|present) → change-detected → settling → fire `onChange` | recheck | closed. Dual producers (poll + `fs.watch`) intentional. Same `{path,size,mtime,version}` never fires.

**Files:** `core/agent/watch.ts`, `core/agent/agent.ts`

#### DATA input debounce watcher

Watching → pending (`debounceMs` quiet) → report kinds | closed. `pending Set<DataChange>` + timer over DATA root, `plugins/`, `themes/`, replaceable dev-dir watchers.

**Files:** `core/agent/watch.ts`, `core/agent/agent.ts`

#### Setup commit and reverse-undo *(W3 closed the lie)*

Preflight (DATA only) → committing (`Undo[]`) → waitForAgent 15s → committed (clear `setupResidual`) → restart Grok (**never undone**) | undoing → undone | undo-partial (`setupResidual`, exit 1). Remaining undos still continue (best-effort). Agent wait 15s is a commit gate. A restart failure still returns 0.

**Files:** `core/setup/setup.ts`, `core/state.ts`, `core/commands/doctor.ts`

#### Binary stage / commit / rollback

`.staged-*` → in-memory rename journal → verify `--version` → committed | rollback newest-first | rollback-failed (keep staged) | `.trash-*` (Windows in-use). `withBinariesLock` is the only swap of `bin/` (setup + self-update). Doctor does not swap (W3). Journal is RAM-only (leftover 3).

**Files:** `core/setup/binaries.ts`, `core/lock.ts`, `core/update/self-update.ts`

#### grok-mods migration journal

Needed → journaling → migrated | fail → restoring → restored | restore-failed (keep journal). On-disk `migration.json` + `state.migratedGrokMods`. Sticky flag skips `needsGrokModsMigration` even if leftovers remain.

**Files:** `core/setup/migrate-grok-mods.ts`, `core/setup/setup.ts`, `core/state.ts`

#### Uninstall teardown

Confirm → attempt-all (agent, autostart, hook, mac helper, PATH) → done | incomplete (no purge, exit 1) → purge | win32-deferred-purge. Windows `clearDataExceptBin` then detached `cmd rmdir` after the CLI has printed success.

**Files:** `core/setup/uninstall.ts`, `core/setup/path-entry.ts`

#### Grok Bot quit / relaunch

No-executable → skipped | not-running → launched | running → ask → graceful-quit → force-quit → restarted | skipped | did-not-quit. `RestartResult` is a return tag. Setup never undoes this. `login.ts` can launch without quit. Pid wait only (no process-identity).

**Files:** `core/setup/restart.ts`, `core/platform/{darwin,linux,win32}.ts`, `core/commands/login.ts`

#### Self-update + watchdog pending *(half-explicit: SDK `UpdateState`)*

Disabled | idle → check → available | error → downloading → stage/commit/self-test → `update.pending` + `watchdogPid` → `bin/previous update-watchdog` (90s `/health`) → agent start clears pending iff `pending.version === BGB_VERSION`. Doctor: pid alive → warn; pid gone and health ≠ pending → fail + `setup --yes`, no `bin/` swap. Restore failure keeps pending then still `startAgent` of current `bin/` (leftover 2). `checking` exists in the SDK and is unused. 6h tick is a second producer vs RPC apply (joined, not a second `bin/` writer).

**Files:** `core/update/self-update.ts`, `core/agent/agent.ts`, `core/commands/doctor.ts`, `core/state.ts`

#### Record-file lock claim

Free → OS-guard → wx-held | wait-live-holder | stale-snapshot-reclaim | unparsable-grace 5s | timeout. `DATA/locks/<name>.lock` JSON + `withOsLock` on `<file>.guard`. Reclaim only if text+ino+mtime still match. `withBinariesLock` re-entrant via ALS.

**Files:** `core/lock.ts`, `core/os-lock.ts`, `core/proc.ts`, `core/agent-record.ts`

#### Process identity liveness

Unread (selfIdentity throws, retries) → recorded `{pid,bootId,startTime}` → alive | dead | pid-reuse-stale | unreadable (never alive, never signaled). `isAlive=kill(0)` including EPERM; `identityAlive` needs same bootId and exact startTime.

**Files:** `core/proc.ts`, `core/lock.ts`, `core/agent-record.ts`

#### Darwin launchctl hook vs reboot wipe

Plists written → HOOK bootstrap (`/bin/launchctl setenv`, fast) → AGENT bootstrap; getenv active | absent | conflict. Reboot wipes setenv; `bgb login` re-setenv if `state.hook`. Doctor: darwin + hook + absent getenv = fail.

**Files:** `core/platform/darwin.ts`, `core/commands/login.ts`, `core/agent/agent.ts`, `core/commands/doctor.ts`

#### Linux desktop-entry hook restore

Active | conflict-leave | absent → debounce 500ms → `hookInstall` restore. Live mode is the user `grok-bot.desktop` + `X-BetterGrokBot-Original-*` markers. AppImage rewrites are the intended absent→restore path.

**Files:** `core/agent/agent.ts`, `core/platform/linux.ts`, `core/platform/desktop-entry.ts`

#### PATH entry artifact

Absent → added (POSIX `~/.local/bin/bgb` symlink, never a regular file; Windows User Path) | already-present | foreign-file-leave | removed-if-ours.

**Files:** `core/setup/path-entry.ts`

#### `current` pointer swap

Missing → swapping (temp/aside) → pointed | crash-leftover-cleanup. Unix: temp dir symlink then `renameReplacing`. Windows: `current.new` junction + `current.old` rename, never leaving `current` absent on failure.

**Files:** `core/platform/common.ts`, `core/platform/win32.ts`

---

### 2. Bridge, helper, MCP

#### Bridge listen / hello / stop

Bind → listening → renderer-awaiting-hello (timer) | helper-open → renderer-ready → stopping → closed. `sockets` Map; renderer `null`+hello timer vs frozen `RendererConnection`; helper role at upgrade; sticky stopping latch; 1s drain then `server.stop`.

**Files:** `core/bridge/server.ts`

#### CLI/MCP bridge client pending RPC

Connecting-await-welcome → connected (in-flight reqs) → closed-flush-unavailable. Handshake Promise + helloTimer; `pending Map<id>`; no reconnect (loader has its own reconnect machine).

**Files:** `core/bridge/client.ts`

#### Addressed sidebar mutation wait *(W2/W5 closed mint-new-key)*

Idle → pending one-shot `sidebar.req` → resolved | timeout-unknown | disconnect-unknown | send-failed-unknown. Caller `requestId` forwarded, minted only if missing; timeout says list then retry the **same** key; never auto-replay.

**Files:** `core/bridge/methods.ts`, `core/bridge/server.ts`, `core/mcp-sidebar.ts`

#### Native helper child / hello / backoff *(W2/W5 closed drop + sticky given-up; half-explicit: `KeysState` / `MediaState`)*

Unavailable | needs-install | installing | launching | running-no-hello | connected | idle-timeout-quit | backoff 1s…30s | given-up | agent-stopping. `wanted` / `stopped` / `launching` / `saidHello` / `nextEnsure` / `failureCount` / `givenUpAt` + timers. `givenUpTimer` self-arms one `ensureRunning` after the clock; `doctor --repair` → `keys.install` (`resetFailures`) on Win/Linux; Darwin is launchd. A child that *lives* without hello never `fail()`s (leftover 5).

**Files:** `core/services/helper.ts`, `core/services/index.ts`, `core/services/keys.ts`, `core/services/media.ts`

#### macOS helper WebSocket reconnect

Config-unreadable → connecting (`socket` set, `socketOpen=false`) → connected (`socketOpen`, ping 20s) | connect-fail. Disconnect: forget watch, tap off, unduck, always-on 2s reconnect. Launchd KeepAlive is a second controller — do not merge with the Win/Linux connect-once child.

**Files:** `native/macos-helper/main.swift`

#### macOS event tap + Input Monitoring *(W6 closed tapEnable order)*

Ungranted (2s poll, `CGRequestListenEventAccess`) → granted-tap-ready (tap created disabled) → tap-enabled (watch nonempty) | tap-system-disabled (re-enable **iff** `tapEnabled`) | 120s give-up-exit 0 (launchd restarts). `setTap` flips `tapEnabled` before `CGEvent.tapEnable`; callback `guard tapEnabled` so own disable is a no-op.

**Files:** `native/macos-helper/main.swift`

#### Windows keyboard hook retry

Empty watch → unhooked. Wanted nonempty + no hook → install | denied-backoff 1s…60s doubling | installed. `hello.keys=granted` as soon as the hook *thread* starts (leftover 4). `access: granted` follows a prior denied once `SetWindowsHookEx` succeeds.

**Files:** `native/helper/src/windows/keys.rs`, `native/helper/src/windows/mod.rs`

#### Linux X11 raw-key select

Unsupported (Wayland / no DISPLAY / XI2 fail) `hello keys=unsupported` → granted thread + select-off | select-on | X connection lost exit 1. On/off select, not a retry loop. Wayland is sticky unsupported for the process.

**Files:** `native/helper/src/linux/mod.rs`, `native/helper/src/linux/keys.rs`

#### Win/Linux helper connect-once session

Env-missing/connect-fail exit 1 → hello + serve (10ms poll) → quit | socket-closed → `backend.shutdown` exit 0. No reconnect. Agent respawns the child. Hung backend threads (X `wait_for_event`, hook `GetMessageW`, COM) outlive socket shutdown until process exit. No hello deadline in the helper itself.

**Files:** `native/helper/src/main.rs`, `native/helper/src/protocol.rs`

#### Helper watched-key chord

Per-code up/down; chorded once-per-hold; auto-repeat filtered; replace keeps retained downs, forgets removed codes **without** events; empty watch → tap-off / unhook / deselect. Disconnect/empty watch forgets downs without ups (agent `releaseDown`; PTT treats helper-lost as all-up).

**Files:** `native/helper/src/watch.rs`, `native/macos-helper/main.swift`

#### Agent-side watched-key down-set

Per-code up | down. Helper-gone releases every down as up to watchers. `byConnection` Map + `down` Set; settle drops unwatched downs without events; union drives helper watch frames.

**Files:** `core/services/keys.ts`, `core/services/index.ts`

#### Music duck converge / fade

Released → ducked (snapshot originals × level) → relevel | fading-restore (8×85ms) | restore-now (quit/socket/exit). Mid-fade duck cancels fade. User-moved volume is abandoned until the next full duck. Linux helper duck is a no-op (agent `pactl`).

**Files:** `native/macos-helper/main.swift`, `native/helper/src/windows/media.rs`, `core/services/media-linux.ts`

#### MCP session *(half-explicit: `McpServerStatus.state`; W6 closed report vs flags)*

Disconnected → connecting/discovering → connected | error → closing; service load → mutate-serialized | stopped. `reportedState()` derived (`connected` only when initialized and not closed). `tools()` throws `unavailable` if every enabled server failed. `close()` is still flags + `deadline` around `client.close()`.

**Files:** `core/services/mcp.ts`

#### Sidebar MCP lazy bridge

Idle (no connect on construct/list) → connecting (shared Promise) → connected | failed-cleared | stopped. Next tool retries after clear. Mutating tools forward `requestId`.

**Files:** `core/mcp-sidebar.ts`, `core/bridge/client.ts`

---

### 3. Build, package, scripts

#### Renderer extract → patch → embed → publish

Fingerprint+key → cache-hit | mkdtemp `.tmp-` → stamp/extract → assemble → `boot.js` + pin `file:` URLs → atomic manifest → rename into `builds/<appVersion>-<key12>` | force: `.retired-` swap | `AppChangedError` → 5s → one retry | `publish:false` skips `pointCurrent`/`lastBuild`. Prune keeps 3 newest + current + protect; stale `.tmp-`/`.retired-` >10min deleted. Fingerprint cache is `{path,size,mtimeMs}` not inode.

**Files:** `core/build/index.ts`, `core/build/html.ts`, `core/build/key.ts`, `core/app/asar.ts`

#### Isolated patch worker

Spawn → first of message/error/close/timeout (10s) → settled latch drops the rest → terminate. Community/dev only; in-process `attempt()` has no worker. Main thread re-checks path/protection/growth and drops edits on any failure.

**Files:** `core/build/patch.ts`, `core/build/patch-engine.ts`, `core/patch-worker.ts`

#### Patch-match apply *(half-explicit: `PluginState`)*

Discover skip (invalid | disabled | unsupported-platform) | ready (`state === undefined`) → assemble default `patch-failed` → attempt (core/bundled in-process) or `attemptIsolated` (community/dev) → commit+`#dirty`+`active` | errors stay `patch-failed`. Core hooks always first and always enabled; a failed hook still occupies apply order. `loading` / `runtime-failed` are never written here (W1/W4 loader overlay).

**Files:** `core/build/index.ts`, `core/build/patch.ts`, `core/plugins/discover.ts`, `core/hooks/index.ts`

#### `check --asar` vs boot

Throwaway DATA + `force` + `publish:false` + ok iff every core/bundled plugin is `active` | boot: `publish:true`, `pointCurrent`, `lastBuild`. Mixing check with boot would leak the bridge token or mutate `current`.

**Files:** `core/build/check.ts`, `core/build/index.ts`

#### Plugin inspect / install / update / uninstall

Fetch 60s → `cache/inspect/<id>` (TTL 10min) → consent → journal pkg→`plugins/.tmp-*`→live, live→`.old-*` → grants commit | rename-fail restore `.old` | config-fail restore `.old`. New id stripped from `disabledPlugins`; replace keeps disabled. Crash between live rename and grants splits package vs config.

**Files:** `core/plugins/install.ts`, `core/plugins/download.ts`, `core/plugins/community.ts`

#### Dev plugin cache

`treeHash` hit → reuse `cache/dev/<id>` | miss → eval `plugin.ts` on host → `cache/dev/.tmp-` rename | catch → discover invalid. `claim()` runs before the rename. `loadDevPlugins` has no lock. Corrupt `cache/dev` stays sticky until the tree hash changes.

**Files:** `core/plugins/dev.ts`, `core/plugins/author.ts`

#### Canary detect / GitHub issue *(scripts)*

Detect skip vs test (new, or not-pass and `bgbCommit` changed, or `--force`). Report per version: none | open | comment | close. `EntryStatus` pass|fail|error is explicit; the issue/state order is not (leftover 6).

**Files:** `scripts/canary.ts`, `scripts/canary-results.ts`

#### e2e CDP / bridge pending + step runner *(scripts)*

Connecting-await-open/welcome (10s) → request-pending Map → resolved | timeout (late res ignored) | close rejects all. Step runner: running → step-ok | step-fail-continue | step-deadline (`fn` keeps running) | aborted. A timed-out step’s `fn` can still mutate the harness.

**Files:** `scripts/e2e.ts`

---

### 4. Loader and SDK

#### Boot install

Already-installed (noop) | stale-halted | running-bridged | running-offline. Sequential gates: global `BetterGrokBot` already defined; `haltIfStaleBuild()`; `takeBootPayload` then `openBridge() ?? offlineBridgeClient()`.

**Files:** `loader/boot.ts`, `loader/payload.ts`, `loader/bridge-client.ts`

#### Stale-build halt

Version-match pass | no-session skip | max-30-load-stale | halted-no-bridge-reload-500ms | connecting-2s | asked-rebuild-120s | fresh-reload | delayed-reload | disconnect-after-ask. `sessionStorage bgb:stale-build-reloads` + `waitForRebuild` done latch.

**Files:** `loader/stale.ts`, `loader/boot.ts`

#### Loader bridge reconnect *(half-explicit: public `BridgeState`)*

Idle-not-started | connecting-await-welcome (10s) | connected | disconnected-backoff (1s→30s forever) | moving-reconnect (delay=min) | stopped | offline-stub. Protocol-mismatch welcome returns without dropping the socket; `CLOSE_BAD_TOKEN` / `PROTOCOL_MISMATCH` still retry, log once.

**Files:** `loader/bridge-client.ts`, `loader/wiring.ts`, `sdk/runtime.ts`

#### Bridge request waiter

Idle | in-flight | timeout-unavailable | flushed-on-close/move/stop | send-failed. `pending Map<id,{resolve,reject,timer}>`; late res ignored.

**Files:** `loader/bridge-client.ts`, `sdk/bridge.ts`

#### Sidebar `requestId` replay *(W2 closed mint-new-key)*

No-handler-unavailable | first-run | replay-same-`requestId` | drop-nonincreasing-id | abandon-reply-after-socket-change. `lastSidebarId` per socket; `sidebarReplay` Map LRU-32 of `Promise<SidebarResult>` (leftover 8). Reply only if `socket===ws && running && welcomed`.

**Files:** `loader/bridge-client.ts`, `loader/runtime.ts`, `sdk/sidebar.ts`

#### Plugin `define()` overlay *(W1/W4; half-explicit: `PluginState`)*

Inactive-ignored | awaiting-define (`status` `loading`) | define-rejected (`runtime-failed`) | loaded-active | local `loading`/`runtime-failed` overlay on agent rows. Cards use `localStatus()` the same way as `runtime-failed`. An `active` `hasRuntime` that never `define()`s stays Starting… with `canToggle` false for the page.

**Files:** `loader/runtime.ts`, `loader/ui/model.ts`, `loader/ui/section.ts`, `sdk/manifest.ts`

#### Plugin component `NullComponent` cache *(W4)*

No-React uncached retry | not-yet-defined uncached retry | resolve+cache (boundary class) | cache-Null **after** `define()` fail/miss. `components` Map keyed by JSON `[id,name]`.

**Files:** `loader/runtime.ts`, `loader/boundary.ts`

#### `createBoundary` instance fail *(W1 closed process-global latch)*

Live | failed-sticky until React remount / new `key`. Per-instance `this.state.failed`. Settings pane `key: tabId`. Layout is **not** wrapped.

**Files:** `loader/boundary.ts`, `loader/ui/shell.ts`, `loader/runtime.ts`

#### Core hook React/client injection

Awaiting-react | react-ready (first valid `provideReact` wins) | section/shell/brand built-once | `onClient` microtask deliver | missing-primitives null. `reportOnce` Set returns null.

**Files:** `loader/hooks.ts`, `loader/runtime.ts`

#### Settings store disconnect / reload / busy

Boot-grace | connecting | connected | `disconnectedLong` (>10s) | `reloadPending` (moved or `buildKey` mismatch) | `busy[action]` | notice. `LoaderSnapshot` field bag. Offline = `bridge!==connected` so connecting already disables controls.

**Files:** `loader/store.ts`, `loader/wiring.ts`, `loader/ui/section.ts`

#### Plugin storage persistence *(W6)*

Unreadable-fallback | persisted | persist-fail-leave-previous | ephemeral-RAM | `requirePersistence`-throw. `setItem`/`removeItem` success then cache+notify. Star/pin `writeIdList` then `setState`.

**Files:** `loader/storage.ts`, `loader/settings.ts`, `loader/ui/section.ts`

#### Window keys and media services *(half-explicit: `KeysState` / `MediaState`)*

Disconnected-error | mirroring agent | resync-on-welcome | per-code up/down | duck released vs min-level. `sentCodes`/`sentLevel` assigned **before** the RPC resolves (leftover 9). Disconnect releases held keys with `listener(false)`.

**Files:** `loader/services.ts`, `loader/wiring.ts`, `sdk/runtime.ts`

#### Theme CSS snapshot and style inject

Pending-head | boot-inject | `DOMContentLoaded` reorder-after-app | reconnect `themes.styles` | live `themes.changed` | stale-reply-dropped. `themeGeneration` counter; `style[data-bgb-style]` as live mode.

**Files:** `loader/wiring.ts`, `loader/styles.ts`

#### Renderer grok-mods migrate

Already-migrated | copy-missing-keys | fail-warn (retry next boot if flag unset). `localStorage bgb:__migrated-grok-mods`. Never overwrites existing `bgb:` keys.

**Files:** `loader/migrate.ts`, `loader/boot.ts`

#### Settings tab vs native router

`null` = native children | `bgb` | `bgb-plugins` | `bgb-themes`. BGB tabs keep `anchor: "general"`; native General stays mounted (`hidden`) while a BGB tab is current.

**Files:** `loader/ui/shell.ts`, `loader/hooks.ts`

#### Configure dialog / InstallRow / key capture

Dialog: closed | open-configured | open-empty (`openKey` vs `HTMLDialogElement.open`). InstallRow: idle | checking | installing | result | failed (local `useState`, not `store.busy`). Key capture: idle | recording (window keydown capture; Escape/blur cancel).

**Files:** `loader/ui/section.ts`, `loader/ui/cards.ts`

---

### 5. Bundled plugins

#### `hostStores` (host vs local)

Boot-local-fallback → host-list (mirror, `hostStores=true`) | host-null (local `[]` so native stays supported) | host-mode read-reject (rethrow). Leftover 7.

**Files:** `plugins/sidebar-folders/runtime.ts`

#### `persistEdit` owned-write session *(W0/W4)*

Unready gate → await predecessor `store.ops` → arm `PersistenceWait.active` → `store.edit` must bump `ops` and set array intent → `writeSections` owned iff `next===payload` → ops settle | 15s `{outcome:unknown}` | client/generation change. UI create/rename/drop all go through this.

**Files:** `plugins/sidebar-folders/runtime.ts`

#### `executeSidebar` / `enqueueUi` serializer *(W0)*

Idle → queued on `commands` promise mutex → running → catch-release. Failures `catch(() => {})` so the queue releases.

**Files:** `plugins/sidebar-folders/runtime.ts`

#### Rename overlay vs native vs observer *(W0 closed re-entry blur-commit)*

Idle → expand collapsed header → watch 2500ms → overlay (`data-bgb-renaming`, `done`) | native input. Later native/re-entry: `abortRenameOverlay` then remove. Enter commit / Esc cancel (never-renamed → `onAbort` delete) / blur commit unless `data-bgb-abort`. `delete-folder` does not abort (leftover 10). `renameWatch` is a process singleton.

**Files:** `plugins/sidebar-folders/runtime.ts`

#### UI create then rename *(W4 closed dual writer)*

`enqueueUi` `persistEdit` (`native.create([])` + default name in one owned write) → `beginFolderRename` → Enter `persistEdit` rename | Esc never-renamed `delete-folder`. Plugin **0.2.8**.

**Files:** `plugins/sidebar-folders/runtime.ts`

#### Drag / drop session *(W1 closed listener leak)*

Idle → in-folder (`data-bgb-drop` + insertion line) → leave-folder (clear highlight, keep capture) → pointerup/cancel/`lostpointercapture`/Escape always `stop()`. `setPointerCapture` on first `pointermove`.

**Files:** `plugins/sidebar-folders/runtime.ts`

#### Collapsed rail vs Folders bar

`__rail-actions && !__new-actions` → `folder-plus` in the rail | else Folders bar before `.sand-agents-list__rows`. Inferred from host chrome (no `sidebarCollapsed` flag). Perpetual `MutationObserver` on `documentElement`. Do not live-dogfood collapse under CDP.

**Files:** `plugins/sidebar-folders/runtime.ts`

#### Empty-sidebar context menu

Closed (`menu===null`) vs open. `emptySidebarSpace` excludes headers/Folders bar/agent rows/pinned tile; includes empty folder body.

**Files:** `plugins/sidebar-folders/runtime.ts`

#### PTT hold / release

Idle → held (synthetic `speech_started`, `sources` Set) → release-tail 150ms; repress-before-tail continues the same turn; shortcut (helper chord) discards instead of answering. Dual `endTurn` writers (150ms timer and `holdsFrame`) — Chromium throttles timers while hidden. Four press sources (DOM key, global-key, pointer, button-key). Host `ServerTurns` pending|manual|vad is explicit and not this graph.

**Files:** `plugins/push-to-talk/runtime.ts`

#### PTT owed response after interrupt *(W2/W5 closed timer-create)*

Not-owed → owed `{generation}` while `responseInFlight` cancel → `create` once on `done`/`cancelled` iff `owedGeneration===generation` | 3s timer logs, clears owed, gives up. `responseInFlight` is set when **sending** create, not only on `created`. Timer must not create.

**Files:** `plugins/push-to-talk/runtime.ts`

#### Grok playback duck hang

Quiet → expecting-reply (8s `replyWait`) → audible Set → hang 700ms after last drain | drop ends at once. Dual `grokTalking` producers by design (replyWait ahead of first word, playback hang between sentences). 8s `expectReply` ducks with no audio if `done` never arrives until the timer.

**Files:** `plugins/push-to-talk/runtime.ts`

#### PTT key recorder

Idle vs recording (steals keyboard, `releaseAll`, darwin Fn watch via keys service). Blur/Escape cancel.

**Files:** `plugins/push-to-talk/runtime.ts`

#### Bot Instructions editor *(W4)*

Viewing (`draft===null`) | dirty | saving | failed — product of three React states. Inner keyed by `row.id`; `currentId.current` ignores stale save/fail after row switch.

**Files:** `plugins/bot-instructions/runtime.ts`

#### Chat Search finder overlay *(half-explicit: `HistoryStatus.phase`)*

Inactive → Finder mount `HistorySearch.start` → complete | error (`retry` / `waitingBaselineRetry`). Close/unmount must `stop()` or a late `loadOlder` mutates another conversation. Overlay itself has no `FindMode` (native owns open via `captureOpen`). Remount key `agentId+sessionId+scope`.

**Files:** `plugins/chat-search/runtime.ts`, `plugins/chat-search/plugin.ts`

#### Voice output sink switch

Idle → switching (serialized `setSinkId` chain) → on-target | abandoned-preferred-default | `outputLost` (error event pins default and resume). A target attempted at most once in a row. Chromium 148 constructor `sinkId` can error/suspend without throw.

**Files:** `plugins/output-device/runtime.ts`

#### Output device list

Unloaded (trust stored preference) → enumerating (`refreshGeneration`) → loaded snapshot | enum-fail keep previous. First enumerate throw returns **before** `devicesLoaded=true`, so `desiredDeviceId` keeps trusting a possibly stale preference until `devicechange` or the settings row remounts.

**Files:** `plugins/output-device/runtime.ts`

#### Startup wait-and-start

Unclaimed → skipped-reload | skipped-not-primary | waiting (client / sign-in / roster / chat offer / bot focus / voice button) → start | give-up 180s | choice-changed | already-in-call. Web Lock `PRIMARY_WINDOW_LOCK` + `sessionStorage` launch marker. Dual producers (snapshots + 1s poll + `offerVoiceCall`). TOCTOU: idle/ended check then `start()` can race a user-started call. Unavailable sessionStorage or Web Locks skips the one-shot forever.

**Files:** `plugins/startup/runtime.ts`

#### Voice dock mounted vs floating

Floating (`docks===0`, chat popover shown) vs docked (`docks>0`, `useDocked` hides popover). Collapsed sidebar unmounts Dock so the floating panel is intended. Host `voiceCall.phase` is read-only.

**Files:** `plugins/voice-dock/runtime.ts`, `plugins/voice-dock/plugin.ts`

#### Voice MCP tool-call replay

Unseen → reserve/execute → result-cached → deliver-once-per-session | mismatch-refuse | late-drop if `!isCurrent`. WeakMap snapshots + WeakMap calls (`scope → callId → {identity,arguments,result,delivered}`). Plugin.ts passes the native `call` object as scope so reconnects share execution. No stdio child here (spawn lives in core MCP).

**Files:** `plugins/voice-mcp/adapter.ts`, `plugins/voice-mcp/runtime.ts`, `plugins/voice-mcp/plugin.ts`

#### Weekly usage hover countdown

Closed vs delay-100ms vs open (1s `nowMs` tick). Panel hidden while `BarView.kind` is `loading`. `BarView.kind` (hidden|loading|meter) is explicit and not this graph. No plugin fetch/cache — `ComposerRing` calls host `usageSummary.load()` on a 5min interval (store throttles).

**Files:** `plugins/weekly-usage/runtime.ts`

---

## Explicit on purpose (not in the catalog)

| Type | Where | Why it is not “implicit” |
| --- | --- | --- |
| `PluginState` | `sdk/manifest.ts` | Report of apply/enable. The *gap* (awaiting-define vs cards) is implicit and listed above. |
| `HistoryStatus.phase` | `plugins/chat-search/runtime.ts` | `loading \| complete \| error` |
| Host `voiceCall.phase` | Grok client; read by voice-dock / startup | We map it; we do not own it |
| `McpServerStatus.state` | SDK / `core/services/mcp.ts` | Report; extra `closed`/`discovery` flags are the implicit overlay (`reportedState` derives the public value) |
| `UpdateState` | SDK | Report; `update.pending` + watchdog is the implicit controller |
| `KeysState` / `MediaState` | SDK | Derived from helper flags |
| `BridgeState` | SDK / loader | Public reconnect report; extra `welcomed`/`everWelcomed`/timers are the controller |
| `BarView.kind` | weekly-usage | `hidden \| loading \| meter` |
| PTT `ServerTurns` | push-to-talk | `pending \| manual \| vad` |
| `RestartResult` | setup restart | Explicit union, single `restartApp` |
| `HookStatus` | platform | `active \| absent \| conflict` |

## Deliberately omitted

- `sidebar-collapse`: CSS `display:none` on a native a11y-only button. No mode graph.
- Voice keepalive: boolean gate into the app’s `sand_voice_reconnect` path.
- Connect apps compact: patch always returns `iconsOnly`. Empty runtime.
- Folder occupancy / `aria-expanded`: host DOM, not a plugin enum.
- Native store readiness checks: gates in front of `persistEdit`, not a separate machine.
- Simple `menu === null` unless it has a non-trivial predicate (empty-sidebar is kept because `emptySidebarSpace` is easy to get wrong).
- `bgbw.exe` fire-and-forget; `json-file` atomic rename retry; `login.ts` `let failed` exit-code latch.

---

## How to talk about one

Pick a title from **Needs further thought**. Useful follow-ups:

- Draw the actual transition table and name a type (or decide it should stay flags).
- Add a stuck-state test (timeout, double-entry, client replacement, kill mid-rename of `bin/`, hello-less helper).
- Timeout still reconciles with `list-*` / `/health` / `status()` before a new write identity.
- Do not wrap Settings layout in `createBoundary`. Do not use the PTT 3s timer as a second `response.create`. Do not mint a new sidebar key to retry an unknown mutation. Do not merge Darwin launchd helper into the Win/Linux child circuit.
