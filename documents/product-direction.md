# Spire — Product Direction

**Status:** Approved product path
**Approved by:** the project owner
**Date:** 2026-10-15

## Product statement

**Spire is a focus-first writing workspace for people with ADHD, combining a familiar document interface, frictionless Quick Formats, portable Markdown ownership, optional self-hosted synchronization, and visual revision safety across Windows, Linux, and Android.**

Spire is not an Obsidian clone, a Notion clone, or a synchronization experiment with an editor attached. Its purpose is to help someone begin writing, remain in the thought, and trust that their work remains theirs.

## Core promises

- A clean, familiar, Word-like writing surface that does not require Markdown knowledge.
- Ordinary Markdown documents and real attachment files remain portable to other applications.
- Quick Formats keep hands and attention in the writing flow, with compact contextual help and consistent behavior across platforms.
- Device-only workspaces remain user-owned local folders and are never uploaded merely because a Server is connected.
- Explicitly chosen synced workspaces automatically synchronize with a self-hosted Spire Server, including durable pending state, offline support for hydrated files, and conflict protection.
- Device-only and synced workspaces may coexist and remain visibly distinct.
- Stable identity, origin, revision receipts, caches, and transfer authority remain outside Markdown.
- A deliberate Server → Local move retains identity and last acknowledged revision without granting Local automatic-upload authority; a deliberate return recognizes the original and protects both versions if the Server changed.
- Copy is distinct from move and does not inherit replacement authority.
- File History, Compare Changes, and Resolve Conflict borrow Git-style revision visualization without exposing Git complexity.
- Restoring history creates a new revision instead of deleting later history.
- Conflicts compare the shared base, device version, and Server version, offering keep-device, keep-Server, keep-both, and safe merge paths without silently discarding either side.
- Every affected change is assessed and independently verified on Server/web, Windows, Linux, and Android.

## Storage model

### Device-only workspace

A user-owned local folder is authoritative. Files remain available to other applications. Spire sidecar metadata may preserve identity/history, but cannot override ordinary file ownership or trigger implicit upload.

### Synced workspace

The user explicitly chooses a self-hosted Spire Server as the synchronization and backup home for that workspace. Explicit opt-in authorizes automatic synchronization for that workspace only. Connecting a Server never absorbs unrelated local folders.

A synced workspace requires a complete Server index, on-demand content/attachment hydration, device-local offline cache, durable queued writes, visible saved/pending/synchronized/offline/conflicted states, revision history, and safe disconnect behavior.

## Revision interface

- **File History:** revision timeline; inspecting and restoring older versions.
- **Compare Changes:** additions and removals with familiar green/red styling plus non-color indicators and surrounding context.
- **Resolve Conflict:** three-way view of shared base, device changes, and Server changes.

Whole-file restore is the dependable first workflow. Selective section recovery may follow.

## Platform and architecture rules

- Paths are locations, not identity.
- Origin identity is scoped by account and Server workspace.
- Other devices are never told device-local-only bytes are available.
- Attachments and file-specific styles retain exact bytes through transfers and recovery.
- Legacy clients fail closed when a provenance-dependent action would strip required identity metadata.
- Backups preserve the operational metadata needed for identity/history/conflict safety while documents remain portable Markdown.
- Shared source does not by itself prove platform parity; verify each runtime, adapter, bundle, and artifact.

## Near-term path

1. Preserve the dependable editor and Quick Formats.
2. Formalize device-only versus explicitly synced workspace setup.
3. Complete durable Server index, hydration, offline cache, queued sync, and visible state.
4. Complete stable identity/origin retention and deliberate Local ↔ Server return.
5. Add whole-file File History and Compare Changes.
6. Add three-way Resolve Conflict with preservation-first choices.
7. Prove equivalent workflows in hosted web/server, Electron Windows/Linux, and Android adapters.
8. Dogfood with meaningful writing and prioritize observed friction.

## Scope discipline

Database-style views, page/print modes, collaboration, permissions, plugins, and simultaneous co-editing remain later considerations. A feature belongs now only when it strengthens focused writing, ownership, retrieval, synchronization confidence, revision safety, or document presentation without forcing the user to manage underlying machinery.
