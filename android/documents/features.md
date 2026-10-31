# Features

## Compact Local provider commits

- WebView/native commit payloads contain only affected prior/resulting file entries; omitted entries remain unchanged.
- Full runtime snapshots remain available for acknowledgement and recovery. Native commit payloads carry changed directories plus affected parent context, preserving parent/collision validation without serializing every unrelated folder.
- Unrelated file content is not serialized across the bridge or read by native save operations.
- Native safety remains fail-closed for stale sources, destination collisions, failed destination writes, and untracked folder contents.
- Verified from committed source by the complete JavaScript/browser gate and buildbox `test lint assembleDebug`; the signed APK contains all 136 generated assets byte-for-byte.
- the project owner's first physical use of 0.2.19 confirmed operations are about twice as fast, but still somewhat slow.
- Follow-up 0.2.20 tracks dirty in-memory paths, reuses acknowledged encodings for unchanged files, and replaces whole-tree JSON equality during ordinary commits. A synthetic 1,000-file/8 KiB benchmark reduced 20 snapshot passes from 471.96 ms to 45.16 ms (10.5× on the development host).
- the project owner's physical 0.2.20 test remained slow. Native tracing found each provider write read the resulting file twice after its already-verified staged readback, in addition to the required stale-source checks. The 0.2.21 path returns the verified staged bytes through the direct-operation acknowledgment and removes both duplicate post-write content reads without weakening stale checks, staging, rename confirmation, rollback, or provider acknowledgment.
- A provider-backed regression confirms a one-file commit now performs three read opens (two stale-source checks plus one staged readback) instead of five. Final verification passed 38/38 runtime tests, 6/6 adapter checks, bundled-editor acceptance, and buildbox `test lint assembleDebug` (75 tasks: 38 executed, 37 up-to-date). All 136 APK assets match source. Physical 0.2.21 timing remained the acceptance gate.
- the project owner's physical 0.2.21 test showed no perceptible delay improvement, ruling out duplicate content reads as the dominant cost. The 0.2.22 investigation instrumented provider cursor rows and found a one-file save in a folder with 300 siblings scanned 1,211 sibling rows because stale checks, destination checks, and staging repeatedly resolved the same SAF path. Commit-scoped positive path resolution now reuses document handles only within one synchronized transaction, clears them after the transaction and invalidates mutated paths; content stale checks still reopen and compare current bytes, provider staging/readback/rename/rollback remain unchanged, and absent destinations are not cached.
- the project owner's physical 0.2.22 test confirmed the path-resolution change is perceptibly faster. The 0.2.23 follow-up separately instrumented single-document metadata calls: the same save still made eight synchronous provider queries because `DocumentFile.isFile()` / `isDirectory()` discarded MIME/type information already returned by the child cursor. The transaction-scoped resolution cache now retains that MIME classification, reducing the measured save to fewer than three metadata queries while keeping the post-rename display-name confirmation fresh. Focused save, create, move, stale-source, failed-install and rollback regressions pass; physical 0.2.23 timing remains the acceptance gate.
- The 0.2.24 follow-up removes five additional whole-workspace costs: sparse changed-directory/parent bridge context replaces full directory arrays; moved binary materialization is cleared after each native transaction; opaque SAF references use field equality instead of repeated JSON serialization; attachment moves use one ID index instead of repeated workspace searches; and manual commits keep text textual while finding the write set instead of base64-encoding every note/style. Regressions cover a 10,000-folder sparse payload, opaque binary state after a move, unchanged attachment decode counts, and the complete runtime/browser/native safety matrix. Physical Android SAF/WebView timing remains a separate acceptance gate.
- The 0.2.25 maximum-effort pass makes Local persistence dirty-path driven end to end: files and directories have separate dirty sets; snapshots patch acknowledged maps and reuse unchanged directory arrays; tree-change and unavailable-path checks inspect only touched paths; retained unavailable metadata is skipped when empty; moved SAF references are indexed and materialized only when changed; and attachment sizes are cached across snapshot/delta projections. Native direct operations also stop repeating provider lookups after provider-confirmed create/delete calls, while staged writes still read back and compare bytes before installation and reuse the already validated encoded payload instead of encoding it again. The complete JavaScript/browser suite and native `test lint assembleDebug` gate cover collision, stale-source, destination-first move, failed-save, recovery, rollback, opaque-reference, and directory-resurrection safety. Physical Android SAF/WebView timing remains a separate acceptance gate.
- The 0.2.26 persistence format removes the remaining monolithic-write bottleneck. `state.json` is now a compact transactional index; complete note records (including current text and history) live in 16 deterministic buckets. A steady-state edit writes only the Markdown file, one bounded immutable bucket generation, and the compact index. Buckets are provider-confirmed before `state.json` performs the logical switch, and the previously referenced generation remains available across interruption; only older unreferenced generations are cleaned on a later transaction. Legacy inline state migrates on the first confirmed mutation. Reopen hydration, external-edit history, unavailable-path retention, failed saves, stale sources, collisions, destination-first moves, recovery, and rollback remain covered by the complete regression gate.

