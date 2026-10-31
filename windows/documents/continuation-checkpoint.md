# Current working checkpoint (writer: rich/source authoring parity)

Active bounded workflow: close full native rich/source authoring/selection/rendering parity with the hosted client — editable lists/quotes/checklists/code blocks/highlights/underline, managed-table find/place editing, case/format/list style flows, quick-format shortcuts, definition command, selection-safe galleries. Native WPF only. Hosted tree /workspace/spire strictly read-only reference. (The previously verified quick-actions/styles execution record is preserved below.)

Hosted contracts verified this session (read-only, exact files):
- client/DocumentEditor.tsx: editable kinds heading/paragraph/text/list/blockquote/hr/code (mermaid→protected); protected regex applied AFTER stripping ==..== and <mark…>…</mark> (highlightSafe): `!?\[\[|\[\^|\[!|==|\$|!\[|\^[\w-]+(?:\n|$)|<(?!\/?u>)[A-Za-z!/]|&(\w+|#\d+);`; footnote-definition presence (`^\s*\[[^\]]+\]:`) protects any '[' block; per-node originals map preserves raw for unchanged blocks; changed top-level nodes are re-serialized whole and joined '\n\n'; file order prefix/frontmatter preserved; CRLF honored.
- client/highlight.ts + HighlightChooser.tsx: swatches Yellow #ffe082, Orange #ffb074, Pink #f5a6cb, Red #ef8b8b, Green #a5d6a7, Cyan #80deea, Blue #90caf9, Purple #c5a3e8; normalizeColor 3/6-digit hex; highlightInk WCAG (l+.05)/.05 >= 1.05/(l+.05) ? #111111 : #ffffff; markup default `==text==`, colored `<mark style="background-color: #xxxxxx; color: #yyyyyy;">text</mark>`; applyHighlight unwraps/extends existing wrappers, per-line chunks, selection returned inside first chunk.
- client/formatting.ts: formatText inline bold/italic/underline <u>/strike/code wraps; heading strip `^ {0,3}#{1,6}(\s+|$)`; quote '> ' prefix; list styles dash/asterisk/plus/number-dot/number-paren/lower-alpha/upper-alpha/task with indent preserved, existing marker/task stripped, task checkbox preserved; case→caseSelection.
- client/capitalization.ts: caseMap upper/lower/title/sentence/toggle with UTF-16 boundaries; wordRange `[\p{L}\p{M}\p{N}_]+(['’][\p{L}\p{M}\p{N}_]+)*`.
- shared/managed-table.ts: findManagedTableAt/placeManagedTable with `<!-- spire:table id=… -->` / `<!-- /spire:table -->`; cells split on unescaped |, <br> for newlines; alignments :--- / :---: / ---:.
- client/QuickFormat.ts: @bld/@itl/@stk/@und inline pending marks + @hd1..@hd6 block heading; token at paragraph start or after whitespace, exact, followed by space; disabled in code/protected/composition; Enter stops pending; quickFormatLabel status; @def on Enter opens definition command.
- client/DefinitionCommandDialog/TermLinkDialog/dictionary: term link `[[relative#anchor|label]]` style target, dictionary page creation `Dictionary/<name>.md`, appendDefinition duplicate-check, headingId lowercased slug.
- client/FormattingToolbar.tsx: menus capture selection at open; heading levels 0–6; list gallery 8 styles; case gallery 5; blocks gallery code/quote; table editor operates on source with findManagedTableAt at selection; highlight gallery default/swatches/custom hex/remove.

Planned native implementation (in progress, same session):
1. Spire.Core RichWritingDocument: new block kinds list/quote/hr/code with hosted-protected-test parity (highlightSafe first), underline <u> + highlight == / styled <mark> runs with exact markup, list structure (ordered start, task items, nesting) parse + deterministic normalized serializers, code fence preservation (char/length/lang), selection mapping for list items/quote/code scoped to current block raw.
2. Spire.Core PortableAuthoring: ports of formatText (all kinds/styles), caseMap/wordRange/caseSelection, applyHighlight/normalizeColor/highlightInk/highlightMarkup, findManagedTableAt/placeManagedTable, quick-format matcher + dictionary helpers.
3. Spire.Windows NativeWritingView: render lists (WPF List, decimal/disc markers, task checkboxes), quotes (bordered section), hr, code (monospace, Enter=LineBreak), highlights/underline runs; export rebuilt only for changed blocks; SourceSelection for new kinds (fail-closed with actionable message, never misapplies); quick-format shortcuts + status label + @def event; clipboard restricted to plain text (already), no drop.
4. MainWindow: Lists/Case galleries, Highlight gallery (default + 8 swatches + custom hex + remove), Table edit-existing (findManagedTableAt → prefilled dialog → placeManagedTable), Define/dictionary parity incl. term links, keep all existing flows.
5. Tests: RichWritingTests extensions (list/quote/code/highlight roundtrips + selection), AuthoringTests extensions (formatText matrix, case parity, managed table find/place, highlight apply incl. unwrap/extend), RuntimeSmoke extended for native list/checklist/highlight/quick-format editing through real WPF.
6. Full harness + Release win-x64 build + gaps documented here.

No Telegram, no workers spawned, one writer. Hosted source untouched.

---

# Previously verified checkpoint (quick actions + styles execution — preserved record)

Direct implementation continues from repaired folder workflow baseline. No background worker is active.

