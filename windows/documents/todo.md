# Implementation and acceptance

- Build native Windows shell matching existing Spire layout.
- Implement atomic local workspace and durable mutation outbox, independent of login.
- Implement HTTPS cookie/CSRF authentication with OS-protected session persistence.
- Match base-revision/idempotent mutation and conflict semantics; preserve drafts on revocation.
- Port file/folder navigation and visual/source editor with lossless Markdown round trips.
- Port templates, tags, sources/citations, maps, quick actions, history and settings.
- Synchronize attachments and metadata, not just file bodies.
- Verify offline restart, reconnection, conflicts, recoverable deletions and account isolation.
- Produce self-contained Windows x64 artifact; native runtime testing requires current-task device authorization.
- Do not modify live server, push source, or claim full parity from a foundation build.
