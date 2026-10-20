# Spire — Todo

## Local + Server storage redesign — planned

- [ ] On Android first launch, let the user choose a parent directory; create `Spire/Spire Local` inside it for device-local files.
- [ ] When the user connects a server, create `Spire/Server` for files accessed from that server.
- [ ] Replace routine whole-workspace synchronization with Git-style change comparison and selective file/change transfer.
- [ ] Detect conflicting edits and present Git-like choices: keep either version or merge; never silently overwrite.
- [ ] Merge from the latest version, applying non-overlapping changes in their corresponding nearby lines; leave overlapping/ambiguous hunks for the user to resolve.
- [ ] Define durable revision/change tracking, offline behavior, and recovery while preserving existing files and identities.

## File-operation responsiveness — implemented

- [x] Hosted storage skips atomic rewrites when an existing file already has the intended bytes.
- [x] Android Local sends only affected file entries across the WebView/native bridge instead of complete before/after file maps.
- [x] Preserve provider-confirmed saves, stale-source and collision checks, destination-before-source moves, external-content folder protection, and unrelated files.
- [x] Add hosted inode/mtime and Android compact-payload/native safety regressions.
- [ ] Record physical Android SAF/WebView timings after the project owner tests the delivered APK.

## Shared UI / theme library — future

- [ ] Create a reusable Spire theme/component library preserving approved surfaces, typography, spacing, icons, controls, menus, focus states and motion.
- [ ] Use the Source type dropdown as the canonical dropdown design; shared changes must propagate consistently.

## Quick actions — deployed

- [x] Configurable empty-workspace tiles managed in Settings → Actions.
- [x] User-defined label, destination folder, optional template and filename pattern.
- [x] Unique file creation and immediate opening without prompting or arbitrary action limit.
- [x] Synchronization, backup recovery, automated acceptance and live deployment verification.
- [ ] Physical Android WebView acceptance; investigate intermittent unrelated table-suite failures.

## Video extractor research — parked

- [ ] Resume the YTDLnis/yt-dlp video-link support discussion later; no Spire implementation changes were made from that inspection.

## Project definition

- [x] Capture the initial product vision
- [x] Record the core feature directions
- [x] Establish the project and Vault documentation
- [x] Confirm the permanent product name: **Spire**
- [ ] Define the visual identity and interaction direction
- [ ] Decide the exact first-release client targets

## Technical discovery

- [ ] Inventory the Obsidian Markdown constructs and workflows that matter to the project owner
- [ ] Define a clean-room compatibility specification for supported Vault behavior
- [ ] Compare synchronization models and choose the revision/event protocol
- [ ] Define stable document, heading, block, attachment, and device identities
- [ ] Design conflict behavior and recovery UX
- [ ] Define the canonical file layout and rebuildable index schema
- [ ] Define authentication, backup, encryption, and threat-model requirements
- [ ] Prototype round-trip import/export against a disposable representative Vault

## Initial architecture

- [ ] Select the server implementation stack
- [ ] Select the web editor and client framework
- [ ] Design the public synchronization protocol independently of any one client
- [ ] Define local client storage and offline mutation queues
- [ ] Define attachment chunking, deduplication, and selective download behavior
- [ ] Define full-text search and graph indexing
- [ ] Define Docker deployment and upgrade/rollback behavior

## First usable release

- [x] Add portable starred-note toggle and sidebar marker
- [ ] Add a starred-only search/filter when the search/filter UI is expanded
- [x] Add a top-row daily-file calendar that opens or creates dated Markdown files

- [x] Implement the Docker-hosted service
- [x] Implement accounts and device authentication
- [x] Implement an installable offline-capable web client
- [x] Implement Markdown editing and live preview
- [x] Implement user-defined folders, tags, properties, and attachments
- [x] Require every Markdown document to reside in a folder; do not create a default Notes folder
- [x] Fix permanent deletion from an already-open trashed note so the editor and Trash list clear immediately
- [x] Add long-press folder deletion with move-to-Trash or folder reassignment, including automatic Unsorted creation
- [x] Implement wiki links, backlinks, and rename-safe references
- [x] Implement full-text search
- [x] Implement automatic synchronization
- [x] Implement revisions and conflict recovery
- [x] Implement disposable ZIP import without importing the project owner's real Vault
- [x] Implement complete Vault export
- [x] Verify offline editing, reconnect synchronization, conflicts, backup, restore, and round-trip portability
- [x] Rebuild and verify the Tailscale-only private preview with the current release

## Later product layers

- [ ] Block references and outliner workflows
- [ ] Typed objects and custom properties
- [ ] Tables, lists, cards, galleries, and computed collections
- [ ] Canvas, mind-map, timeline, relationship-map, and Kanban views
- [ ] Native Android client
- [ ] Native Windows/Linux client
- [ ] Optional end-to-end encryption
- [ ] Shared Vaults and collaboration
- [ ] Safe plugin, automation, and theming systems

## Unified Local + Server workspace — implemented and verified

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

Implementation, automated tests, isolated production build, Electron acceptance, Android browser/SAF acceptance, and Android buildbox `test lint assembleDebug` are complete. No deployment was requested or performed.

# Server-origin identity return
- [x] Persist origin/account/workspace-scoped identity metadata through explicit Local ↔ original Server moves; legacy records fail closed.
- [x] Retain stable Server identity through Local edit, rename and restart; reject restored, changed, deleted and colliding destinations without removing Local bytes.
- [x] Preserve attachments, styles and empty folders through verified resumable transfers.
- [x] Provide atomic Keep mine, Keep Server, Keep both and Merge conflict actions with shared-ancestor context and stale-decision rejection.
- [x] Preserve File History, Compare and Restore; restores remain new revisions.
- [x] Pass TypeScript, 166 Node tests, production-renderer acceptance, Electron acceptance, Android browser/SAF tests, isolated production build, and Android buildbox test/lint/assemble.
- [ ] Perform physical Android WebView/device acceptance when an unlocked authorized device is available.