# Spire — Features

## Shared template writing toolbar — deployed

Deployed code revision `25db76e` as `toolbar-25db76e` to https://spire.example. Production build, 80/80 unit/API tests and 93/93 browser tests passed, including sidebar outside-click dismissal, animated folder drag/drop, empty-folder deletion and file wording. All 127 candidate assets match the accepted build (equivalent generated service-worker ordering); served HTML and entry JS/CSS match. Live health returns ok, anonymous snapshot returns 401, container is healthy, and the original writable named volume and loopback-only binding are retained. Application/full-volume backups and checksums verified at `/srv/spire/backups/toolbar-25db76e-20261009T193505Z`; rollback image/config retained. No source push, physical phone access, authenticated live editing or microphone recording test was performed. Physical Android WebView acceptance remains unverified; shared UI is delivered through the existing hosted client without a replacement APK.


Template editing now reuses the normal writing toolbar in Editor and Source modes: text styles, highlighting, headings, lists, capitalization, code/quote blocks, tables, media/attachment insertion, dates/times, alignment, spacing, page breaks, links, tags and nested templates. Save template remains separate from workspace-file saving; saved templates update in place and built-ins save editable copies. Complex-template desktop/touch coverage verifies save/reopen persistence without creating workspace files. Microphone recording and physical Android WebView acceptance remain unverified.

The existing outside-click sidebar dismissal, animated folder drag/drop and empty-folder deletion with file terminology remain required release checks. Status-bar test assertions were updated to include authoritative file counts and zero pending changes; production behavior was not weakened. Android consumes this hosted UI through MainActivity.loadUrl(server+"/"); no native source change or replacement APK is needed.



## Sidebar map cleanup and external search — deployed

the project owner requested removal of the sidebar map heading/counts, status badge, control toolbar and visible legend, then clarified that search must remain below and outside the map panel. The compact panel retains the canvas, file picker and selected-file actions. Search is an independent sibling field immediately above the sidebar tabs and still filters map matches. Native pointer/touch gestures and keyboard navigation remain; screen-reader gesture instructions are retained without a visible legend. Full-size component controls are unchanged.

TypeScript project check and Vite production build passed; all 80 unit/API tests and all 89 browser tests passed. New desktop and simulated-touch checks prove the search is outside/below the map, above the tabs, filters correctly and does not cause horizontal overflow. Existing graph, file opening, template tracking, hidden-map animation suspension, reduced-motion pixels and touch gesture tests pass. One initial test locator wrongly excluded the hidden map; it was corrected to query the hidden canvas directly. No source push, native changes or phone access for this cleanup. Deployed tested source `dd74e43` as `map-search-dd74e43` after the project owner's explicit deployment request. All 127 candidate image assets match the tested build (service-worker generated ordering normalized with identical precache set and logic). Live HTML and entry JS/CSS match; HTTPS health, anonymous snapshot rejection (401), healthy container, original writable named volume and loopback binding verified. Application backup and full-volume archive verified with checksums; prior image retained for rollback. Anonymous live sign-in loads without page errors. Authenticated live interaction and physical WebView testing were not performed.

## Sidebar map — deployed

The existing Files / Tags / Templates sidebar now contains the handmade sphere map above its tabs. Files shows existing references; Tags joins files sharing tags; Templates joins each saved or built-in template to files with recorded insertion usage. Template-node actions preview, never insert implicitly. Usage is synchronized note metadata, not additional Markdown, and survives ordinary edits, nested-folder reassignment, restart, history and application backup/restore. Older files have no trustworthy historical template provenance; no guessed backfill is performed. The map retains its camera when the sidebar closes and reopens, and pauses animation while hidden.

Production build, all 80 unit/API tests and all 87 browser tests passed. Regression tests open the relocated sidebar explicitly, avoid its picker during canvas gestures, and scroll nested drag targets into view. Deployed commit `55c087e` as `sidebar-map-55c087e`. All 126 non-worker image artifacts match local build hashes; the generated service worker has the same precache set and identical logic (only build-time asset ordering/cache-key ordering differs). Live entry JS/CSS and index match the accepted image. HTTPS health, private API rejection, anonymous sign-in without page errors, healthy container, original writable data volume and loopback binding verified. Application/full-volume backups verified and rollback image retained. Hosted UI also serves Android WebView; physical-device acceptance has not occurred. No source push.

