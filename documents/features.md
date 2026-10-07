# Spire — Features

## Mobile keyboard focus

Touch-capable devices no longer force text-field focus after formatting, capitalization, alignment, table insertion, template insertion, or chooser dismissal. Dialog and metadata fields wait for a direct tap instead of autofocus; desktop retains focus conveniences. Table cells snapshot their DOM selection on blur so toolbar actions retain the selected text without reopening the keyboard. Touch toolbar presses preserve selection without preventing native horizontal scrolling. Mobile touch-event regression verifies source/rich-cell transformations, no editor autofocus, table insertion, link-form opening, and direct writing-area focus. Production build, 30 unit/API tests and all 27 browser tests passed across split runs.


## Capitalization gallery

**State:** Implemented, production-build and browser verified, and deployed to the private preview from `0938f78`. Fresh data backup checksum verified; container healthy; local/container/live JavaScript hashes match. The shared **Aa ▾** control uses the same horizontally scrollable preview-card gallery as Headings, in the Markdown section before HTML. Styles: UPPERCASE, lowercase, Title Case (every word), Sentence case, and tOGGLE cASE. Cards preview selected text or the cursor word. Applying a style transforms the selection or the cursor word, preserves surrounding content, and keeps the transformed selection usable. Rich table cells retain existing marks, including combined bold/italic/underline, and capitalization is a single undoable transaction; Insert/Update and reopening retain the result. Unicode letters, contractions, multi-line selections, and case expansions such as ß → SS are supported. Empty/whitespace cursor positions are no-ops. This is a direct text conversion, not CSS-only styling or custom Markdown syntax.


## Table editor formatting toolbar
- The table dialog reuses the main editor Markdown/HTML formatting toolbar and visual heading, list, and alignment choosers.
- Formatting targets the active cell and preserves its text selection; Cancel leaves the note unchanged, and Insert/Update applies the edited grid.
- The dialog omits nested-table creation and note-level insert tools. Markdown remains before HTML; the rail scrolls on mobile without widening the dialog.
- Shared toolbar deployed from `78e18bd`.
- Follow-up (locally verified, not deployed): table alignment uses native Markdown column delimiters (`:---`, `:---:`, `---:`), leaves cell content unchanged, and round-trips on reopening. The main editor retains HTML paragraph alignment.


## Knowledge hierarchy and provisional terminology

**State:** Partially confirmed by the project owner. **Spire** is the application, and a **Reliquary** is the complete collection of the user's stored knowledge and items. Product-specific names for folders and Markdown documents are intentionally unresolved. **Codex**, **Cluster**, and **Shard** have been discussed but are not canonical terms and must not yet replace ordinary folder/file language in the interface.

**Confirmed structural invariant:** Every Markdown document must belong to a folder. Spire does not allow loose or "wild" Markdown files at the Reliquary root because they break the required organizational structure. Creating, importing, or moving a Markdown document must therefore include a destination folder.

### Empty workspace canvas

**State:** Deployed to the Tailscale-only private preview from implementation commit `6905f7d7464aa3880a622f9030f0053c7c4cf2a1` in immutable release `20261006T223137Z-clear-empty-canvas-6905f7d`. The previous centered **Shape your Reliquary.** onboarding, explanatory text, folder icon, and **Create your first folder** button have been removed. When no file is selected, the writing canvas remains empty so it can receive the planned replacement experience later. Folder creation remains available through the sidebar’s **Create → New folder** action.

## Folder deletion and reassignment

**State:** Implemented and deployed to the Tailscale-only private preview. A long press (or desktop context-menu action) on a workspace folder opens a confirmation flow. The user may move all contained notes to Trash, or keep them and reassign them to another current folder. The reassignment picker also offers **Unsorted**, creating that folder automatically when it does not already exist. Nested relative folder structure is preserved during reassignment, destination collisions are rejected, linked-note references are refactored, and deleting a folder containing attachments is blocked until those attachments are moved safely.

## Reliquary location

**State:** Implemented and deployed to the Tailscale-only private preview. First-run setup selects a portable single directory name beneath Spire's managed `reliquaries/` folder. Settings displays its container path and offers a confirmed move to a new, unoccupied directory in the same data volume. The move renames the entire content directory (Markdown, attachments, empty folders); server state/revisions and sessions remain at the data-volume root. Migration is journaled for restart recovery, rejects traversal/symlinks and existing destinations, and requires resolved/synchronized browser edits. In Docker, a browser cannot choose an arbitrary host directory; changing the host volume mount needs an administrator-managed deployment and backup/restore. Do not confuse the displayed container path with the self-hosted server host path.

## Settings navigation and sign-out clarity

