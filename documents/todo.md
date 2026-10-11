# Spire — Todo

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