## Accurate Local revision history

- Android Local preserves the revision appended for every successful manual save rather than replacing it with the pre-save history array.
- Revision Changes now compares against the immediately preceding saved text, so a small edit does not display the whole existing file as newly added.
- Consecutive-edit/reopen regression coverage verifies the original and intermediate contents remain ordered and recoverable.

## Server-origin identity return — partial prototype only

Shared domain model is not wired into Android bundled UI or SAF metadata and is not an available Android feature. Runtime parity/device acceptance are unverified. See `identity-return-status.md`.

## First-party video capture — deployed

Deployed as `video-51bddf3` from code revision `51bddf3d8d0ad1df90742123096c89925d8f4dea` to https://spire.example. All 133 candidate assets matched the accepted build (service-worker ordering normalized with identical logic/precache set); served HTML and entry JS/CSS matched. Healthy container, HTTPS health, anonymous snapshot 401, existing writable data volume and loopback binding verified. Anonymous live sign-in loaded without page errors. Application/full-volume backups and checksums verified at `/srv/spire/backups/video-51bddf3-20261010T123313Z`; rollback image/config retained. No source push, authenticated production editing, physical WebView acceptance or rollback drill performed.


Media → Video capture opens local videos or accessible public video feeds. The Spire-owned interface provides playback, seeking, speed controls, approximate 1/30-second stepping, frame preview, and clips up to 30 seconds / 8 MB. Insertion preserves the file/template cursor and saves a durable attachment plus reusable Source with timestamp citation. Source and attachment persistence is atomic and capture retries are idempotent. Export/import preserves media and readable Markdown/HTML citations.

No new player/extractor dependencies were added. Browser-native decoding/encoding and Node built-ins underpin Spire-owned implementation. MP4, WebM and Ogg support depends on browser codecs. Local originals are not uploaded. Public links use authenticated, device-bound expiring playback tickets, public-IP/DNS checks, redirect validation and bounded streams. Arbitrary pages, protected streams and DRM are not guaranteed playable. Unknown creators stay blank; users review attribution.

Desktop Record video tab is an explicit browser-permission fallback. Stop recording, scrub the result and set the original-video start offset before capture. The selected tab can include surrounding UI; this is not automatic video extraction or DRM bypass. Physical browser permission-picker behavior is not proven by simulated-stream tests.

Verification: production build; 95/95 unit/API tests; 103/103 full browser regressions; six focused video tests including simulated desktop tab-stream recording. Real public MP4 resolution and byte-range streaming verified. A real YouTube page returned its title/channel but no playable feed, honestly offering the fallback. Android loads this shared hosted interface; existing file chooser supports local video selection. No native changes or replacement APK are needed. Physical Android/WebView acceptance remains unverified.


## Shared template writing toolbar — deployed

Deployed code revision `25db76e` as `toolbar-25db76e` to https://spire.example. Production build, 80/80 unit/API tests and 93/93 browser tests passed, including sidebar outside-click dismissal, animated folder drag/drop, empty-folder deletion and file wording. All 127 candidate assets match the accepted build (equivalent generated service-worker ordering); served HTML and entry JS/CSS match. Live health returns ok, anonymous snapshot returns 401, container is healthy, and the original writable named volume and loopback-only binding are retained. Application/full-volume backups and checksums verified at `/srv/spire/backups/toolbar-25db76e-20261009T193505Z`; rollback image/config retained. No source push, physical phone access, authenticated live editing or microphone recording test was performed. Physical Android WebView acceptance remains unverified; shared UI is delivered through the existing hosted client without a replacement APK.