Implemented that execution:
- Native folder move/rename and confirmed nonempty Trash actions.
- Full workspace backup with bounded ZIP validation, exact pending/conflict/assets/metadata preservation and account-isolated atomic restore.
- Restore saves a safety backup and disconnects the server before further explicit sync.
- Atomic additive Markdown import, exact current Markdown export.
- Native action palette and persisted font/wrap settings, keyboard shortcuts.
- Fixed root-level new-file parent crash and hard-coded visual font size.
- Added core backup tests and opt-in isolated native Windows runtime smoke.

Verification:
- Full core harness passes including folder workflows and backup tests.
- Release build zero warnings/errors; self-contained win-x64 publish succeeds.
- Actual Windows WPF launch, byte-preserving visual typing, native selection/save, folder move/reload, backup/restore and disk reopen PASS, exit 0.
- Runtime target TABLET-A3C937RF over verified SSH 100.78.75.32; isolated TEMP workspace. Production and normal user data untouched.
- Remote evidence C:\Users\Wrath\AppData\Local\Temp\SpireAcceptance-45bdf840bba14198b42b1b5f9c611b00\report.txt.

Hosted contract (that execution, read-only /workspace/spire):
- POST /api/quick-actions {label,folder,namePattern,templateId} → 201 action {id,revision,...}; templateId null or id; saved templates prefixed "saved-"; built-in full templates only (checklist, cigar-journal, journal — NOT header-hero/collapsible).
- PUT /api/quick-actions/:id {label,folder,namePattern,templateId,revision} → action with incremented revision.
- DELETE /api/quick-actions/:id?revision=N → {ok:true}.
- PUT /api/quick-actions/order {ids,expected} → {ok:true}; 409 when expected mismatches server order.
- POST /api/quick-actions/:id/activate {op} → 201 note; idempotent per op; 409 op reused for different action; 404 action missing; 410 note purged; server computes folder+stem ({date}→yyyy-MM-dd, {time}→HH-mm-ss, server-local), appends .md, -N uniquification, creates ancestor folders.
- Activation gate: save+sync first; refuse while outbox/conflicts non-empty ("Sync and resolve pending changes before creating a file.").
- Input schema: label 1..100 trimmed; folder safePath nonempty ≤240; namePattern 1..120 trimmed, no '/', substituted form valid safePath segment, stem after optional .md strip nonempty; templateId ≤100 nullable.
- PUT /api/styles {path,content} → {path,content}; path safePath ending .css, content ≤100,000, rejects @import/url( and at-rules; client scopeFileCss also rejects empty selectors and html/body/:root selectors; per-file style path = note .md→.css; server renames style on note rename (409 on destination collision); no style delete; last-write-wins (no revision) — native mirrors exactly and documents it; unattached styles = style paths without an active note.

That execution's code/test detail:
- src/Spire.Windows/QuickActionsUI.cs: CS0128 duplicate local + CS0037 JsonElement null-comparison compile errors fixed (templateLabel, ValueKind==Undefined lookup); picker now offers only NativeTemplates.Full built-ins plus saved templates (section templates excluded); unknown templateId renders "Template unavailable", null renders "Blank file"; activation requires server+session; workspace-null guard on edit flow.
- src/Spire.Core/QuickActions.cs: OfType<JsonNode>() warning fix; QuickActionRules.Stem now strips the optional .md suffix like hosted actionStem, so activation target = folder+"/"+stem+".md"; QuickActionRules.RuleHead replaced with the hosted style-css.ts head-scoping regex (^|})(\s*)([^@{}][^{}]*)\{ — real parity bug found by the new tests; ParseRules now slices the body to the next closing brace from the hosted-style head match.
- Hosted-faithful quirks preserved and documented in tests: standalone ":root" selectors, empty "{}" blocks and "@"-prefixed at-rule preambles are never matched by the hosted scoper, so native accepts them exactly like hosted.
- tests/Spire.Core.Tests/QuickActionRulesTests.cs, StyleTests.cs, QuickActionSyncTests.cs created and registered in Program.cs.

Regression coverage (all deterministic, fake transports, no network):
- QuickActionRulesTests: StylePath, Substitute/Stem actionStem parity, ValidateInput accept/reject matrix, full/saved template availability, Normalize identity/unknown-field preservation/revision rules, OrderPayload contract.
- StyleTests: snapshot style visibility + invalid snapshot map rejection; durable style outbox; unsafe CSS rejection matrix; ParseRules projection subset; idempotent style PUT, lost reply, corrupt ack retention, missing style transport retention; bidirectional style/rename guards; native store fail-closed; archive full-state round trip, owner-isolated restore, corrupt-backup rejection matrix, schema-2 refusal.
- QuickActionSyncTests: order apply with exact ids/expected contract, independent-change conflict, lost-reply drop, corrupt-ack retention and retry, conflict discard; activation success ledger/visible file, disconnect retry, post-apply lost reply replay, explicit requeue replay, 410 purge conflict, deterministic template rejection, op/action collision, malformed ack retention; delete guard, order gate, stale-delete revision conflict, creation drain, retained activation behind an order conflict.

That execution's verification:
- Full core harness `/home/spire/.local/share/dotnet/dotnet run --project tests/Spire.Core.Tests` exited 0; all suites PASS.
- Release build `/home/spire/.local/share/dotnet/dotnet build src/Spire.Windows/Spire.Windows.csproj -c Release -r win-x64` succeeded: 0 warnings, 0 errors.

Still incomplete overall (unless closed and verified below in later sections): interactive Windows acceptance of the quick-action/styles UI, isolated real-server fixture acceptance, full editor/rendering/selection parity, capture/recording and complete media UX, map modes/touch/zoom, drag/drop and exact UI geometry, history diff and other ledger gaps, broad interactive Windows acceptance. The verification ZIP is a test artifact, NOT final full-parity delivery.