## Left sidebar Files / Tags / Templates — deployed

the project owner requested Tags and Templates tabs in the existing workspace sidebar. Files retains the existing nested folder tree, drag/drop and Trash. Tags groups active files using the shared inline/front-matter tag parser and opens them through the normal save/open path. Templates lists saved and built-in section/full templates with a source preview and an explicit Insert template action; browsing does not mutate writing, and insertion is disabled without an editable file. Existing writing and complete saved-template source are retained. The tab strip includes visible labels and arrow/Home/End keyboard navigation. Search applies to the selected tab; switching tabs clears search. Hosted UI is reused by Android WebView; no native changes or phone access.

The initial local checkpoint passed 77 unit/API tests and the full browser suite. Final combined sidebar/map acceptance passed 80 unit/API and 87 browser tests, and is deployed as `sidebar-map-55c087e`. Test setup repairs are not claimed as production defect fixes. Source is committed locally; no Forgejo push or physical Android testing was performed.

## Code-language selection and template creation — deployed

Deployed hosted code revision `40ae5f5` as `code-templates-40ae5f5`. All 122 tested asset hashes matched the image; live entry `/assets/index-Csu7sKjd.js` matches the tested hash and contains template creation and Code language controls. HTTPS health passes, anonymous snapshot returns 401, container is healthy, original read/write data volume and loopback port are preserved. Application backup and volume archive passed verification/checksums; rollback image is retained. No physical Android WebView test or source push was performed.

Blocks → Code provides a language selector based on highlight.js languages/aliases, plain code, JSX/TSX and a custom language tag. Insertion preserves captured selection, surrounding source and literal pasted backticks using a safe fence. Empty insertion and Quote behavior remain supported. Focused browser acceptance passed on desktop and touch, including Bash/Python/TypeScript/custom tags and save/reopen. Saved section/full template creation passed all four desktop/touch category checks with exact complete-source preservation and reuse. The Android shell loads the same hosted feature; no native implementation is necessary. Physical Android WebView acceptance remains unperformed.

## Unified Android app settings — hosted support deployed; physical client acceptance pending

the project owner approved Aphelion's proposal to move Reload, Print / Save PDF, Server connection and About into the hosted Settings surface. Settings → Android app appears only when the APK supplies the origin-scoped message bridge; ordinary browsers and older APKs retain their existing Settings tabs without Android controls. The new 0.1.1 (versionCode 2) client removes the separate native header/overflow menu. Native confirmations still protect reload/server switching; a native Server connection recovery control is shown on main-page connection/HTTP/TLS failure so an unreachable hosted Settings screen cannot trap the user. No account or cache migration, new offline guarantee or editing-lease changes.

Both canonical repositories are required for this feature: `/workspace/spire` supplies the Settings UI and `/workspace/spire-android` supplies the allowlisted native bridge and updated APK. Native accepts only info/reload/print/connection/about from the selected HTTPS origin's main frame, rejects stale WebViews, and reports current version/server metadata. Hosted browser regression was proven failing before implementation and passing afterward. Final hosted acceptance passed 77 unit/API tests and 83 browser tests. Compatible hosted support is deployed in `code-templates-40ae5f5`. Physical WebView/print-dialog acceptance and source push remain unperformed; APK build verification is tracked separately.


## Current-file mind-map slice — deployed

Context → Details embeds the existing handmade sphere renderer with the current file selected automatically, only its direct incoming/outgoing linked files, and the established reference pulse direction. No full-Reliquary picker or demo data. Zoom/reset and pointer/touch gestures use the existing renderer; connected files open through the renderer or accessible Linked files buttons below. An isolated file remains visible with an empty-connections message; renderer failure leaves the accessible list available. Changing files updates the slice, leaving Details destroys the renderer, and no map interactions write document content. Focused browser acceptance verifies counts, switching files/tabs, controls and preserved writing; unit coverage excludes unrelated/two-hop/deleted/unresolved nodes. Deployed `ec4ad69` as `filemap-ec4ad69`. Production build, 72 unit/API tests and 71 browser tests passed locally. Live JS/CSS hashes match the accepted build; HTTPS health, anonymous sign-in without page errors and private API rejection verified. Application/full-volume backups verified, incumbent image pinned for rollback; existing persistent files, volume, loopback binding and proxy network preserved. Authenticated production map interaction, physical-phone validation and rollback drill not performed.