Template editing now reuses the normal writing toolbar in Editor and Source modes: text styles, highlighting, headings, lists, capitalization, code/quote blocks, tables, media/attachment insertion, dates/times, alignment, spacing, page breaks, links, tags and nested templates. Save template remains separate from workspace-file saving; saved templates update in place and built-ins save editable copies. Complex-template desktop/touch coverage verifies save/reopen persistence without creating workspace files. Microphone recording and physical Android WebView acceptance remain unverified.

The existing outside-click sidebar dismissal, animated folder drag/drop and empty-folder deletion with file terminology remain required release checks. Status-bar test assertions were updated to include authoritative file counts and zero pending changes; production behavior was not weakened. Android consumes this hosted UI through MainActivity.loadUrl(server+"/"); no native source change or replacement APK is needed.



## Code-language selection and template creation — deployed

Deployed hosted code revision `40ae5f5` as `code-templates-40ae5f5`. All 122 tested asset hashes matched the image; live entry `/assets/index-Csu7sKjd.js` matches the tested hash and contains template creation and Code language controls. HTTPS health passes, anonymous snapshot returns 401, container is healthy, original read/write data volume and loopback port are preserved. Application backup and volume archive passed verification/checksums; rollback image is retained. No physical Android WebView test or source push was performed.

Blocks → Code provides a language selector based on highlight.js languages/aliases, plain code, JSX/TSX and a custom language tag. Insertion preserves captured selection, surrounding source and literal pasted backticks using a safe fence. Empty insertion and Quote behavior remain supported. Focused browser acceptance passed on desktop and touch, including Bash/Python/TypeScript/custom tags and save/reopen. Saved section/full template creation passed all four desktop/touch category checks with exact complete-source preservation and reuse. The Android shell loads the same hosted feature; no native implementation is necessary. Physical Android WebView acceptance remains unperformed.

## Unified Android app settings — hosted support deployed; physical client acceptance pending

the project owner approved Aphelion's proposal to move Reload, Print / Save PDF, Server connection and About into the hosted Settings surface. Settings → Android app appears only when the APK supplies the origin-scoped message bridge; ordinary browsers and older APKs retain their existing Settings tabs without Android controls. The new 0.1.1 (versionCode 2) client removes the separate native header/overflow menu. Native confirmations still protect reload/server switching; a native Server connection recovery control is shown on main-page connection/HTTP/TLS failure so an unreachable hosted Settings screen cannot trap the user. No account or cache migration, new offline guarantee or editing-lease changes.

Both canonical repositories are required for this feature: `/workspace/spire` supplies the Settings UI and `/workspace/spire-android` supplies the allowlisted native bridge and updated APK. Native accepts only info/reload/print/connection/about from the selected HTTPS origin's main frame, rejects stale WebViews, and reports current version/server metadata. Hosted browser regression was proven failing before implementation and passing afterward. Final hosted acceptance passed 77 unit/API tests and 83 browser tests. Compatible hosted support is deployed in `code-templates-40ae5f5`. Physical WebView/print-dialog acceptance and source push remain unperformed; APK build verification is tracked separately.


## Hosted Spire Android client
HTTPS configurable server connection and persistent WebView session, native file picker/export, microphone permission handling, Back navigation, PDF printing, R8 minification and resource shrinking. See README.md for boundaries.

## Nested folders — deployed with saved templates

Folders render as an indented expandable tree, including ancestors implied by deep stored paths. New folder includes a Parent folder selector (Reliquary root or an existing folder) and a name/relative path. File creation can target any tree level; sidebar nodes retain full canonical paths for existing file drag/drop and folder deletion. Search keeps ancestors of matching descendants visible. No content migration or storage format change is required. Server deletion recognizes implied parents and preserves relative child paths during reassignment.

Both surfaces: the Android client loads this hosted UI; no native source change or replacement APK is required. Final production build, 76/76 unit/API tests and 80/80 browser checks passed, including the five nested-folder regressions. Android download adapter passed 6/6 in Chromium. Physical Android WebView acceptance is not performed. Included in deployed release `save-templates-245919d`; no repository push.

## Save page as template — deployed

