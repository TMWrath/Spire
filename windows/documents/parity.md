# Native Windows 1-to-1 acceptance ledger

Full native scope remains open. Hosted source is read-only; no browser wrapper or local server. Source implementation/test evidence below is NOT Windows runtime acceptance.

| Feature | Evidence in native source / harness | Open acceptance |
|---|---|---|
| Navigation | Hierarchical files, tag/template/source tabs, search; save-before-navigation WritingSession | Drag/drop, sidebar dismissal/animation and exact hosted visual fidelity |
| Writing | NativeWritingView, rich/source model and native preview; byte-preserving protected Markdown regressions | Full rich authoring/rendering, gallery geometry, selection behavior on Windows |
| Formatting | Heading/text/block/date/table/link commands and portable authoring tests | All hosted gallery choices, custom highlights, table editing, typing shortcuts |
| Dictionaries | Durable create/add-definition and duplicate-safe portable parser | Term-link flow and typed commands |
| Templates | Five built-ins, saved library editor, explicit insertion/provenance, offline create/update and ID remap tests | Main-editor template editing parity and complete toolbar workflows |
| Sources/citations | Update/delete library, portable citations and backlinks/map parsing tests | Offline source creation and generated-ID citation rebinding now implemented/tested; full source archive UX remains open |
| Media | Durable local attachments, asset upload/download and failure/retry tests | Full playback fidelity, audio recording, video capture |
| Maps | Locally implemented sphere/projection/pulses; direction and relative-link tests | All hosted modes, grouping/zoom/touch and Windows interaction acceptance |
| History/trash | Snapshot history inspection/restore, file trash/restore | Diff UI, full history/trash workflows |
| Folders | Durable create/empty-delete, offline restart, lost-reply reconciliation and conflicts | Native move/rename and confirmed nonempty Trash wired; attachment-containing moves blocked safely; broader Windows UI and sync acceptance open |
| Quick actions/settings/styles | Native action palette and durable font/wrap preferences, Ctrl+S/Ctrl+Shift+P; custom quick actions (picker offers only built-in full templates and saved templates; unknown template renders "Template unavailable", null renders "Blank file"), durable activation op replay with deterministic server rejections, explicit order conflicts/lost replies/corrupt acks, per-file styles with hosted style-css.ts validation parity (head-scoping regex, forbidden fetches/at-rules, application-root selectors) and bidirectional style/rename guards; QuickActionRulesTests/StyleTests/QuickActionSyncTests regression coverage | Interactive Windows acceptance of the quick-action/styles UI and isolated real-server fixture acceptance remain open |
| File sync | Durable integrated outbox/coordinator, owner isolation, revocation, explicit conflicts | Isolated real server fixture acceptance, native session persistence |
| Metadata/assets sync | Sources/templates/folders and asset adapters, unknown snapshot preservation; deterministic fake-transport regression for quick action order/activation and style sync (durable outboxes, idempotent replays, explicit conflicts, fail-closed store/archive state) | Isolated real-server fixture acceptance and native session persistence remain open |
| Backup/import/export | Versioned full-state ZIP backup, bounded archive validation, atomic owner-isolated restore with safety backup, additive Markdown import, Markdown export; core regressions and actual Windows backup/restore smoke pass | Full hosted archive interoperability and UI acceptance remain open |
| Delivery | Baseline core harness independently passed this execution | Final publish/package/hashes blocked on full implementation; Actual Windows isolated smoke now passes; full interactive/runtime acceptance still open |

## Execution evidence
This execution: full core harness `/home/spire/.local/share/dotnet/dotnet run --project tests/Spire.Core.Tests` exited 0 with all suites passing, including new QuickActionRulesTests, StyleTests and QuickActionSyncTests; fresh Release win-x64 build `/home/spire/.local/share/dotnet/dotnet build src/Spire.Windows/Spire.Windows.csproj -c Release -r win-x64` succeeded with 0 warnings and 0 errors after this execution's source changes (QuickActionsUI compiler fixes, QuickActionRules.Stem hosted actionStem .md-strip parity, QuickActionRules.RuleHead hosted style-css.ts head-scoping parity). Core harness evidence is not Windows runtime acceptance; interactive/runtime and isolated real-server fixture acceptance remain open. No hosted/Android/production changes, no push, no partial package or completion delivery.