## Section and full templates — deployed

The Templates picker has separate Section templates and Full templates categories. Section templates retain Header & hero and Collapsible section. Initial full templates are Cigar journal (details, thirds, construction, pairing, verdict), Journal (daily entry and reflection), and Checklist (portable Markdown task checkboxes). Choosing a full template inserts its Markdown into the current file without replacing existing writing; opening/canceling the picker does not change the file. Mobile acceptance covers all three insertions and save/reopen persistence. Deployed source `b68cadd` as `templates-b68cadd`. Build, 71 unit/API tests and 70 browser tests passed locally. Live JS/CSS hashes match the accepted build; HTTPS health, anonymous sign-in without page errors and private API rejection verified. Verified application/full-volume backups and pinned rollback retained; persistent data, loopback binding and proxy network preserved. Authenticated live editing, physical-phone validation and a rollback drill were not performed.

## Per-file cursor bookmark

Context → Bookmark provides Set/Update bookmark and Remove bookmark. Reopening a bookmarked file automatically returns to the stored Editor or Source position. A versioned `spire_bookmark` YAML property stores the offset and nearby text for recovery after edits; document body and user metadata are retained. Invalid bookmark data is ignored and malformed YAML blocks bookmark mutation. Browser acceptance proves Source restoration and actual typing at the restored Editor caret after reopening. Header/Footer bookmarks reveal the matching optional region. Deployed source `dd36fc4` as immutable release `bookmark-dd36fc4`. Production build, 69 unit/API tests and 67 browser scenarios passed. Image and public JS/CSS hashes match the accepted build; HTTPS health, anonymous sign-in without page errors and private API rejection verified. Application backup and full-volume archive verified, existing persistent files unchanged at cutover, volume/loopback binding/proxy network preserved, pinned rollback retained. No repository push, authenticated production editing, physical phone validation or rollback drill performed.

## Compact section bar — deployed

Section tabs use one horizontally scrolling row. A caret above the bar collapses/reveals it with slide/fade and rotation; opened document sections remain open. Hidden controls are inert, reduced-motion is respected, and the dock is excluded from print. Deployed `c5b32fa` as `20261008T235036Z-tabs-c5b32fa`. Production build, 66 unit/API tests and all 65 browser tests passed, including desktop/mobile scrolling and collapse checks. Image and public assets match the tested build; anonymous live sign-in has no page errors, HTTPS health and unauthenticated rejection pass. Existing volume and loopback binding retained, application/full-volume backups checksum-verified, pinned rollback retained. No repository push, authenticated production editing, physical phone validation or rollback drill performed.


## Split and generated Table of contents — deployed

Deployed source `89ad1f0` as immutable release `20261008T232051Z-contents-89ad1f0` at https://spire.example. Split is always beside Source, with no Context preference gate. Context → Page layout offers Table of contents; its independently collapsible tab precedes Header. Entries derive from body Markdown headings, exclude fenced code, preserve heading levels, and navigate in the rich editor. Generated ordinary Markdown links serialize before Header and refresh on save; third-party heading-anchor conventions can differ.

Acceptance: production build, 66/66 unit/API tests and 65/65 browser scenarios passed. Corrected the CSS browser assertion to check Split preview rather than an editor no longer mounted in that mode. Tested build assets match staged and served JS/CSS; live homepage references them. Container healthy, original named data volume and loopback binding retained; HTTPS health and logged-out API rejection pass. Application backup and full-volume archive verified with independently rechecked checksums; prior immutable image and pinned rollback retained. Source committed locally, not pushed. Authenticated live editing, physical phone checks and rollback drill not performed.



## Optional footnotes and collapsible document sections

Context → Page layout now offers an opt-in Footnotes switch. Enabled definitions are stored after Footer in source using ordinary Markdown `[^id]: Explanation` syntax inside section-boundary comments; body references use `[^id]`. Disabled definitions are preserved in page-layout YAML for restoration. Incomplete footnotes boundaries reject section editing without silently consuming the body. Header, Footer and Footnotes have independent bottom collapse controls, start collapsed on reopening a file, and retain text through collapse, disable/re-enable, Source editing and save/reload. Header/Footer retain their formatted editors; Footnotes use a source textarea. Footnotes remain distinct from Footer and are not automatically printed at each page bottom.

