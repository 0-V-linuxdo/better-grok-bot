# Correction plan: leftover implicit machines (after W0–6)

Companion to `docs/implicit-state-machines.md` § Needs further thought. W0–6 already landed; this is the next 10. Industry analogs, then a BGB-shaped fix. Not XState — keep flag/queue style.

Do not implement from this file until asked to 落地.

**W7–9 landed (2026-11-10).**

## Waves

| Wave | When | Items |
| --- | --- | --- |
| **7** | User-visible leftovers of W0/W4 | 7 `hostStores` latch · 10 overlay vs `delete-folder` |
| **8** | Races leftover of W2/W5 | 5 hello-less child · 8 LRU evicts in-flight · 9 `sentCodes` before ack |
| **9** | Agent / native / scripts | 1 launchd dual writers · 2 restore-fail `startAgent` · 3 RAM journal · 4 Windows hello granted · 6 canary outbox |

Do not reopen W0–6 holes (rename blur-commit, process-global boundary, timer as second `response.create`, mint a **new** sidebar `requestId`, doctor swapping `bin/`, merge Darwin launchd helper into the Win/Linux child).

---

## 1. Agent stop dual writers

**Now:** Darwin `KeepAlive` is one supervisor. `stop(restart)` only `respawnAgent` when `!underLaunchd`. `--replace` waits 15s for the record. `startAgent` still bootstrap/kickstart if the plist exists, else detached spawn. Bootout + spawn, or spawn while KeepAlive is loaded, can leave two agents or none.

**Industry:** `KeepAlive` means launchd must always try to keep the job running — that job is not also argv-spawned.[1] systemd is the same class: one manager, `Type=notify` / `systemctl`, not a second `fork` of the same unit.[2]

**Fix (wave 9):**

1. If the agent plist is loaded: restart = `launchctl kickstart -k` only. Stop without restart = `bootout`. Never `spawnDetached` / `--replace` while that plist exists.
2. `--replace` on Darwin under launchd: wait for KeepAlive’s new pid (existing 15s record wait), do not spawn a third process.
3. Keep Win/Linux `--replace` as the only non-launchd writer.

**Files:** `core/agent/restart.ts`, `core/agent/agent.ts`, `core/platform/darwin.ts`, `core/platform/agent-control.ts`

**Test:** Darwin with plist present: `stop(true)` does not spawn `--replace`; kickstart is the only start.

**Not doing:** Merge Darwin helper launchd into the Win/Linux helper child. Disable KeepAlive.

---

## 2. Self-update restore-fail still `startAgent` of current `bin/`

**Now:** Watchdog timeout stops whatever is running, `restorePrevious`, then **always** `startAgent` of `bin/` so there is not zero agents. Restore failure keeps `update.pending` (W3). `bin/` may still be the failed new version.

**Industry:** Chrome OS A/B: if the update fails to apply, the user stays on the old system; if it applies but fails to boot, the system rolls back to the old partition.[3] It does not boot the broken copy and call that success.

**Fix (wave 9):**

1. Restore success → start `bin/` (now previous). Clear pending (already).
2. Restore fail + `bin/previous` still has a binary → start **that path** without doctor swapping `bin/` (W3). Keep pending. Notify.
3. Restore fail and no previous binary → start nothing, pending stays, doctor fails. Prefer no agent over a silent new binary.
4. `spawnDetached` pid still written when defined; undefined stays “watchdog gone”.

**Files:** `core/update/self-update.ts`, `core/commands/doctor.ts`

**Test:** restore throws → `startAgent` is not called with `paths.bin`; pending remains.

**Not doing:** Doctor swapping `bin/`. Pretend the new version is healthy.

---

## 3. Binary rename journal is in-memory

**Now:** `moveTransaction` journals `{from,to}` in RAM. Throw rolls back newest-first. Kill mid-rename can leave `bin/` split across `previous/` and `.staged-*` with no recovery token. `half-installed` is not a named on-disk state.

**Industry:** dpkg unpacks to `.dpkg-new`, backs up old objects as `.dpkg-tmp` on disk, and rolls those backups back if needed; `half-installed` is a recorded package state.[4]

**Fix (wave 9):**