Settings are grouped under top tabs: **Storage** (Reliquary location and import), **Devices** (session revocation), and **Privacy** (local-data explanation and sign-out). The local recovery export is available below the tabs. **Sign out on this device** syncs pending edits and ends this browser's session; it does not delete server-side Reliquary notes or erase copies on other devices. Local offline data may remain stored in this browser.
## Markdown formatting toolbar

**State:** Implemented and production-build verified (18 unit/API tests and all 19 browser tests); deployed to the Tailscale-only private preview. The Source/Preview/Split controls remain in their own row. A separate horizontally scrollable row directly beneath them provides familiar Markdown actions (bold, italic, strike-through, inline code, heading, quote, bullet/numbered/task list) alongside templates, links, tags, starring, and attachments. Formatting wraps the current selection or prefixes selected lines in the source editor, keeps the caret/selection usable, and stays within the row on narrow mobile viewports. Formatting controls are disabled in Preview-only mode and while a note is trashed. The hidden attachment input is positioned within its toolbar control so it cannot escape the scroll rail and widen the mobile layout viewport. Repeated note creation and folder-reassignment dialogs are covered by the complete browser suite.

### Combined list gallery

**State:** Implemented, production-build verified (23 unit/API tests and all 19 browser tests), and deployed to the Tailscale-only private preview from source commit `da427eb`. The separate bullet, numbered, and task controls are replaced by one List chooser directly below the formatting rail, matching the heading-gallery interaction. Its horizontally scrollable preview cards cover the portable Markdown list markers (`-`, `*`, `+`, `1.`, `1)`, and tasks) plus explicit lowercase and uppercase alphabetic list options requested by the project owner. The chooser preserves the editor selection, replaces existing list markers instead of stacking them, stays inside the mobile viewport, and is unavailable in Preview-only or trashed-note states.

### Managed Markdown table builder

**State:** Implemented, production-build verified (26 unit/API tests, focused browser acceptance, and 19/20 full browser tests with the unrelated failed login-throttle test passing independently), and deployed to the Tailscale-only private preview from source commit `39d8cdc`. A **Table** button in the Markdown section opens a mobile-friendly grid editor with editable header/body cells and row/column controls. Saving inserts a portable GFM Markdown table at the cursor. Invisible HTML comments retain a stable Spire table ID without affecting preview or portability; because those markers travel with the table text, placing the cursor anywhere inside a managed table and pressing **Table** reopens the populated editor and replaces that table in place while preserving surrounding prose.

## Editor toolbar grouping and Text style chooser

**State:** Implemented and deployed to the Tailscale-only private preview from commit `6e67073b7b785ac005d436a896c63bb0b621f9e5` in immutable release `20261007T205918Z-media-6e67073`. The single horizontally scrollable formatting rail has no visible Markdown/HTML/Inserts section labels, since its control groups can contain mixed syntax; accessible group names describe their function rather than prescribing an encoding. The **Text style** chooser is the far-left toolbar control. Bold, Italic, Underline, and Strikethrough remain grouped there with syntax previews (Markdown for Bold, Italic, and Strikethrough; HTML for Underline). Direct table-cell formatting controls remain available in the shared toolbar. Alignment remains compact with visual Left, Center, and Right preview cards and supports Markdown table alignment or embedded HTML paragraph alignment as appropriate. **Spacer** inserts a standalone `&nbsp;` paragraph at the selection/caret with normalized blank lines. The visible **Media ▾** chooser offers preview cards with media-type icon/label, syntax family, and portable syntax preview; choosing a card inserts Markdown image or Spire local attachment-embed syntax at the captured selection/caret. Supported types are Image, Audio, Video, and PDF. No arbitrary iframe/embed option is exposed because sanitized HTML intentionally forbids user-supplied frames. Production build passed; all 44 unit/API tests, all 45 browser tests, focused media insertion acceptance, and `git diff --check` passed. The application-consistent pre-deployment backup `/srv/spire/backups/pre-media-6e67073-20261007T205918Z.json` passed the backup CLI's checksum verification (SHA-256 `630899ee2a9d52f425b767d713cb3f1adff206c2325e5cf8e772a7b31c586a00`). The existing `spire-preview_spire_data` volume remains mounted read/write. The container is healthy, HTTPS health returns `{"ok":true}`, served JavaScript contains the Media chooser and supported syntax, and the service remains bound to loopback at `127.0.0.1:4173`.

## Daily-file calendar

