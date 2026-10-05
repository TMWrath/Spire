# Spire — Features

## Knowledge hierarchy and provisional terminology

**State:** Partially confirmed by the project owner. **Spire** is the application, and a **Reliquary** is the complete collection of the user's stored knowledge and items. Product-specific names for folders and Markdown documents are intentionally unresolved. **Codex**, **Cluster**, and **Shard** have been discussed but are not canonical terms and must not yet replace ordinary folder/file language in the interface.

**Confirmed structural invariant:** Every Markdown document must belong to a folder. Spire does not allow loose or "wild" Markdown files at the Reliquary root because they break the required organizational structure. Creating, importing, or moving a Markdown document must therefore include a destination folder.

### First-folder onboarding lifecycle

**State:** Implemented, browser-verified, and deployed to the Tailscale-only private preview. The centered **Shape your Reliquary.** onboarding is shown only while the Reliquary has no folders. Creating the first folder dismisses that onboarding immediately; it is not reused as a generic “no note selected” screen.

## Folder deletion and reassignment

**State:** Implemented and deployed to the Tailscale-only private preview. A long press (or desktop context-menu action) on a workspace folder opens a confirmation flow. The user may move all contained notes to Trash, or keep them and reassign them to another current folder. The reassignment picker also offers **Unsorted**, creating that folder automatically when it does not already exist. Nested relative folder structure is preserved during reassignment, destination collisions are rejected, linked-note references are refactored, and deleting a folder containing attachments is blocked until those attachments are moved safely.

## Reliquary location

**State:** Implemented and deployed to the Tailscale-only private preview. First-run setup selects a portable single directory name beneath Spire's managed `reliquaries/` folder. Settings displays its container path and offers a confirmed move to a new, unoccupied directory in the same data volume. The move renames the entire content directory (Markdown, attachments, empty folders); server state/revisions and sessions remain at the data-volume root. Migration is journaled for restart recovery, rejects traversal/symlinks and existing destinations, and requires resolved/synchronized browser edits. In Docker, a browser cannot choose an arbitrary host directory; changing the host volume mount needs an administrator-managed deployment and backup/restore. Do not confuse the displayed container path with the self-hosted server host path.

## Settings navigation and sign-out clarity

Settings are grouped under top tabs: **Storage** (Reliquary location and import), **Devices** (session revocation), and **Privacy** (local-data explanation and sign-out). The local recovery export is available below the tabs. **Sign out on this device** syncs pending edits and ends this browser's session; it does not delete server-side Reliquary notes or erase copies on other devices. Local offline data may remain stored in this browser.
## Markdown formatting toolbar

**State:** Implemented and production-build verified (18 unit/API tests and all 19 browser tests); private-preview deployment pending. The Source/Preview/Split controls remain in their own row. A separate horizontally scrollable row directly beneath them provides familiar Markdown actions (bold, italic, strike-through, inline code, heading, quote, bullet/numbered/task list) alongside templates, links, tags, starring, and attachments. Formatting wraps the current selection or prefixes selected lines in the source editor, keeps the caret/selection usable, and stays within the row on narrow mobile viewports. Formatting controls are disabled in Preview-only mode and while a note is trashed. The hidden attachment input is positioned within its toolbar control so it cannot escape the scroll rail and widen the mobile layout viewport. Repeated note creation and folder-reassignment dialogs are covered by the complete browser suite.

## Section templates — header and hero

**State:** Implemented in private preview. The editor's section-template selector previews a header image, description banner and tags, using actual note values when present and visibly labeled sample values for missing fields. Sample content is preview-only; insertion preserves the real note's empty-field prompts. The editor inserts the section into an existing note as ordinary Markdown only after explicit confirmation. Values come from the note's sidebar frontmatter (`hero`, `description`, `tags`); missing values show editable prompts. Image links are relative to the note folder and point to portable attachments. Sidebar edits refresh the bounded generated section, leaving other prose unchanged. An HTML comment marks the refreshable section; other Markdown apps can open and render its standard image, quote and tags. Only one generated hero section is supported per note; editing inside the generated region may be replaced by later sidebar edits.

## Note context card

