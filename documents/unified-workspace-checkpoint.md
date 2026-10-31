# Unified Workspace Completion

## Verified behavior

The existing production Move file control is covered by the repaired and expanded `tests/unified-workspace-browser.mjs` acceptance test. The fix selects the active workspace and expands lazy folders before querying their files; no production source changed.

Verified against the fresh production renderer:
- Settings server connection and visibly separate Local/Server mounts.
- No implicit upload when connecting.
- Cancel leaves both stores unchanged.
- Local → Server and Server → Local movement preserves Markdown and linked binary attachments; source removal follows verified destination acceptance.
- Lost transfer acknowledgement retains source and safely resumes.
- Opened-only offline availability, queued edits, and both-version conflict preservation.

## Final verification

- Fresh production build and TypeScript passed (`/tmp/spire-apk-fresh-dist`).
- Production-renderer browser acceptance passed.
- Spire unit suite: 156/156 passed.
- Android workspace/recovery suite: 23/23 passed; download browser checks: 6/6; bundled-editor acceptance passed. Browser checks use Chromium, not a physical Android WebView.
- Buildbox `test lint assembleDebug`: BUILD SUCCESSFUL.
- Android package `com.tmwrath.spire`, version 0.2.15 (19).
- APK: `/home/spire/.hermes/artifacts/spire/Spire-verified.apk`.
- APK SHA-256: `db6a2eabdd3e55678f9f752b7566a7e12bbc5cbb69efaa9a2ba1092086b46632`.
- Canonical signing certificate SHA-256: `096dc9323929255c3b3ff9f781a3c29a32f86a7c2d36016031deb6a2e7933af6`.
- All 135 packaged web assets match the final local asset tree.

## Live service

self-hosted server SSH access is restored using the documented identity. The existing `spire-preview` container is healthy. `https://spire.example/api/health` returns `{"ok":true}`. The live index and all 123 assets in the fresh production build match byte-for-byte. No production code changed, so no new deployment, restart, backup, migration or cutover was required or performed. Older unused live assets are not included in the current-build parity claim.

Physical Android/WebView acceptance, Windows adapter/device acceptance, and authenticated live transfer against personal data were not performed. Browser fixture acceptance must not be described as those checks.