Release acceptance: production build, 64/64 unit/API tests and final 63/63 browser scenarios passed. An earlier run had table-formatting and anonymous-startup failures; both passed in the clean full-suite rerun without product changes. Local authenticated browser coverage includes simulated mobile section toggles, source round-trip and persistence. Live deployment verification: source `af70cf2` deployed as `20261008T222801Z-footnotes-af70cf2` to https://spire.example. Corrected a staged Compose absolute build context that had pointed at the incumbent source; the rebuilt image matches accepted local JS/CSS bytes. Application backup and full-volume archive verified, with independently rechecked checksums. Healthy live container preserves the named volume, loopback binding and Caddy network. Homepage references accepted assets and served bytes match; HTTPS health and logged-out API rejection pass. Fresh anonymous browser sign-in renders without page errors. Prior release and image-pinned rollback retained. Authenticated live editing and physical-device testing were not exercised. No Forgejo push performed.

## Properties tab — local implementation

Context now has its own Properties tab. Add/edit/rename/remove Text, Number, Checkbox, Date and string List values in ordinary YAML frontmatter. Preserve body bytes, unrelated metadata/comments, and Page layout configuration. Nested/unknown metadata remains visible and source-editable. Internal spire_ settings stay in their own tabs. Invalid YAML, duplicates, reserved names, invalid typed values and dangling aliases fail safely. Removal requires confirmation; Cancel is non-mutating.

Deployed source `d6f1135` as immutable release `20261008T211948Z-properties-d6f1135` to https://spire.example. Production build, 63/63 unit/API tests and 62/62 browser scenarios passed. Application backup and full-volume archive were verified and checksums independently rechecked. Container healthy, existing named data volume, loopback-only port and Caddy network preserved; served entry JavaScript/CSS match tested build bytes. HTTPS health and logged-out API rejection passed; fresh anonymous browser renders sign-in without page errors. Prior release and pinned rollback retained. No authenticated live Properties workflow, physical phone check or rollback drill performed. Source committed locally, not pushed.

## Header/footer and page-break release

Source `78866b3`, immutable release `20261008T193738Z-pages-78866b3`, deployed to https://spire.example. Page menu offers Header, Footer and Page break. Header/footer Markdown regions surround the adaptive body; disabling retains text in portable YAML frontmatter for restoration. Enabled content appears in ordinary Markdown header/body/footer order. Page breaks use explicit HTML `break-after: page` and a visible editor divider; third-party print/PDF support is renderer-dependent. Source boundary mismatch fails safely with a visible warning rather than guessing which words to move. Includes the pending Media image icon.

Acceptance: production build, 56/56 unit/API tests, 60/60 isolated browser tests, clean whitespace. Page regression covers body editing, section toggle restoration, page-break insertion, save and reload. Tested local entry JS/CSS matched staged image and actual HTTPS homepage-linked bytes. Backups created and checksum-verified; healthy container, named data volume, loopback binding and Caddy network preserved. Previous immutable release and pinned rollback configuration retained. No authenticated live editing, physical Android validation or rollback drill performed. Source committed locally, not pushed.



## October 8 hybrid highlighting deployment

Deployed source `6cd888c` as immutable release `20261008T165857Z-highlight-6cd888c`, including the hybrid highlight picker and a reproduced date/time caret race fix. Final gates: production build, 53/53 unit/API tests, 116/116 browser checks (58 scenarios repeated twice), and clean whitespace checks. The temporal regression failed before synchronous content/dialog commit and immediate caret restoration, then passed three focused repetitions and the full repeated suite.

Application-consistent backup and full-volume archive were created before cutover; application integrity, archive readability and both SHA-256 checksums were independently verified afterward. Live container is healthy and matches the unique release image, the original read/write named data volume and loopback-only port are preserved, Caddy network remains connected, HTTPS health passes, logged-out snapshot returns 401, and served entry JavaScript/CSS exactly match the tested production build. Active-release pointer matches the running release. Previous Blocks release and pinned rollback image/config remain available. Source commits remain local/unpushed.

Authenticated live editing, physical Android IME/microphone behavior, third-party import/edit/export fixtures, and a rollback drill were not performed. Default `==text==` and styled `<mark>` are not universal Markdown highlighting or exact-color guarantees.

