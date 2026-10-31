# Local availability investigation and folder defaults

## Reported evidence
Activity log shows a content/metadata disagreement for `00 - Inbox/Dashboard/Global Todo.md` and an unavailable indexed UUID-named Markdown file. These records identify conditions, not their original author or cause. No phone access, user-file edits, metadata deletion, or version selection was performed in this investigation.

## Source findings
- `local/runtime.ts` compares current scanned UTF-8 text with retained note content. Missing or differing content is excluded from the active view and its original record is retained. Both versions of a mismatch survive healthy sibling saves.
- `LocalFolder` serializes native load/commit operations, writes a durable before/after AtomicFile journal before touching provider files, checks for external changes, verifies provider write readback, and replays an incomplete journal before returning a loaded snapshot.
- `FolderTransaction` writes canonical content before private metadata and deletes the journal only after complete verification. Disabling comparison or discarding metadata would undermine recovery rather than prevent divergence.
- Runtime polling reuses a mounted snapshot. It does not currently refresh provider changes in place; reopening is the current retry boundary.
- A historical missing/mismatched record continues to produce a notice until explicitly reconciled. Clearing the activity log only clears reporting, not the condition.

## Prevention / recovery requirements (proposed, not implemented)
1. Add a non-destructive reconciliation UI: compare current file with retained content/history; make both recoverable before allowing an explicit import-current or restore-retained decision.
2. Distinguish positively absent files from provider read/enumeration failures. Retry transient reads with bounded backoff before presenting availability warnings; never interpret a provider failure as intentional deletion.
3. Detect provider changes on foreground/manual refresh without running full-folder scans during typing. Reconcile only against a verified generation and preserve pending editor/outbox changes.
4. Recognize external rename/move only from reliable identity/provenance, never a guessed UUID filename or content similarity alone.
5. Keep journal recovery and failed-save/no-acknowledgement tests. Add native interruption coverage at canonical write, rename/removal, metadata write and journal cleanup boundaries before changing transaction behavior.

The screenshot alone cannot establish that an interrupted Spire save, another editor, a sync service, or an unavailable Android provider caused these particular two entries. Exact-device evidence is still needed to attribute them.

## Implemented UI change
Removed forced `open` from both recursive folder renderers in `client/main.tsx` and `client/WorkspaceMounts.tsx`. Parent and nested folders now render closed by default and retain native disclosure toggles. No unrelated tags/conflicts/linked-file sections were changed.

## Verification
- New tests execute both actual JSX folder renderers through isolated React SSR fixtures. Both failed on expanded parents/children before production edits, then passed after removing the forced open defaults.
- Root suite: 145/145 passed.
- Existing Android bundled runtime/local tests: 12/12 passed. These prove simulated storage behavior, not the phone's provider.
- TypeScript phase of `npm run build` passed; Vite's default output cleanup hit an NFS EBUSY file. Isolated output build is tracked separately.
- No APK installation or on-device interaction performed.