1. Before the first rename, write `DATA/bin/.journal.json` (`{moves:[]}`, fsync).
2. After each rename, append the move and fsync.
3. On success, delete the journal.
4. Agent start: if the journal exists, finish rollback (newest first) or refuse to start until `setup --yes`. Doctor still does not swap `bin/`.

**Files:** `core/setup/binaries.ts`, `core/agent/agent.ts`

**Test:** journal present with one move → start rolls it back or exits 1; no journal on a clean commit.

**Not doing:** A second `bin/` writer. Full dpkg status database.

---

## 4. Windows helper hello `keys=granted` before the hook exists

**Now:** `HookKeys::start` succeeding is enough for `hello.keys=granted`. `SetWindowsHookEx` is later, 1s…60s denied backoff. `access: granted` already follows a real install. Agent may `watch` into a still-unhooked thread.

**Industry:** `SetWindowsHookExW` returns the hook handle on success and **NULL** on failure.[5] Capability is not the same as “the hook is in the chain”.

**Fix (wave 9):**

1. `hello.keys` is `denied` (or omit granted) until `SetWindowsHookExW` returns non-NULL. Codes list can still advertise what the helper *can* watch.
2. Keep `Access { keys: granted }` as the live transition (already).
3. Agent `KeysState` follows Access after hello, not hello’s first word.

**Files:** `native/helper/src/windows/mod.rs`, `native/helper/src/windows/keys.rs`, `core/services/index.ts`

**Test:** hello before first successful `SetWindowsHookEx` is not `granted`; Access granted fires after install.

**Not doing:** A new SDK `pending` state unless Access already needs it. Changing Darwin TCC.

---

## 5. Win/Linux child that lives without hello never given-up

**Now:** `fail()` only on spawn error or `exited` before hello. A hung child that never sends hello does not increment `failureCount` and never arms `givenUpTimer`. Darwin launchd is a second controller — do not merge.

**Industry:** systemd `Type=notify`: no `READY=1` within `TimeoutStartSec=` → the service is failed and shut down.[2] Kubernetes startupProbe: if it never succeeds, the container is killed and subject to `restartPolicy`.[6]

**Fix (wave 8):**

1. On spawn, arm `helloDeadline` (existing helper timeouts order: shorter than idle, e.g. 10s).
2. Fire while `child && !saidHello && wanted`: kill child, `fail()` (counts toward given-up).
3. `helloReceived` / `stop` / unexpected exit clear the timer.
4. Darwin: no hello deadline on a launchd job (KeepAlive + Swift reconnect stay).

**Files:** `core/services/helper.ts`

**Test:** child that never hellos is killed once; `failureCount` increments; given-up still self-arms after the burst.

**Not doing:** Merge Darwin helper into this child circuit. Treat hello timeout as a second `response.create`.

---

## 6. Canary GitHub issue vs `canary-state` push

**Now:** Open/comment/close the GitHub issue, then set `reportedHash` in memory, then `git push` (3× backoff). Failed push leaves the issue already mutated and hash unpersisted → duplicate comments. Closed issues are not reopened.

**Industry:** Transactional outbox: record the intent in the same datastore transaction as the business write; a relay performs the side effect; consumers are idempotent because the relay can publish twice.[9]

**Fix (wave 9):**

1. Commit+push `canary-state` with `{hash, report: "pending"}` **before** `gh issue create/comment`.
2. Relay: if `pending` and issue/comment not yet applied, apply, then push `report: "done"`.
3. Idempotent consumer: skip create/comment when an existing comment body already contains that hash.
4. Keep “closed issues are not reopened” unless `--force`.

**Files:** `scripts/canary.ts`

**Test:** issue create then failed push → next run does not open a second issue (hash in comment or pending row).

**Not doing:** Reopening closed issues by default.

---

## 7. `hostStores` latch

**Now:** First successful host list sets `hostStores=true` and mirrors locally. A later host **reject** rethrows (no local fallback) and can hide every folder UI. On Grok Bot the computer usually always rejects, so this stays cold.

**Industry:** VS Code `FileSystemError.Unavailable` means the filesystem is busy or unavailable — not that the folder never existed.[10] Chrome OS: if an update fails to apply, the user continues on the old system.[3]

**Fix (wave 7):**

1. Host reject after `hostStores`: log, return the last local mirror (or last successful list). Do **not** rethrow.
2. Do not clear `hostStores` on a single reject. Next successful host list refreshes the mirror.
3. Host null still means local `[]` so native stays supported (unchanged).