## Hybrid selected-text highlighting

The **Highlight** control opens a horizontally scrollable preview row below the formatting rail. **Custom color** is first, followed by default Markdown highlighting and eight standard swatches (Yellow, Orange, Pink, Red, Green, Cyan, Blue, Purple), plus Remove and Cancel. Previews use the selected text; empty selections disable application instead of inserting placeholder prose. Custom colors have a draggable saturation/brightness plane, hue slider, keyboard controls, editable HEX and RGB, validation, and live preview. Readable black/white foreground is chosen automatically.

Default highlighting saves `==text==`; explicit colors save ordinary `<mark style="background-color: #rrggbb; color: #rrggbb;">text</mark>`. These are extensions/HTML, not universal CommonMark highlighting: another application may render literal markers or strip colors. Shape is consistent between previews and rendered editor; appearance in other applications remains their CSS responsibility. Selection is captured before opening the chooser; Cancel/Escape do not change the file. Whole selected existing wrappers can be replaced or removed without nesting; source multiline selections serialize as separate inline spans. Rich document and table-cell marks preserve Markdown emphasis during serialization; unsupported HTML remains protected. Preview style admission is narrowly limited to literal HEX background/foreground declarations on mark elements, not arbitrary CSS.

Production build and 53 unit/API tests pass. Focused browser coverage exercises captured source selections, replacement/removal, custom HEX/RGB/hue/keyboard controls, invalid codes, foreground contrast, persistence/reopen, nested visual-editor formatting, and simulated-touch viewport/focus behavior. Full repeated browser acceptance and deployment verification are recorded separately below when complete. Physical-phone and third-party application round trips are not established by these local tests.

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


## Combined date and time format chooser

One Date & time toolbar control opens two rows of portable plain-text previews: dates (YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, MMM D, YYYY, D MMMM YYYY) and times (HH:mm, HH:mm:ss, h:mm A, h:mm:ss A). Selecting a format opens the existing Current/Manual dialog; manual insertion uses a native picker. Cancellation is non-mutating and insertion preserves the captured source selection. Values are fixed ordinary text with no Spire dependency. Deployed to the private preview as immutable release `20261008T134342Z-temporal-58eecd7`, implementation commit `58eecd71814b1f045dc16c34082e1dc608d815a6`. Verification: 47/47 unit/API tests, production build and 2/2 focused temporal browser checks passed; the preceding full browser run remained 49 passed / 1 intermittent temporal failure. Live HTTPS, feature markers in served bundle, Docker health, Compose project and retained data volume verified. Application and volume backups verified under `backups/20261008T134342Z-temporal-58eecd7`; prior audio release retained for rollback. Source push not authorized or performed.


## Blocks insertion menu
the project owner requested a Blocks gallery with visual Code and Quote previews, followed by a multiline text popup with Cancel and Insert. Empty code insertion is allowed. Both serialize portable Markdown at the captured selection; cancellation does not modify content. Implemented locally: gallery beneath the existing formatting toolbar; multiline input; Cancel/Insert; blank code insertion; safe fencing for pasted backticks; blank-line separation from surrounding prose. Unit/API tests: 49 passed. Production build passed. Blocks browser acceptance: 3 passed, including persistence, rendered code/quote round trips, visual-editor entry, cancellation, and simulated mobile focus/overflow. Final full browser regression: 52 passed, 1 failed (the previously recorded temporal repeated-insertion failure, independent of Blocks). Physical Android keyboard behavior is not verified. Deployed on the project owner’s explicit request to the private preview: immutable release `20261008T141820Z-blocks-0730fe7`, implementation `0730fe7`. Verified application backup and full volume archive with checksums; existing `spire-preview_spire_data:/data` remains read/write, loopback port and external Caddy network preserved. Container healthy; live HTTPS health returns `{ "ok": true }`; served entry JavaScript matches the running container hash and includes the Blocks gallery/dialog markers. Previous release retained for rollback. Source remains unpushed.

## Nested folders — deployed with saved templates

Folders render as an indented expandable tree, including ancestors implied by deep stored paths. New folder includes a Parent folder selector (Reliquary root or an existing folder) and a name/relative path. File creation can target any tree level; sidebar nodes retain full canonical paths for existing file drag/drop and folder deletion. Search keeps ancestors of matching descendants visible. No content migration or storage format change is required. Server deletion recognizes implied parents and preserves relative child paths during reassignment.