Context → Template provides a template name and **Save as section template** / **Save as full template**. Both snapshot the entire current draft source without trimming or normalizing frontmatter, leading/trailing whitespace, Unicode or line endings; only the library category differs. Saving does not rewrite the source file. Templates persist in authenticated server state, synchronize to client snapshots, and appear beside the existing built-in choices in the matching category of the Templates picker. Insertion preserves existing writing. Same-category duplicate names reject rather than overwrite, and failed network saves display an error without stale success feedback. Verified backup parsing retains saved templates rather than dropping the new State field.

Acceptance: 76/76 unit/API tests, production TypeScript/Vite build, and 80/80 browser tests passed. Saved-template browser coverage verifies both categories on desktop and narrow touch-capable layouts, exact source, duplicates, failed requests, correct-category visibility, insertion and save/reload persistence. Android download-adapter checks passed 6/6 in Chromium. Android loads the same hosted UI; no native source change or replacement APK is required. Physical Android/WebView acceptance remains unperformed. Deployed code revision `245919d` as immutable release `save-templates-245919d` to https://spire.example with the project owner’s approval. All 122 staged asset hashes match the accepted local build; live HTTPS entry JS/CSS match it too. Application backup and full-volume archive passed independently rechecked checksums, and archive readability was verified. Container healthy; original named volume, loopback-only binding and Caddy network preserved. Active-release pointer matches the running release; incumbent image pinned and rollback Compose retained. Fresh anonymous live browser sign-in renders without page errors; HTTPS health succeeds and anonymous private API access is rejected. Authenticated live template saving, physical Android/WebView behavior and a rollback drill were not performed. No repository push. Relative links and attachment paths remain literal; cross-folder reuse may require adjustment. Template-library management and offline template creation are outside this feature.


## Main-area template editing
Selecting a template from the library or map opens it in the main visual/source editor, not a sidebar source preview. Save template updates saved templates in place with a stale-content conflict guard. Built-ins save as editable copies. File insertion remains explicit, and template editing does not create or modify workspace files. Hosted UI is reused by Android; no native changes or APK required. Production build, 80 unit/API tests and 91 browser tests passed, including desktop and simulated-touch template persistence. Physical Android WebView acceptance remains unverified. Deployed as template-editor-77cc5a5; all 127 candidate/live assets matched. Live health and anonymous-access protection verified; data volume retained, application/full-volume backups verified and rollback image retained.

## Source type dropdown
Custom monochrome picker replaces the native Source type select: seven labeled icon rows, descriptions, selected checkmark, large touch targets, scrolling, outside dismissal, Escape and arrow/Home/End keyboard navigation. Production build, unit/API suite and complete browser suite passed. Shared hosted UI reaches the Android WebView without a native APK change; physical WebView acceptance remains unverified.

Source type picker deployed and served HTML/JS/CSS verified equal to the accepted build. Health passed; backup and rollback retained. 91 unit/API tests and 96 browser tests passed. Physical Android WebView acceptance unverified.

## Home navigation — live
Added a Home icon beside Spire in the top header; returns from writing, Settings and Calendar to the main page, saving the current file locally first. Removed / T.M. Wrath from header and sign-in branding. Release home-navigation (implementation 7a41d44); backup home-navigation.json verified, container healthy, original writable data volume preserved, HTTPS health and exact tested/served JS equality verified. Build and 98 unit tests passed; six focused desktop/touch tests passed. Earlier broad-suite limitations remain; physical Android WebView testing not performed. Android receives this shared UI via its configured hosted WebView; no native change or APK required. No source push.

## Android local-folder and server client replacement — requested

the project owner requests replacing the hosted-only Android shell with a 1:1 Spire client matching the current Electron Windows client's local-folder and remote-server choices. Status: implemented and build-verified in 0.2.0 (versionCode 4); signed APK produced. Physical-device/real-SAF/IME acceptance remains pending. See README.md and documents/build-verification.json for exact scope and limits.