**State:** Implemented and deployed to the Tailscale-only private preview. The context-panel toggle appears only while a Markdown file is open; the note-detail panel itself is likewise gated on an open file. The card layout, spacing, dark monochrome treatment, cover placeholder, title/actions, description, tag chips, statistics and linked-note list follow the supplied Ferryman reference—not example content or counts. Values come from each open note: `description` frontmatter or body excerpt; real tags; deduplicated outgoing/incoming linked notes; earliest retained revision and latest edited date. Pencil edits the note, plus opens the working link-insertion form, linked rows navigate, and the menu exposes functional Edit/Add Link actions. Properties/revisions remain available in a compact disclosure below the card. Workspace-wide conflicts remain separate. Pencil now edits the filename/title in place, preserving the folder and using normal rename/reference updates. Clicking the hero slot uploads a note-specific image into portable attachments and stores its path in `hero` frontmatter. Description is directly editable and stored in `description` frontmatter. Tags sit immediately below description with a `+` for adding portable frontmatter tags. Mobile browser coverage verifies title, hero, description, and tag persistence after reload. Hero uploads currently require a network connection.

## Starred notes

**State:** Implemented in private preview; starred-only search/filter remains planned.

An accessible outlined/filled SVG star beside the note link/tag actions toggles `starred: true` in the note's portable YAML frontmatter. Unstarring removes that property. Existing frontmatter properties, comments and Markdown body are preserved. The sidebar marks starred notes with a small star; synchronization, export and offline edits use the ordinary note revision pipeline. Invalid YAML must be repaired before toggling rather than silently discarding metadata. Future starred-only filtering can derive directly from Markdown.

## Research baseline

The clean-room planning reference [`obsidian-capability-inventory.md`](obsidian-capability-inventory.md) inventories the capabilities documented across Obsidian's official English Help material. It is a comparison and requirements-discovery source, not a promise to reproduce every feature and not a source for copying proprietary implementation or visual identity.

## Product foundation

**State:** Implemented as the first usable local/private release; advanced product layers remain planned.

Spire will be a private, self-hosted, local-first knowledge and writing platform. It will take behavioral inspiration from Obsidian and other knowledge tools while using an original clean-room implementation, identity, interface, and codebase.

Core principles:

- The user owns the data.
- Plain Markdown and ordinary attachments remain portable outside Spire.
- A self-hosted service provides dependable synchronization without requiring Syncthing or manual folder choreography.
- Clients remain useful offline and synchronize automatically when connectivity returns.
- No proprietary Obsidian code, branding, or assets will be copied.
- An existing Obsidian-style Vault should be importable without trapping the content in an opaque database.

## Portable Vault format

**State:** Implemented for portable Markdown, attachments, YAML frontmatter, stable note IDs, revisions, search/link indexes, and ZIP import/export. Canvas data and broader compatibility remain planned.

Canonical user content should remain understandable without Spire:

- Markdown documents
- Standard attachment files
- YAML frontmatter for interoperable properties
- JSON only where Markdown is unsuitable, such as spatial canvas geometry
- Stable internal identities that survive filename and folder changes
- Complete export at any time
- Git-friendly formatting where practical

A rebuildable local index may accelerate search, graph traversal, backlinks, properties, revisions, and synchronization, but it must not become the only usable copy of the user's knowledge.

## Self-hosted service

**State:** Implemented for private Docker hosting, owner/device authentication, synchronization, notes, attachments, revisions, conflicts, search, and backlinks. Automatic backups, real-time push, E2EE, and collaboration remain planned.

The server is the private synchronization and service hub. Planned responsibilities:

- Docker-friendly self-hosting
- User authentication and device registration
- Narrow, documented synchronization API
- Note, metadata, and attachment transfer
- Revision history
- Conflict detection and recovery
- Full-text search and link indexing
- Backlink and graph indexing
- Automatic backups
- Real-time updates for active clients
- Optional end-to-end encryption as a later security layer
- Shared Vaults and scoped permissions as a later capability

The server must never silently discard a newer client revision.

## Offline-first clients and automatic synchronization

**State:** Planned

Clients should:

- Open and save locally without a network connection
- Synchronize automatically when the server is reachable
- Show honest local, syncing, synchronized, conflicted, and offline states
- Use stable IDs and revisions rather than filesystem timestamps as the synchronization contract
- Preserve conflict copies and revision history instead of silently overwriting data
- Download large attachments intelligently rather than forcing every device to retain every asset

The intended delivery sequence is a shared cross-platform architecture with an installable web client first, followed by native Android and Windows/Linux clients using the same protocol.

## Linked knowledge

**State:** Planned

Spire should support familiar, expressive links such as:

```markdown
[[Project Name]]
[[Project Name#Deployment]]
[[Project Name^specific-block]]
![[Image.png]]
![[Another Note#Relevant Section]]
```

Planned linking behavior:

- Link autocomplete
- Incoming backlinks and outgoing links
- Unlinked mentions
- Heading and block references
- Embedded notes, headings, blocks, and attachments
- Broken-link detection and repair
- Link previews
- Rename and move refactoring
- Stable target identities so renaming or moving a document does not break its relationships
- Optional semantic relationship labels such as `belongs to`, `depends on`, `inspired by`, `character in`, and `deployed on`

## Markdown authoring

**State:** Planned

- Markdown source editing
- Live preview
- WYSIWYG-style editing where it does not damage portability
- Tags and aliases
- Headings, callouts, code blocks, embeds, and task lists
- YAML properties/frontmatter
- Templates
- Daily notes and journal workflow
- Fast keyboard commands
- Themes and extensibility through a safe, original system

## Block-level knowledge

**State:** Planned after the initial release

- Stable IDs for headings and blocks
- Reference or embed an individual paragraph
- Reuse a block in more than one context
- Block-level backlinks
- Outliner editing and restructuring
- Queries over blocks, tags, properties, and tasks

Markdown should remain readable even when hidden stable IDs support richer behavior.

## Typed objects, properties, and collections

**State:** Planned after the initial release

A document may also represent a typed object such as a person, project, character, machine, location, book, or cigar.

- User-defined object types
- Type-specific properties
- Semantic relations between objects
- Collections rendered as lists, tables, cards, or galleries
- The same object displayed in documents, databases, boards, and graphs without disconnected duplicate copies
- Embedded queries and computed views

## Search, queries, and graph

**State:** Planned

- Fast full-text search
- Property, tag, type, date, link, and task filters
- Backlink and relationship queries
- Global graph and focused local graphs
- Filters that keep graph views useful rather than producing an undifferentiated cloud of dots
- Saved searches and query-backed pages

## Visual workspaces

**State:** Planned after the initial release

- Canvas boards
- Mind maps
- Timelines
- Relationship maps
- Kanban boards
- Tables and galleries
- Reusable nodes backed by real Vault content rather than isolated board-only copies
- Practical interoperability with Obsidian Canvas JSON where cleanly possible

## Tasks and projects

**State:** Planned

Tasks may live naturally inside documents while appearing in aggregated views:

```markdown
- [ ] Finish server authentication
  due:: 2026-10-08
  project:: [[Spire]]
  priority:: high
```

Planned views include Today, Upcoming, Project, Kanban, and a global task list. Tasks should remain visible in their original narrative context.

## Import, export, and interoperability

**State:** Planned

- Import an existing Obsidian-style Markdown Vault
- Preserve supported links, tags, frontmatter, aliases, attachments, and folder organization
- Report unsupported or ambiguous constructs rather than silently corrupting them
- Export the complete Vault in portable files at any time
- Keep interoperability separate from copying Obsidian's proprietary implementation

## Initial usable release

**State:** Planned

The first release should include:

1. Docker-hosted server
2. Account and device authentication
3. Installable offline-capable web client
4. Markdown editor with live preview
5. Folders, tags, properties, and attachments
6. Wiki links, backlinks, and rename-safe references
7. Full-text search
8. Automatic synchronization
9. Revision history and conflict recovery
10. Obsidian Vault import
11. Complete Vault export

Block references, structured databases, advanced canvases, native Android/desktop clients, end-to-end encryption, collaboration, and plugin APIs can follow in deliberate layers without compromising the initial data model.

## Reference products and lessons

These are behavioral references, not sources to copy:

- **Obsidian:** portable Markdown, wiki links, backlinks, graph, live preview, properties, embeds, Canvas, templates, daily notes, themes, and plugins
- **Logseq:** block references, outlining, journals, embedded tasks, and queries
- **Anytype:** typed objects, semantic relations, sets, collections, and multiple database views
- **SiYuan:** block-level knowledge, WYSIWYG editing, document trees, embedded queries, and self-hosting
- **SilverBullet:** self-hosted Markdown, wiki links, computed knowledge, and programmable behavior
- **Joplin:** synchronization discipline, revisions, conflict preservation, offline clients, and end-to-end encryption concepts
- **AFFiNE:** connected documents, whiteboards, databases, and visual planning
- **TriliumNext:** deep hierarchy, cloned placement, relations, maps, protected sections, and automation

## Workspace creation menu
The workspace + opens a compact New file / New folder menu. New file creates portable Markdown; New folder creates a real empty directory that persists through reload, snapshots, backups, and ZIP export/import. Folder creation requires a connection; offline note editing remains available.