Both surfaces: the Android client loads this hosted UI; no native source change or replacement APK is required. Final production build, 76/76 unit/API tests and 80/80 browser checks passed, including the five nested-folder regressions. Android download adapter passed 6/6 in Chromium. Physical Android WebView acceptance is not performed. Included in deployed release `save-templates-245919d`; no repository push.

## Save page as template — deployed

Context → Template provides a template name and **Save as section template** / **Save as full template**. Both snapshot the entire current draft source without trimming or normalizing frontmatter, leading/trailing whitespace, Unicode or line endings; only the library category differs. Saving does not rewrite the source file. Templates persist in authenticated server state, synchronize to client snapshots, and appear beside the existing built-in choices in the matching category of the Templates picker. Insertion preserves existing writing. Same-category duplicate names reject rather than overwrite, and failed network saves display an error without stale success feedback. Verified backup parsing retains saved templates rather than dropping the new State field.

Acceptance: 76/76 unit/API tests, production TypeScript/Vite build, and 80/80 browser tests passed. Saved-template browser coverage verifies both categories on desktop and narrow touch-capable layouts, exact source, duplicates, failed requests, correct-category visibility, insertion and save/reload persistence. Android download-adapter checks passed 6/6 in Chromium. Android loads the same hosted UI; no native source change or replacement APK is required. Physical Android/WebView acceptance remains unperformed. Deployed code revision `245919d` as immutable release `save-templates-245919d` to https://spire.example with the project owner’s approval. All 122 staged asset hashes match the accepted local build; live HTTPS entry JS/CSS match it too. Application backup and full-volume archive passed independently rechecked checksums, and archive readability was verified. Container healthy; original named volume, loopback-only binding and Caddy network preserved. Active-release pointer matches the running release; incumbent image pinned and rollback Compose retained. Fresh anonymous live browser sign-in renders without page errors; HTTPS health succeeds and anonymous private API access is rejected. Authenticated live template saving, physical Android/WebView behavior and a rollback drill were not performed. No repository push. Relative links and attachment paths remain literal; cross-folder reuse may require adjustment. Template-library management and offline template creation are outside this feature.


## Main-area template editing
Selecting a template from the library or map opens it in the main visual/source editor, not a sidebar source preview. Save template updates saved templates in place with a stale-content conflict guard. Built-ins save as editable copies. File insertion remains explicit, and template editing does not create or modify workspace files. Hosted UI is reused by Android; no native changes or APK required. Production build, 80 unit/API tests and 91 browser tests passed, including desktop and simulated-touch template persistence. Physical Android WebView acceptance remains unverified. Deployed as template-editor-77cc5a5; all 127 candidate/live assets matched. Live health and anonymous-access protection verified; data volume retained, application/full-volume backups verified and rollback image retained.


## Approved emblem release — 2026-10-09

- Browser favicon, Apple touch icon, PWA manifest icons and legacy SVG endpoint now use the project owner’s supplied silver emblem with preserved aspect ratio.
- Deployed implementation: `0f3970c`; immutable release `branding-0f3970c`.
- Verification: production build, 80/80 unit/API tests, 93/93 existing browser tests, and the new branding browser test passed.
- Application backup and volume archive verified before cutover; rollback image retained.
- Live HTTPS health and byte-for-byte branding asset/build parity verified; named data volume and loopback-only port preserved.
- Android launcher/themed-icon update: source `60790ab`, version 0.1.2/code 3. Tests/lint/assembly and canonical signing passed; APK supplied separately, not installed or device-verified.
- Source commits remain unpushed; production deployment is complete.

## Source type dropdown
Custom monochrome picker replaces the native Source type select: seven labeled icon rows, descriptions, selected checkmark, large touch targets, scrolling, outside dismissal, Escape and arrow/Home/End keyboard navigation. Production build, unit/API suite and complete browser suite passed. Shared hosted UI reaches the Android WebView without a native APK change; physical WebView acceptance remains unverified.

Source type picker deployed and served HTML/JS/CSS verified equal to the accepted build. Health passed; backup and rollback retained. 91 unit/API tests and 96 browser tests passed. Physical Android WebView acceptance unverified.
