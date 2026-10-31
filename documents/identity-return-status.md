## Server-origin identity return — implemented and build-verified

Spire now preserves Server-origin identity across explicit Server → Local → original Server movement. Provenance is scoped to the exact origin, account, workspace, stable file ID and acknowledged revision. It is retained outside ordinary Markdown and never grants background synchronization permission. Legacy or mismatched provenance fails closed.

Explicit return behavior:
- unchanged original identity: restore the stable Server identity as a new revision;
- changed, deleted, restored or colliding Server state: reject the return and retain Local bytes;
- attachments, styles, folders and Markdown remain portable and are covered by verified transfer receipts;
- interrupted movement remains resumable and never assumes source deletion.

Conflict resolution is atomic and revision-checked. The UI exposes Keep mine, Keep Server, Keep both and Merge with shared-ancestor, device and Server content. A stale decision is rejected rather than overwriting newer Server state. Existing File History, Compare and Restore remain available; restores create new revisions.

Verification after the final source changes:
- focused conflict/store tests: passed;
- full `npm test`: 166/166 passed;
- `npx tsc --noEmit`: passed;
- isolated Vite production build: passed;
- production-renderer dual-tree, explicit-move, offline-cache and conflict acceptance: passed;
- Electron launcher/local persistence/stable-origin/renderer-isolation/Server-connection acceptance: passed;
- Android browser/SAF suite: 23/23 Node tests, 6/6 download checks and bundled mobile editor acceptance passed;
- Android buildbox `./gradlew test lint assembleDebug`: BUILD SUCCESSFUL, 75 tasks;
- `vendor/provenance.json` remained byte-for-byte unchanged during Android generation (SHA-256 `16f3378251a7c01096e114dd85cd278d7dc16e2452e814fc95954b000ae47ede`).

No deployment, push, installation, live-data modification or APK delivery was performed. Physical Android WebView/device acceptance remains an explicit evidence gap; browser/SAF simulation and a successful Android build are not presented as physical-device proof.
