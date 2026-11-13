# Changelog

All notable changes to Better Grok Bot are documented here.

## [Unreleased]

### Fixed

- After a Grok Bot app update, the stale-build guard (`window.stop()` in `<head>`) left a blank window for the length of the renderer rebuild (about a minute on 1.0.3). It now paints an “Updating the interface for Grok Bot …” splash, including creating `body` when the parser never reaches it.
- Chat Search **0.1.10** and Compact Connect Apps **0.1.1**: retargeted for Grok Bot 1.0.1. The root command object now has `chatColumn` before `openFindInChat`. The Connect apps layout helper is no longer hardcoded as `stt` (1.0.1 minifies it to another ident).
- Sidebar Folders **0.2.9**: after a successful host list, a later host reject keeps the last local mirror (does not hide folder UI). `delete-folder` aborts a live rename overlay and disconnects the rename watcher (no blur-commit of a deleted id).
- Sidebar Folders **0.2.8**: UI `+` creates through `persistEdit` (same owned write as agent `create-folder`). Esc on a never-renamed overlay deletes the untitled folder.
- Helper: a Win/Linux child that never says hello is killed after 10s and counts as a failed start (Darwin launchd unchanged).
- Sidebar replay LRU-32 never evicts an in-flight `requestId`.
- Loader `keys.watch` / `media.duck` only mark sent after the RPC succeeds; a failed watch is retried on the next sync. Last unwatch of a held key delivers `false`.
- Darwin with an agent LaunchAgent: `stop(true)` kickstarts; never `bgb agent --replace` while that plist exists.
- Update watchdog: restore failure starts `bin/previous` if it still has a binary, else starts nothing (does not boot the failed new copy). Doctor still does not swap `bin/`.
- Binary commits journal `DATA/bin/.journal.json` (fsync). Agent start rolls a leftover journal back or refuses until `setup --yes`.
- Windows helper `hello.keys` is `denied` until `SetWindowsHookExW` returns a handle; `Access granted` follows install.
- Canary: push `canary-state` with `report: pending` before `gh issue`; comments include `Report-Hash` so a failed push does not open a second issue. Closed issues stay closed.
- Settings plugin cards overlay renderer `loading` (Starting…, toggle off) the same way they overlay `runtime-failed`.
- `component()` does not cache `NullComponent` before `define()`; a later `define()` can recover without reload.
- Bot Instructions editor is keyed by bot id; a save that settles after switching bots is ignored.
- `sidebar.execute` accepts a caller `requestId` (MCP mutating tools forward it). Timeouts say list then retry with the same key; the host no longer mints a new UUID per RPC when the caller supplied one.
- Push to Talk: each press has a generation; owed `response.create` only fires for the current generation; `responseInFlight` is set when sending create; the 3s timer still only logs and now gives up.
- Helper given-up self-arms one `ensureRunning` after the interval while `wanted`. `bgb doctor --repair` resets the Win/Linux child circuit (`keys.install`); macOS stays launchd.
- macOS helper: `setTap` flips `tapEnabled` before `CGEvent.tapEnable`, so own disable is not re-enabled as `tapDisabledByUserInput`.
- MCP public `state` is derived from session flags (`connected` only when initialized and not closed). `tools()` throws unavailable if every enabled server failed to connect.
- Plugin `storage.set()` does not update the cache or notify when `setItem` throws (optional `{ ephemeral: true }` is RAM-only). Star/pin only update UI after a successful write.
- Plugins grid used `@container (max-width: 720px)` on the ~641px pane, so a 945px Grok Bot window was 1-col and no longer matched Userscript++. It now uses USPP's viewport `@media (max-width: 720px)` (2-col at the usual window; long names ellipsis).
- Plugin Configure dialog showed **Authors: Unknown** for bundled plugins (cards already said Unravl) and an empty body for disabled extra-only plugins. Bundled authors are Unravl; disabled extra-only plugins say **Enable this plugin to configure it.**
- Settings overlay died after the first visit: clicking **Better Grok Bot** passed `anchor: "bgb"` into pane-header's heading-link, which does `OL[anchor].label` and threw `Cannot read properties of undefined (reading 'label')`. The tab now reuses the native `general` heading-link key (`id` stays `bgb`). The sticky layout error boundary is also gone — only the BGB pane is bounded, and the native General pane stays mounted (hidden) while that tab is selected.
- Settings → Better Grok Bot could not scroll: native `.sand-settings-panel__body` is `overflow: hidden` (General uses an inner ScrollArea). The card grid is not that scroller, so the BGB panel body now sets `overflow-y: auto`.
- Sidebar Folders: **New folder** is a Folders bar `+` above the bot list (not a 36px header icon next to Search — that sat under the traffic lights). Creating a folder focuses inline rename. Empty folders say **Drag bots here, or right-click a bot** (native was only “Drag Bots here”). Dragging a bot onto a folder highlights the section. Collapsed rail still injects `folder-plus` into `__rail-actions`. Leftover `aside > .bgb-sidebar-folders__new` / header-actions clones are hidden. The bar uses the same `8px 8px 6px` inset as folder rows (FOLDERS was 4px further left than the chevrons); the `+` is 16px on the native count column, not a 20px square. Rename overlay uses the opaque editor fill (`--cursor-bg-editor`) and hides the header name — `--cursor-bg-primary` is 8% white, so “New folder” showed through the input. UI create/rename/drop share the `executeSidebar` queue and persist through `persistEdit`; re-entering rename aborts instead of committing on blur. Drag uses `setPointerCapture` and always stops on `lostpointercapture`.
- Plugin `status()` is `loading` until `define()` runs (cards show Starting…, toggle disabled). Settings error boundaries fail per instance, not process-wide.
- Sidebar `requestId` replays an identical intent instead of mutating twice; a timeout still means check the sidebar, never a blind retry with a new key.
- Push to Talk: after cancel, `response.create` runs once on `response.done` / `response.cancelled`. The 3s timer only logs.
- Helper: overlapping `ensureRunning` coalesces; given-up is a timed circuit breaker (wanted 0→1 or the clock resets it).
- Setup undo that cannot finish records `setupResidual` and exits 1 (never a green summary). Update pending stores the watchdog pid; `bgb doctor` fails if that pid is gone and `/health` is not the new version — it does not swap `bin/`.
- Sidebar Folders: dragging a multi-selected set of bots into a folder moves the whole set (native drop only moved the row under the pointer). Folder headers are valid drop targets.
- Sidebar Folders: when the computer has no sections store (Grok Bot's `getHostSidebarSections` rejects), answer an empty list instead of throwing — throwing left the native cache at `null` and hid every folder UI. Bot context-menu New folder no longer requires the `grok_bot_multiplayer` flag.
- macOS: re-export `VITE_DEV_SERVER_URL` at login from a `/bin/launchctl setenv` LaunchAgent (`io.github.unravl.bettergrokbot.hook`) instead of waiting for the compiled `bgb agent` binary. After reboot the variable is wiped, and the agent can take minutes to reach `reexportHook` — Grok Bot opened from the Dock in that window was vanilla. `bgb login` now setenv's itself too.

### Added

- Bundled **Compact Connect Apps** (`connect-apps`, on by default): keep Connect apps as the compact plus button. Native Grok Bot remounts the Gmail/Drive/Calendar logo strip every time the sidebar expands when fewer than 4 apps are connected.
- Settings: Better Grok Bot is its own Settings tab (left nav), not a section at the bottom of General.
- Settings: a divider, then **Better Grok Bot** / **Plugins** / **Themes** (Userscript++ group). Plugin cards sit on Plugins (not nested in a native Section). Clicking a plugin's gear opens a settings **dialog**; fields stay native `Row` / `Toggle` / `Select`.

### Changed

- Chat Search header control clones the sidebar island Search (icon-only magnifier), not Share's labeled pill. The find bar uses the app's elevated surface and hairline border instead of the violet–cyan gradient.
- Removed the "Better Grok Bot" title from the top of the agents sidebar (window title and in-app name strings stay).
- Weekly Usage hover is Void++'s WeekBlock panel (100ms delay, `12% used` + live `Resets in 1d …` countdown), not a native `title` tooltip.
- Injected icons use the app's `cursor-icons` font (`search`, `puzzle-piece`, `desktop-download`, `waveform`) instead of hand-drawn SVGs next to native chrome. Compact mode hides Export's label, not the whole button.
- Hide the native compact-sidebar control (assistiveTech / CDP). Do not pad or re-justify `.sand-agents-sidebar__header` — that stacked on the traffic-light overlay and sat Search/+ on the pinned bot.
- Chat Search (and Export, if enabled) drop their labels only while the info pane inner is actually open. Do not set `container-type` on `.sand-chat-header__controls` (it collapsed that cluster to 0 width after the pane closed). The pane stays mounted at width 0; the inner is what gets `[hidden]`.

## [0.2.1] - 2026-11-08

### Fixed

- Core hooks and bundled plugins retargeted for Grok Bot 0.79.3 (React 19.3 template-literal version, `createElement(Context)` client, Lingui in the common chunk, Settings General in `chunk-general-pane`, backtick `sand-*` class helpers, `(0,jsx)(...)` calls). `bgb check --asar` against 0.79.3 reports every core hook and bundled plugin active.
- Voice MCP `capture-completed-arguments` no longer emits an extra `}`, which was a `SyntaxError: Unexpected token 'case'` that blanked the renderer.
- Voice Dock `useDocked` is a plain read, not a Hook: 0.79.3's React Compiler caches the chat-popover site, so `useSyncExternalStore` there threw minified error #311 ("Should have a queue") and the app error boundary.
- Voice Dock and Weekly Usage insert as real siblings of the account row by matching `(0,jsx.jsxs)(`div`,{"data-action-engaged"…` instead of splicing inside the `(0, …)` comma call.

### Changed

- The bundled plugins match the README artwork: one violet-to-cyan accent that themes can override (`--bgb-brand-violet`, `--bgb-brand-indigo`, `--bgb-brand-cyan`, `--bgb-brand-gradient`) on top of the app's own colours, so light mode keeps working.
- Weekly Usage: a 6px gradient bar with "42% · Resets in 3 days" shown inline; hovering shows the exact reset time.
- Voice Dock: the docked call becomes a card with the bot's name, its status and call timer ("Connected · 3:12:45"), 34px round buttons, a red hang-up button on the right and Push to Talk's key hint underneath.
- Push to Talk: the key is a keycap chip ("Press a key…" while recording), the music levels are gradient sliders with their percentage beside the label, and the call's hold-to-talk button is a gradient circle with a "Hold Right Option to talk" hint in the voice dock.
- Sidebar Folders: every folder shows a chevron, a folder icon and its bot count (open or collapsed), rows have rounder corners, and the drag line uses the accent.
- Chat Search: the find bar is a gradient-bordered pill with a "1 of 3" counter, and matches are highlighted in the accent colours. This applies to every find bar in the app.
- The "Better Grok Bot" label at the top of the sidebar is set as a title.
- The README banners, logo and social card show the Grok Bot icon redrawn with glowing cyan eyes.

## [0.2.0] - 2026-10-11

### Added

- Sidebar Folders turns the app's sidebar sections into folders: create them (also by right-clicking empty sidebar space), rename and delete them, drag bots in and out, and drop a bot at the pointer to reorder a folder. When the connected computer stores no sections, Better Grok Bot keeps the folders itself, so they always work and survive restarts.
- Voice Dock docks the voice-call controls (status, call settings, transcript, mute, hang up) in the sidebar footer with compact buttons, so they stay reachable from any bot; the chat view's floating call panel is hidden while docked and is used again when the sidebar is collapsed.
- Weekly Usage shows your weekly usage as a bar with its percentage above Connect Apps in the sidebar, with the days until it resets on hover. It reads the same usage summary as Settings → Usage, asks the app to refresh it every 5 minutes while shown, and stays hidden for enterprise seats and plans without a weekly limit.
- Bot Instructions adds an Instructions editor to the info pane's Overview tab for bots you own or manage, where the app shows its own description editor only for team bots. It saves the bot's description with the app's own call; ⌘/Ctrl+Enter saves and Escape cancels.
- Chat Search adds a button to bot conversation headers, searches earlier history with the app's native finder, and jumps between highlighted matches. History loading reports incomplete results, supports retry, and stops requesting pages when search closes or the conversation changes.
- The app is called Better Grok Bot (core hook `bgb-brand`, always on): the window title, the messages where the app names itself (welcome, settings, updates, restart prompts) in every language, and a label at the top of the agents sidebar; the assistant keeps the name Grok Bot.
- Installers accept `BGB_APP_PATH`, passed to `bgb setup --app` as one argument so paths with spaces work; `BGB_SETUP_ARGS` is for simple space-separated flags only.
- Voice MCP adds Settings → General → System → Voice MCP servers for named stdio, Streamable HTTP and legacy SSE servers, with JSON args/env or authentication headers and optional stdio working directories. New servers save disabled; connection testing does not execute tools. Explicitly enable and manually rejoin/start voice to use tools; normal text chat is unchanged. Local runtimes must be installed, and OAuth is not supported.
- BGB Sidebar Folders adds a disabled-by-default Voice MCP preset and standalone `bgb [--data-dir <DATA>] mcp sidebar-folders` stdio server to list bots/folders, create folders, move bots and delete containers without deleting bots. Setup preserves existing choices and user ID collisions. Voice actions target their originating window; context-free external clients refuse multi-window ambiguity. Enable both plugins and the preset, manually open the updated app and start a new voice conversation. Sidebar actions report success only after the owned native operation or the fallback copy's persistence is confirmed; failures, timeouts and client resets can have unknown outcomes and are not automatically replayed. Their errors keep their codes and candidate details.
- The `mcp` permission and required `ctx.services.mcp` SDK service provide list/save/remove/connect/tools/call with browser-safe types, enabled-only tool access, deadlines, explicit failures and preserved MCP content/structured results/error flags. Full configurations persist host-wide in unencrypted `DATA/mcp.json` (mode `0600`). Enabled tools act without per-call prompts; schemas/results reach the remote voice model. Plugin-ID grant checks are not a sandbox against plugins sharing the renderer and bridge token.
- Plugin storage: `ctx.storage.set(key, value, { requirePersistence: true })` rejects known persistence errors without updating the cache; the default is unchanged.

### Fixed

- Windows `uninstall --purge` deletes everything outside `DATA\bin` right away (unlinking the `current` junction without following it), then removes the rest once `bgb.exe` has exited with a `cmd.exe` that reads the path from the environment through delayed expansion, so characters in the path (`&`, `%`, `^`) cannot change the command. If DATA survives, the reason is kept in `%TEMP%\bgb-uninstall.log`.
- `uninstall --purge` keeps DATA while a hook it does not own still points at this install's renderer.
- The build key hashes exactly the plugin files the build assembles, so a plugin replaced mid-build can no longer leave a cached renderer with stale plugin code.
- Plugin install, update and uninstall swap the package and commit its grant as one step under the build lock, so concurrent operations cannot leave mismatched grants or bring back an uninstalled plugin; approving an update's new permissions fails if the plugin was uninstalled or replaced after the prompt.
- The Grok Bot version read from `app.asar` must be a plain version, and builds refuse destinations outside `DATA/builds`.
- Windows builds and checks the new `current` junction before swapping it in; a failed publish no longer leaves `current` missing.
- A failed macOS helper install (including `launchctl bootstrap`) is removed and reported as needs-install with its error, and the next install retries.
- When the update watchdog cannot restore the previous version it keeps the pending update, records the manual recovery step and says so, instead of claiming a rollback.
- macOS app discovery tries every Spotlight result instead of failing on the first unusable one.
- A window that starts watching a key that is already held gets an initial key-down.
- An open window's plugin settings stay on the loaded schema until reload, so settings added by an update no longer hide the settings section.
- A plugin that failed in this window shows its toggle off once disabled and can be re-enabled without reloading.
- A slow theme-styles reply after reconnecting no longer undoes a newer live theme change.
- Output Device serializes sink switches and reconciles to the latest choice, so audio no longer stays on a previously chosen speaker.
- Push to Talk returns music to the "while I talk" level when the key is pressed again during the release tail.
- Native helpers: a modifier released while the key listener starts is no longer latched as held; key events can no longer arrive release-before-down; a Windows keyboard hook that fails to install is reported as an error and retried; Windows ducking keeps a player's original volume after a transient volume-set failure.
- `fetch-upstream` keeps downloads inside its cache, fails when the Windows installer fails, and checks the installed Grok Bot version; the canary issue tracks only the currently published commit.

## [0.1.0] - 2026-10-11

### Added

- Initial release: `bgb` CLI and background agent, plugin/theme system, bundled plugins (output-device, push-to-talk, startup, voice-keepalive), native key/media helpers, self-update.
