# Obsidian Capability Inventory for Spire

**Purpose:** A clean-room behavioral reference for planning Spire. This document inventories capabilities documented by Obsidian's official Help material; it does not copy Obsidian source code, visual identity, product copy, or proprietary assets.

**Research date:** 2026-10-03  
**Primary source:** [Obsidian Help](https://obsidian.md/help/)  
**Source repository:** [obsidianmd/obsidian-help](https://github.com/obsidianmd/obsidian-help)  
**Source revision:** `9cf8c2913e56830e75c13f33ba198d7e70b6d9ef` (2026-09-29)  
**Coverage:** The 176 English Help documents present at the source revision above.

> The Help website disallowed automated crawling through `robots.txt`. The research therefore used the official public Help repository identified by that site. The repository states that its English `en/` directory is the source of truth and that commits to its main branch are published automatically.

## How to use this inventory

Every item is a **capability candidate**, not an automatic Spire requirement. During planning, classify each capability as:

- **Foundation** — required for the first useful release.
- **Compatible** — needed to import, preserve, or export common Obsidian Vault behavior.
- **Spire-native** — implement the goal through an original Spire interaction or architecture.
- **Later** — valuable after the foundation is reliable.
- **Excluded** — commercial, administrative, legacy, unsafe, or contrary to Spire's design.

The inventory intentionally separates documented behavior from implementation decisions. Matching a file format or user-visible workflow does not mean copying Obsidian's implementation.

---

## 1. Local-first Vault and file ownership

### Vault management

- Create an empty Vault.
- Open an existing folder as a Vault.
- Maintain more than one Vault.
- Rename, move, remove, and switch Vaults.
- Transfer configuration from one Vault to another.
- Offer a sandbox/demo Vault for experimentation.
- Store ordinary user notes as local Markdown files.
- Keep attachments as ordinary files beside the notes.
- Keep per-Vault configuration in a configurable hidden folder.
- Distinguish Vault-local settings from global application settings.
- Maintain a rebuildable metadata cache/index rather than making it the sole copy of knowledge.
- Explain clearly that synchronization is not the same thing as backup.

### File and folder operations

- Create, rename, move, and delete notes.
- Create, rename, move, sort, expand, collapse, and delete folders.
- Automatically reveal the active file in the file tree.
- Support drag-and-drop between folders, tabs, windows, and external applications.
- Offer configurable behavior when a linked file is renamed or moved.
- Offer configurable default locations for new notes and attachments.
- Handle deleted files through a recoverable/trash-aware workflow.
- Detect filesystem changes made outside the application.
- Document behavior and risks around symbolic links and filesystem junctions.

### Accepted content

- Markdown notes.
- Images and image embeds.
- Audio and video.
- PDFs.
- Canvas/board files.
- Base/database view files.
- Other attachments retained as ordinary files even when Spire cannot preview them.
- External URLs and externally hosted images.

### Spire baseline

Spire should preserve the same ownership outcome—portable Markdown plus ordinary attachments—while adding stable identities, revision history, automatic synchronization, and self-hosted recovery underneath it.

---

## 2. Markdown writing and reading

### Editing modes

- Source-mode Markdown editing.
- Live Preview that formats Markdown while retaining direct editing.
- Reading/rendered view.
- Configurable default editing mode and default view for new tabs.
- Visible editing-mode status and quick mode switching.
- Multiple cursors and rectangular selection.
- Folding for headings and indented content.
- Undo/redo and conventional text navigation/editing shortcuts.
- Word count and character count.
- Optional Vim-style editing behavior.

### Core formatting

- Paragraphs and explicit line breaks.
- Heading levels.
- Bold, italic, bold-italic, highlight, and strikethrough.
- Block quotes.
- Ordered and unordered lists.
- Nested lists.
- Markdown task lists.
- Horizontal rules.
- Inline code and fenced code blocks.
- External links.
- External images.
- Comments.
- Footnotes and a footnote inspection view.
- Tables, including formatted content inside cells.
- Mathematical notation.
- Mermaid-style diagrams, including links from diagram nodes to files.
- Selected safe HTML content with clearly documented limitations.

### Callouts

- Callout blocks with type, icon, color, and title.
- Custom callout titles.
- Foldable callouts.
- Nested callouts.
- A useful built-in family such as note, info, tip, warning, question, example, quote, success, failure, danger, and bug.
- Original customization through themes or safe style definitions.

### Attachments and web embeds

- Paste, drag, select, or record attachments into a note.
- Configurable attachment destination.
- Embed images, audio, video, PDFs, notes, headings, blocks, lists, canvases, and search results.
- Embed supported external web content such as videos or webpages with privacy and security controls.
- Resize or otherwise control visual presentation without destroying the underlying portable reference.

---

## 3. Properties, tags, aliases, and metadata

### Properties/frontmatter

- YAML frontmatter as the portable representation.
- Property editor that does not require manually editing YAML.
- Text, list, number, checkbox, date, and date-time values.
- Links as values where representable.
- Property autocomplete and navigation.
- Property search.
- Property rename across the Vault.
- Property display modes.
- Template-provided properties.
- A global property/type inspection view.
- Predictable serialization rules so edits do not unexpectedly corrupt frontmatter.
- Graceful preservation of unknown property values.

### Tags

- Inline tags and frontmatter tags.
- Nested tags.
- Tag validation and normalization.
- Tag search and autocomplete.
- Tag browser with usage counts.
- Rename or reorganize tags without silently damaging notes.

### Aliases

- Multiple aliases for a note.
- Link to a note using an alias while retaining the true destination.
- Include aliases when detecting unlinked mentions.
- Preserve aliases through import, export, rename, and sync.

---

## 4. Links, references, and embedded knowledge

### Internal links

- Wiki-link syntax such as `[[Note]]`.
- Standard Markdown links where practical.
- Link autocomplete.
- Link to an existing file.
- Create a link to a not-yet-existing file.
- Create that missing file later without losing the relationship.
- Link to a heading.
- Link to a specific block/paragraph.
- Custom link display text.
- Follow/open links with mouse, keyboard, and mobile interactions.
- Preview a linked note without leaving the current context.

### Backlinks and outgoing links

- List notes that link to the current note.
- Show backlinks in a side panel or directly within a note.
- Inspect backlinks for a note that is not currently open.
- Show outgoing links from the current note.
- Show unresolved outgoing links.
- Find unlinked textual mentions of the note title or aliases.

### Transclusion/embedding

- Embed an entire note.
- Embed a heading/section.
- Embed an individual block.
- Embed a list.
- Embed an image, audio file, video, PDF, canvas, or query result.
- Preserve a distinction between embedded source content and copied content.

### Spire improvement target

Spire should use stable internal object identities so links survive renames and moves. Portable Markdown exports should remain readable, while the index maintains resolved identity, link history, repair suggestions, and explicit conflict behavior.

---

## 5. Navigation and workspace

### Application shell

- Main editor area.
- Left and right sidebars.
- Ribbon/quick-action rail.
- Status bar.
- Configurable sidebar tabs and actions.
- Desktop and mobile-adapted workspace layouts.
- Language settings and localization.

### Tabs, panes, and windows

- Open files in tabs.
- Split tab groups vertically or horizontally.
- Resize and rearrange tab groups.
- Pin tabs.
- Stack tabs.
- Move tabs between groups or windows.
- Open pop-out windows.
- Link synchronized views of the same note or context.
- Restore previously open tabs and workspace layout.
- Save, load, and delete named workspaces.

### Fast navigation

- Quick switcher for opening notes by name.
- Command palette for all registered commands.
- Pin frequently used commands.
- Slash commands in the editor.
- Customizable keyboard shortcuts.
- Back and forward navigation history.
- Outline/headings navigation.
- Random-note navigation.
- Bookmarks for files, folders, headings, blocks, searches, graphs, URLs, and groups of bookmarks.

### Mobile navigation

- Mobile toolbar with configurable commands.
- Configurable quick action.
- Mobile navigation bar.
- Mobile tab management.
- Mobile sidebars and ribbon actions.
- OS widgets, shortcuts, share-sheet actions, Siri/assistant integrations, Spotlight/system search, and Android Quick Settings where platform APIs permit.

---

## 6. Search and discovery

### Search

- Fast full-text Vault search.
- Search terms and quoted phrases.
- Boolean combinations and exclusions.
- Operators for file, path, content, tags, properties, tasks, headings, sections, and blocks.
- Regular-expression search.
- Case-sensitive or insensitive modes.
- Sortable results.
- Copy/export search results.
- Embed live search results in a note.
- Search history or saved searches.
- Search active content, selected folders, or the whole Vault.

### Graph

- Global graph of notes and links.
- Local graph around the current note.
- Depth control for local graphs.
- Filters that include or exclude paths, tags, files, or query results.
- Groups with distinct visual treatment.
- Control node labels, arrows, attachment nodes, unresolved nodes, and orphan nodes.
- Control forces such as attraction, repulsion, link distance, and center strength.
- Time-lapse/chronological visualization.
- Open and navigate nodes directly.

### Page previews and context

- Hover/touch previews for linked files.
- Context snippets around search matches and backlinks.
- Honest indication of unresolved links, excluded files, and stale indexes.

---

## 7. Core productivity tools

### Templates

- Configurable template folder.
- Insert a template into the active note.
- Template variables for title, date, and time.
- Template-supplied frontmatter properties.
- Create new notes from templates.
- User-defined templates remain ordinary Markdown files.

### Daily notes and unique notes

- Create or open today's note.
- Configurable date-based filenames and destination folder.
- Generate daily notes from a template.
- Include properties in daily-note templates.
- Generate timestamped/unique notes, optionally from templates.

### Note composition

- Merge multiple notes.
- Extract selected content into a new note.
- Optionally use a template for extracted notes.
- Update or preserve links when content is moved.

### Audio recorder

- Record audio from within a note.
- Save the recording as an ordinary attachment.
- Insert an embed/reference at the recording location.

### Slides/presentations

- Turn Markdown sections into a presentation.
- Use explicit slide breaks.
- Support basic presentation formatting.
- For Spire, classify this as later unless it serves the project owner's actual workflows.

### Format conversion

- Convert common legacy or alternate link/property conventions into the supported portable form.
- Preview and report conversions.
- Avoid destructive bulk conversion without backup and rollback.

---

## 8. Canvas and spatial knowledge

- Create an infinite/spatial canvas.
- Add text cards.
- Add cards backed by notes.
- Add media, web-page, and folder cards.
- Select, edit, delete, resize, move, and arrange cards.
- Group cards spatially.
- Connect cards with directed or undirected edges.
- Add labels to connections.
- Change card and connection colors.
- Navigate along connections.
- Zoom and frame selections.
- Embed a canvas in a note.
- Store geometry and connections in a documented, portable JSON structure.
- Keep note-backed nodes linked to the canonical note instead of making disconnected copies.
- Investigate safe interoperability with Obsidian Canvas JSON through documented behavior and test fixtures.

---

## 9. Bases: database-like views over Markdown

Obsidian's current Help includes a substantial **Bases** system. It is important to Spire because it offers structured views without moving note data out of ordinary Markdown.

### Base definition

- Create a standalone base/view definition.
- Embed a base file in a note.
- Embed an inline base definition in a code block.
- Define one or more named views over files and properties.
- Keep source records as ordinary notes and frontmatter.

### Query and transformation

- Filter using file metadata, note properties, expressions, and logical operators.
- Sort by one or more fields.
- Group records.
- Limit result count.
- Select and reorder displayed properties.
- Rename display labels without renaming underlying data.
- Compute formula properties.
- Use arithmetic, comparison, boolean, date, duration, string, list, link, file, number, conditional, and type-aware functions.
- Reference the current row/object and other formulas.
- Calculate deadlines, overdue state, priority, totals, formatted currency, and other derived values.
- Compute summaries across result sets.
- Copy results or export them as CSV.

### View layouts

- Table view with row sizing and column summaries.
- List view with markers, indentation, and separators.
- Card/gallery view with configurable image property, fit, size, and aspect ratio.
- Kanban view grouped into columns, with movable cards and configurable visual fields.
- Map view using location properties and an optional mapping integration.
- Multiple views over the same query/data set.

### Spire direction

This belongs in a later structured-knowledge layer, but the initial property and identity model must not block it. Spire should ultimately make query/view files portable and documented, not an opaque database trap.

---

## 10. Import, migration, and interoperability

### Generic formats

- Import Markdown files and directory trees.
- Import HTML.
- Import CSV into note templates and properties.
- Import TextBundle/TextPack-style content and attachments.
- Preview mapped fields before import.
- Customize import templates.
- Preserve unsupported source material where possible and report what could not be translated.
- Avoid overwriting existing notes silently.
- Produce an import report with source-to-destination mapping, warnings, and failures.

### Documented application imports

The official importer documents migration from:

- Airtable
- Apple Journal
- Apple Notes
- Bear
- Craft
- Evernote
- Google Keep
- Logseq
- Microsoft OneNote
- Notion
- Roam Research
- Tomboy/Gnote

### Import behaviors worth preserving

- Import through exported files where available.
- Optional direct API/account import only with explicit authorization and narrow credentials.
- Template-driven title, body, folder, tag, and property mapping.
- Preserve tag hierarchies where possible.
- Map notebook/page hierarchy into folders or properties predictably.
- Preserve attachments and internal relationships.
- Handle journals and outlines explicitly.
- Retain incompatible source data rather than silently discarding it.
- Explain platform-specific limitations before import.

### Spire priority

The first release needs robust import of an existing Obsidian-style Markdown Vault and complete export back to portable files. Imports from other products can follow once the generic migration engine is reliable.

---

## 11. Synchronization, revisions, and recovery

### Local and remote Vault model

- Distinguish local Vault data from remote synchronized data.
- Allow offline work and later reconciliation.
- Connect and disconnect devices from a remote Vault.
- Create, list, rename, and delete remote Vaults.
- Support regional/server selection where relevant.
- Show understandable sync status and activity history.
- Run one-time sync or continuous/watch sync.
- Provide a headless synchronization client for servers and automation.

### Selective synchronization

- Select which file types synchronize.
- Exclude folders.
- Control whether app configuration, themes, plugins, and settings synchronize.
- Support separate settings profiles.
- Download attachments intelligently/on demand for storage-constrained devices.

### Conflict handling

- Never silently discard an unmerged newer revision.
- Detect concurrent changes by revision ancestry rather than timestamp alone.
- Preserve conflict copies when automatic merging is unsafe.
- Provide a diff and guided resolution interface.
- Treat simultaneous creation/deletion carefully.
- Keep tombstones long enough to prevent deleted content from spontaneously returning.
- Explain why an item was skipped, conflicted, restored, or deleted.

### Version history and recovery

- Per-note and attachment revision history.
- Restore prior revisions.
- View synchronization history.
- Retain settings history where settings sync exists.
- Local recovery snapshots independent of server sync.
- Clear retention policy and storage impact.
- Automatic server backups with tested restoration.

### Security

- Account authentication.
- Device registration and revocation.
- Two-factor authentication and recovery codes.
- Encryption in transit.
- Encryption at rest.
- Optional end-to-end encryption with an explicit statement of what the server can and cannot index.
- Clear key-recovery consequences.
- Honest documentation of cryptographic limitations.
- Scoped sharing permissions for shared Vaults.
- Audit-visible changes for collaborative Vaults.

### Collaboration

- Invite and remove users.
- Read or edit permissions.
- Shared-Vault synchronization.
- Near-real-time updates.
- Explicitly documented limitation between synchronization and true simultaneous collaborative editing.
- A future collaboration model that does not compromise single-user local-first behavior.

---

## 12. Publishing

### Publish workflow

- Select notes and attachments to publish.
- Preview pending publication changes.
- Publish new content, update it, or unpublish it.
- Optionally include linked notes and linked media.
- Define ignore/exclusion rules.
- Keep private content private by default.
- Offer a headless/CLI publishing workflow.

### Site capabilities

- Create, switch, configure, and delete sites.
- Site name and stable site identifier.
- Navigation configuration.
- Reading-experience settings.
- Appearance and custom CSS/assets.
- Community or custom themes only through reviewed, safe mechanisms.
- Custom domains and redirects/permalinks.
- Password protection or private access.
- Collaborator management and permissions.
- Image, PDF, audio, and video publication.
- Search, graph, and other optional site components.
- Social-preview title, description, and image metadata.
- SEO metadata and sitemap support.
- Optional privacy-respecting analytics integrations.

### Spire classification

Publishing is useful but should be a separate, permission-gated service after private authoring and synchronization are trustworthy. Publication must never leak private properties, excluded files, revision history, credentials, or server metadata.

---

## 13. Web capture and reading

### Browser clipper

- Browser extension that captures a webpage into the Vault.
- Choose destination Vault, folder, filename, and template.
- Save article content, selection, URL, author, title, date, description, and metadata.
- Download referenced images when requested.
- Highlight passages and append/export highlights to notes.
- Reader mode for decluttering webpages.
- Site-specific and automatically triggered templates.
- Import/export clipping templates.

### Template language

- Preset page variables.
- Meta-tag variables.
- CSS-selector variables.
- Schema.org/structured-data variables.
- Filters for dates, durations, capitalization, filename safety, replacement, joining, slicing, Markdown conversion, HTML cleanup, and URL handling.
- Conditions, boolean logic, fallbacks, variable assignment, loops, nested loops, and predictable evaluation order.

### Optional AI interpreter

- Transform or summarize captured content through a configured model.
- Use user-selected hosted or local providers.
- Make transmitted context explicit.
- Keep this optional and off by default.
- Never require AI for ordinary clipping.
- For Spire, route credentials through the self-hosted service or a secure client store, never into notes or browser-visible configuration.

---

## 14. Extensibility, automation, and developer surfaces

### Core and community extensions

- Modular built-in capabilities that can be enabled or disabled.
- Community plugin discovery, installation, updates, disablement, and removal.
- Restricted/safe mode that disables third-party code.
- Clear disclosure that plugins may access files and network resources.
- Review/signing/reputation model for distributed extensions.
- Permission declarations and least-privilege APIs for Spire rather than unrestricted process access by default.

### Themes and visual customization

- Light and dark color schemes.
- Installable themes.
- Theme updates and removal.
- CSS snippets for local customization.
- Custom app icon and platform-appropriate translucency where supported.
- Spire-specific design tokens so customization does not depend on copying Obsidian CSS or selectors.

### URI/deep-link protocol

- Open a Vault or note.
- Create or overwrite/append to a note only through explicit parameters and confirmation rules.
- Open/create today's daily note.
- Create a unique note.
- Open a search.
- Open the Vault manager.
- Integrate safely with external automation.
- Define URL encoding, Vault selection, and duplicate-name behavior.

### CLI and headless operation

- Command help and discoverability.
- Open/read/create notes.
- Search Vault content.
- List tags, properties, tasks, and files.
- Create a note from a template.
- Append a task to a daily note.
- Compare revisions.
- Synchronize continuously or once.
- Publish selected changes.
- Inspect sync status.
- Development commands for reload, logs, diagnostics, and screenshots where safe.
- Structured output mode for scripts in addition to human-readable output.

---

## 15. Appearance, accessibility, and interaction

- Light, dark, and system-following appearance.
- User themes and safe style snippets.
- Adjustable readable typography and line width.
- Zoom and text scaling.
- Keyboard-complete navigation.
- Customizable hotkeys with conflict detection.
- Non-US keyboard-layout awareness.
- Screen-reader semantics for editor chrome and navigation.
- Visible focus, selection, hover, and drag targets.
- Reduced-motion support.
- High-contrast compatibility.
- Touch-friendly mobile controls.
- Desktop, tablet, and phone layouts that preserve the same content model.
- Localized interface and documentation.
- Honest status indicators instead of decorative success states.

---

## 16. Diagnostics, maintenance, and supportability

- Version and update information.
- Automatic-update toggle and explicit update checks.
- Separate app and installer/runtime updates where relevant.
- Debug-information collection with private-data review before sharing.
- Startup-time diagnostics.
- Console/application logs.
- Sync activity and error logs.
- Clear categories for general, network, account, skipped-item, and conflict messages.
- Safe mode/restricted mode for diagnosing extensions.
- Recovery workflow for a broken configuration.
- Bug-report and feature-request links.
- Security-reporting path.
- Migration and compatibility warnings during upgrades.

---

## 17. Team and deployment capabilities

These are relevant to later multi-user or managed installations, not necessarily Spire's first release.

- Organization-wide installation and updates.
- Managed configuration folders.
- Approved plugin, theme, and snippet policies.
- Network allowlists and documented outbound connections.
- Account security controls.
- Commercial/team licensing is an Obsidian business concern, not a Spire feature requirement.
- Shared-Vault permissions.
- Shared publishing sites and collaborators.
- Security guidance for third-party code.
- Deployment documentation for desktop and mobile fleets.
- Audit and compliance information for organizations.

---

## 18. Explicit non-goals and clean-room boundaries

Spire should **not**:

- Copy Obsidian's proprietary application code.
- Copy its product branding, icons, screenshots, themes, CSS, or distinctive interface assets.
- Present itself as Obsidian or imply endorsement.
- Promise compatibility with undocumented internals.
- Execute imported community plugins written for Obsidian without an independently designed, permission-safe compatibility decision.
- Treat paid Obsidian Sync or Publish account administration, billing, plans, credits, refunds, taxes, or licenses as product capabilities to reproduce.
- Import private account data or call source-service APIs without explicit user authorization.
- Circumvent robots rules, authentication, paywalls, or technical access controls during research.

Spire may independently support documented, user-owned file conventions—Markdown, YAML frontmatter, wiki links, common embeds, Canvas JSON where safely specified, and import/export behavior—through original code and test fixtures.

---

## 19. Recommended Spire priority map

### Foundation: first usable release

- Portable Markdown Vault and ordinary attachments.
- Docker-hosted private server.
- Installable offline-capable web client.
- Account and device authentication.
- Source editing, Live Preview, and reading view.
- Files/folders, attachments, tags, aliases, and typed properties.
- Wiki links, heading links, backlinks, outgoing links, unresolved links, and previews.
- Stable identity across rename/move.
- Full-text search.
- Automatic revision-based synchronization.
- Clear offline/sync/conflict states.
- Revision history, conflict preservation, and recovery.
- Obsidian-style Vault import and complete portable export.
- Automatic server backup and tested restore.

### Compatibility layer

- Obsidian-flavored Markdown constructs used in real Vaults.
- YAML property preservation.
- Note, heading, and block-link parsing.
- Note and attachment embeds.
- Aliases and nested tags.
- Callouts, tasks, footnotes, tables, math, diagrams, and safe HTML preservation.
- `.canvas` import/export where the documented format can be supported safely.
- Unknown-file and unknown-frontmatter preservation.
- Compatibility report rather than silent normalization.

### Strong second layer

- Templates and daily notes.
- Saved searches and richer query operators.
- Local/global graph.
- Bookmarks, outline, quick switcher, command palette, and customizable hotkeys.
- Workspaces and split/tab layouts.
- Note merge/extract workflows.
- Audio recording.
- Android and desktop clients.
- Web clipper and reader mode.
- Headless CLI.

### Later structured and visual layer

- Stable block identities and block-level backlinks.
- Bases-like query definitions, formulas, summaries, and multiple views.
- Table, list, card, Kanban, and map layouts.
- Canvas, mind maps, timelines, and relationship maps.
- Typed objects and semantic relations.
- Publishing service.
- Shared Vaults and collaboration.
- End-to-end encryption after threat-model and search implications are resolved.
- Permission-safe plugin and automation platform.

### Likely exclusions

- Billing, tax, credit, refund, and commercial-license administration copied from Obsidian's business model.
- Compatibility with every Obsidian community plugin.
- Exact interface cloning.
- AI features that are mandatory for basic capture, search, or writing.
- Any feature that requires sacrificing portable files or recoverable history.

---

## 20. Acceptance questions for each candidate feature

Before moving a capability into Spire's committed feature plan, answer:

1. What user problem does it solve for the project owner?
2. Is it required for import compatibility, daily use, or only parity?
3. What is the portable on-disk representation?
4. What stable identity does it require?
5. How does it behave offline?
6. How is it synchronized and revisioned?
7. What happens under concurrent edits?
8. Can its index be rebuilt from canonical content?
9. What private data does it expose to the server, browser, plugins, or collaborators?
10. What is the export and exit path?
11. What automated tests prove round-trip safety?
12. Is the interaction original and appropriate for Spire rather than copied for familiarity alone?

---

## Source coverage index

The source review covered these official English Help sections:

- Bases
- Editing and formatting
- Extending Obsidian
- Files and folders
- Getting started
- Import notes
- Linking notes and files
- Obsidian desktop/mobile behavior
- Obsidian Publish
- Obsidian Sync
- Obsidian Web Clipper
- Core plugins
- Teams
- User interface

Administrative documentation about contribution, payments, and company/community policy was reviewed only to distinguish product behavior from business or documentation operations.

## Research artifacts

- Official repository snapshot: `/workspace/spire/research/obsidian-help-source`
- Blocked Scrapling attempt manifest: `/workspace/spire/research/obsidian-help-snapshot/manifest.json`
- Second canonical-host attempt: `/workspace/spire/research/obsidian-help-snapshot-v2/manifest.json`

The repository snapshot is research evidence, not Spire source code. It should not be bundled into the application or treated as implementation material.