**Files:** `plugins/sidebar-folders/runtime.ts`

**Test:** host list then host reject → `readSections` still returns the mirrored list; UI not hidden.

**Not doing:** Treat Grok Bot’s always-reject as a host. Unassigned empty-folder spacer.

---

## 8. Sidebar replay LRU-32 can drop an in-flight `requestId`

**Now:** W2/W5 closed mint-new-UUID. Renderer `sidebarReplay` is a Map LRU-32 of Promises. Evicting the oldest can drop an **unsettled** Promise; a later retry of that key runs a new mutation. First rejection (including `unavailable` before `define()`) is what replay returns.

**Industry:** Stripe saves the first result after execution begins; a concurrent retry of the same key is a 409 — wait and retry the **same** key, a new key can start a second operation.[7][8] Keys are retained for hours, not a 32-slot LRU of in-flight work.

**Fix (wave 8):**

1. Never evict an unsettled Promise. LRU (or cap 32) applies only to **settled** entries.
2. If size > 32 and every entry is in-flight: refuse eviction; newest still runs (sidebar mutations are already serialized).
3. Keep: timeout = list then same `requestId`. Do not mint a new key.

**Files:** `loader/bridge-client.ts`

**Test:** 33 overlapping keys: the first in-flight Promise is still the replay target; a 34th settled eviction does not replay-execute.

**Not doing:** 24h disk cache. JSON-RPC `id` as the idempotency key.

---

## 9. Loader marks `keys.watch` / `media.duck` sent before the RPC resolves

**Now:** `sentCodes` / `sentLevel` are assigned, then `bridge.request`. Fail only logs; retry only on welcome or when the union/level **changes**. Last unwatch deletes `downCodes` without `listener(false)`.

**Industry:** Optimistic update: on error, roll back to the snapshotted value; do not treat the mutation as the new server truth until it settles.[11]

**Fix (wave 8):**

1. Assign `sentCodes` / `sentLevel` only in the request **success** path.
2. On fail, leave the previous sent snapshot so `syncWatch` / `syncDuck` retry the same union.
3. Last unwatch: still `listener(false)` for every code that was down.

**Files:** `loader/services.ts`

**Test:** `keys.watch` reject → next `syncWatch` sends again; unwatch with a held key delivers `false`.

**Not doing:** Marking sent on timeout as success.

---

## 10. Rename overlay vs `delete-folder`

**Now:** W0 closed re-entry blur-commit. Agent/UI `delete-folder` does not `abortRenameOverlay`; a live overlay can stay on `body` after the header is gone. `renameWatch` is a process singleton (a second create disconnects the first).

**Industry:** React destroys a component’s state when it is removed from the tree.[12] VS Code `FileSystemWatcher.onDidDelete` is the “this identity is gone” signal.[10]

**Fix (wave 7):**

1. Start of `delete-folder` (and any `persistEdit` that drops that `section.id`): `abortRenameOverlay`.
2. `renameWatch`: if the header for the overlay’s `sectionId` is gone, abort (do not commit).
3. Keep the singleton watch: a second create already aborts the first overlay (W0).

**Files:** `plugins/sidebar-folders/runtime.ts`

**Test:** overlay open → `delete-folder` → no `.bgb-sidebar-folders__rename` on `body`; no blur-commit of the deleted id.

**Not doing:** Re-opening blur-commit. Unassigned spacer.

---

## Suggested landing order

**7 → 8 → 9** (same shape as 4 → 5 → 6: user-visible, then races, then agent/native). Wave 9 includes a helper hello change (item 4) but not a macOS helper rebuild.

## Sources

[1] https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html
[2] https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html
[3] https://chromium.googlesource.com/aosp/platform/system/update_engine/+/master/README.md
[4] https://manpages.debian.org/trixie/dpkg/dpkg.1.en.html
[5] https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowshookexw
[6] https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes
[7] https://docs.stripe.com/api/idempotent_requests
[8] https://docs.stripe.com/error-low-level
[9] https://microservices.io/patterns/data/transactional-outbox.html
[10] https://code.visualstudio.com/api/references/vscode-api
[11] https://tanstack.com/query/latest/docs/framework/solid/guides/optimistic-updates
[12] https://react.dev/learn/preserving-and-resetting-state