Acceptance:
- Reuse the canonical Spire editor/interface and complete feature surface, including the latest compact Help; no reduced native editor.
- Bundle the interface so local workspaces launch with no network/server dependency.
- Open a user-selected Android folder via the Storage Access Framework with persistable permission; work with actual portable Markdown and attachments, not just an imported browser cache.
- Support local create/edit/save/reopen, folder operations, attachments, templates, metadata, history/recovery and external-change protection; preserve ordinary files and existing contents.
- Preserve HTTPS server connection, authentication, existing cached writing and per-origin isolation; connect to the existing Docker-hosted server.
- Local-folder and server workspaces are separate choices, matching current Electron behavior. Automatic bidirectional folder/server mirroring is not implied or silently enabled.
- Preserve package identity and upgrade data. Do not clear old WebView cookies/storage or uninstall the existing app.
- Narrow origin/main-frame-only native bridges; remote pages must never gain local-folder access. Handle revoked grants, process death, rotation, interrupted writes, switching workspaces and unavailable server explicitly.
- Verify source parity, automated tests, Android lint/build, canonical Mini debug signing and exact APK delivery. Device verification must be separately reported.

Architecture discovery: current Android is a Java WebView host loading remote UI. Current Electron client bundles the same frontend and uses the canonical Node/Express server/store against a selected local folder. Android SAF URI storage is not a normal filesystem path; select and verify an adapter/runtime architecture before claiming parity. The older Spire Windows Vault note describes a WPF preview and is not the current Electron implementation.

## Unified Local + Server workspace — requested, not implemented

the project owner requires server sign-in to remain discoverable in Settings after opening a local folder, without replacing that folder. One sidebar contains separate Local and Server trees, with one editor and cross-storage file movement. Windows (current Electron implementation in /workspace/spire/desktop, not the historical WPF preview) must match Android.

Required acceptance:
- Settings offers HTTPS server connection/sign-in while retaining the selected local folder.
- Connected workspace displays Local and Server simultaneously, clearly labeled; same filenames in different mounts remain independent.
- Users explicitly move files in both directions using a unified filesystem interaction; provide a touch-accessible Move action as well as desktop drag/drop.
- Local data is never implicitly uploaded or mirrored; disconnect/sign-out does not remove local files or revoke the selected local folder.
- Preserve the full canonical editor, local offline operation and persisted workspace configuration.
- Verify Android and Windows parity; do not claim an updated build or live deployment from planning alone.

Aphelion safety recommendations:
- Destination write and verification precede source removal; interruption retains recoverable transfer state.
- Conflicts never silently overwrite; pending source edits and concurrent external edits are protected.
- Transfer linked attachments deliberately and preserve relative references; never move opaque references without acquiring and verifying their actual bytes.
- Preserve origin-scoped credentials and limit local-folder privileges to the trusted bundled client; remote pages gain no direct SAF/filesystem bridge.

the project owner selected: cache previously opened Server files for offline editing, then synchronize queued edits back with conflict protection. Local files remain independently offline-capable. Server caches do not turn local-folder files into server files, and whole-server replication is not implied. Conflicts must preserve both versions rather than silently overwriting either.

Supersedes the earlier separate-choice-only UI contract, not the prohibition on implicit uploads. Implementation, tests, builds and deployment are pending.


## Workspace loading and per-file saving — implementation in progress

the project owner authorized selected-folder loading reuse, per-file autosave, idle-delayed writes and Save / Discard changes / Cancel before leaving unsaved work. Initial two-second delay is Aphelion’s approved recommendation. Preserve all existing files, app data and recovery journals. Build, regression, Android artifact and deployment acceptance remain pending.
# Byte-faithful manual saves and current revision display

- Visual-editor saves retain typed trailing spaces across Save, exit, and reopen.
- Opening or updating revision history selects the current saved revision so its actual changes are visible.


## Markdown three-way synchronization — 0.2.93 candidate

Exact per-file acknowledged ancestors are separate from the cached Server head. Markdown is compared line by line without trimming blank lines, spaces, CRLF, or Unicode. Non-overlapping changes merge; overlapping sections remain explicit Local/Server/both/custom choices. Unrelated files continue synchronizing. Changed-file line patches verify base/result SHA-256 and optimistic revisions, with idempotent receipts and immutable prior-publication archives. Branch histories retain their original revision identities plus content hashes. Missing/unloaded files are never deletion commands.

The real Chromium reconciliation harness is repaired (native capability and exact storage key), and covers independent upload/pull, conflict isolation, provider failures, lost replies, incremental downloads and stale review rejection. Focused unit/API/section-review checks pass. Final browser, Android buildbox, delivery, deployment and physical-device acceptance are pending; this section is not a completion claim. Existing Hello World conflict must remain unchosen.