**State:** The refined calendar workflow and temporal chooser are deployed to the Tailscale-only private preview. The current implementation is commit `63318309ec8aa2fa9eb273f3afcae6a687d3ee49` in immutable release `20261006T204901Z-temporal-chooser-6331830`. A calendar icon sits in the top application row immediately beside Settings. The month view highlights today, marks dates with files, and supports previous/next-month navigation. Choosing a date is non-mutating: it opens a list of every `Daily Notes/YYYY-MM-DD.md` or `Daily Notes/YYYY-MM-DD - Title.md` file for that date. An explicit **Create file** action creates a named dated Markdown file and creates the `Daily Notes` folder when needed. The Markdown formatting group also provides **Insert date** (`YYYY-MM-DD`) and **Insert time** (`HH:mm`) controls that replace the captured selection or insert at the captured caret. Each control now opens an explicit **Current** or **Manual** chooser; the manual path uses the native date or time picker. No event, appointment, reminder, or proprietary calendar data is introduced. The chooser acceptance test, production build, and all 34 unit/API tests pass. The live container is healthy, retains `spire-preview_spire_data` read/write, HTTPS health returns `{"ok":true}`, and the served bundle contains the chooser UI markers.

## Adjacent per-file CSS

**State:** Implemented, locally verified, and deployed to the Tailscale-only private preview from source commit `4459994`. Each Markdown file can own one real, portable, same-directory/same-stem `.css` file. The context panel’s **CSS** tab creates and edits that stylesheet with immediate scoped Preview feedback. File rename and drag/move operations move the matched stylesheet transactionally with collision protection. CSS imports, external URLs, application-root selectors, and unsafe at-rules are rejected. Unmatched stylesheets stay in their physical directories and appear under the virtual **Unattached Styles** sidebar group; that group does not move, rename, or delete them. Stylesheets are included in Reliquary exports.

## Section templates — header and hero

**State:** Implemented in private preview. The editor's section-template selector previews a header image, description banner and tags, using actual note values when present and visibly labeled sample values for missing fields. The hero preview uses the same wide natural aspect ratio as the inserted image instead of a short stretched strip. The collapsible-section preview hides and reveals `Section content` in sync with the arrow while reserving a fixed-height content area (and respects reduced-motion preferences), so it demonstrates both states without shifting the template dialog. Sample content is preview-only; insertion preserves the real note's empty-field prompts. The editor inserts the section into an existing note as ordinary Markdown only after explicit confirmation. Values come from the note's sidebar frontmatter (`hero`, `description`, `tags`); missing values show editable prompts. Image links are relative to the note folder and point to portable attachments. Sidebar edits refresh the bounded generated section, leaving other prose unchanged. An HTML comment marks the refreshable section; other Markdown apps can open and render its standard image, quote and tags. Only one generated hero section is supported per note; editing inside the generated region may be replaced by later sidebar edits.

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

Deployment verification: healthy container, successful live HTTPS health endpoint, and served JavaScript/CSS containing the toolbar and attachment-positioning fix. Existing data volume and loopback-only port binding are preserved; a pre-release backup and prior image are retained. Authenticated live-owner/mobile interaction was not performed; interaction acceptance used the isolated production-build browser suite.

## Editor action placement and heading gallery
Star/unstar is grouped with Save and Trash in the note action row. Heading opens a gallery directly below the formatting toolbar with styled Heading 1–6 previews and Normal text. Selection is retained, existing heading markers are replaced, and normal text removes heading markers. Preview-only and trashed notes cannot apply headings. Source build and browser verification recorded locally; deployment is not part of this change.

## Obsidian-compatible Markdown rendering
Reference: https://kolavistudio.com/markdown-tools/obsidian
CommonMark/GFM retained, with highlights, wiki links and aliases, heading/block navigation, recursive note/heading/block embeds with cycle/depth protection, local image/audio/video embeds, sandboxed local PDF frames with an open-link fallback, foldable callouts, KaTeX inline/display math, footnotes, block IDs, highlighted fenced code and lazy-loaded strict Mermaid diagrams. Underline and safe HTML remain sanitized; script, form and arbitrary iframe content are forbidden. Task checkboxes are disabled in preview. Styles are restricted to numeric layout declarations required by math. Markdown source remains unchanged; no data migration.
No Dataview/community-plugin execution or custom MathJax macro settings are claimed. PDF display depends on browser PDF support; mobile users retain the open-file link. Rendering dependencies are bundled locally rather than fetched from third-party CDNs. Implementation is local pending deployment; build/unit/browser validation accompanies the source commit.

The preceding star-action/heading-gallery release was deployed separately and verified healthy through HTTPS, with the new gallery present in the served bundle and port 4173 still loopback-only.


## Animated file mind map
Implementation in progress: replace the blank home canvas with labeled hexagonal file nodes; real Markdown references pulse from referenced source to referencing file. No folders or attachments. Pan/zoom, selection neighborhood and open-file navigation. Settings offers opt-in, clearly labeled presentation-only demo data, disabled by default; no real data mutations. Reduced-motion support and mobile acceptance required. Commit and backup-safe private deployment authorized.
