# Spire unified workspace

## Unified Local + Server workspace — verified; live runtime already current

Local and Server workspaces are integrated in the production UI with explicit bidirectional file/folder transfer, distinct ownership, opened-file offline cache, resumable verified transfers and conflict preservation. This completion pass repaired production-browser test assumptions and added open-file movement acceptance. The test selects the destination mount before browsing it; after transfer the app focuses that destination and lazily renders only the active mount's tree. Verified cancellation leaves both stores unchanged; both directions preserve Markdown and linked attachment bytes; source enters Trash only after verification. Lost acknowledgement safely resumes; opened-only offline access and conflict copies are covered.

Verification: production build to `/tmp/spire-unified-workspace-dist`, TypeScript check, Spire unit suite (156/156), and `tests/unified-workspace-browser.mjs` against the production renderer all passed on 2026-10-15. No production source changed. Physical Android WebView not tested. Android bundles the shared editor with native local storage; its fresh verification/build is recorded in the continuation checkpoint.

self-hosted server access restored using the documented SSH identity. The live HTTPS health endpoint returns {"ok":true}; live index and all 123 assets of the fresh build match byte-for-byte. No production source changed, so no cutover, restart or data migration is necessary. Existing older unused assets are not counted as current build artifacts. Live authenticated transfer behavior was not exercised against personal data.


## Direct continuation evidence — incomplete implementation

This continuation added tested, platform-independent domain modules only:
- `shared/mounted-workspace.ts`: origin/account/workspace/mount-scoped file keys, Local-retaining server mount state, serialized opened-server cache, pending offline edits, both-version conflict preservation and stale-acknowledgement protection.
- `shared/mounted-transfer.ts`: explicit create-only adapter protocol, attachment-byte verification before conditional source removal, pending-edit refusal and fail-closed errors.
- 14 focused domain tests observed behavioral RED against deliberately unimplemented stubs, then GREEN. These are not Settings/sidebar/native transport acceptance tests.

The modules are NOT imported into the production UI/native adapters. Therefore the requested Settings login, simultaneous trees, full-editor switching and cross-mount transfers remain unimplemented. Cache serialization is tested in memory; durable platform persistence and network replay are not implemented. Transfer journaling and concrete atomic adapter implementations remain required. No product acceptance box is closed by domain tests alone.

Observed final-source verification:
- Spire `npm test`: 140 passed, zero failures.
- Spire existing Playwright regression suite: 115 passed. Does not exercise new unified mounts.
- `npx tsc --noEmit` and `npm run build`: passed; existing Rollup annotation/large-chunk warnings.
- Android `npm test`: 7 local-runtime tests, 6 download-adapter browser checks, mobile bundled editor harness passed (Chromium, NOT hardware/WebView acceptance).
- Buildbox `./gradlew test lint assembleDebug`: BUILD SUCCESSFUL; native XML reports show each variant executes AppActions 2, MainActivity 6, LocalFolder 2, ServerAddress 8 and FolderTransaction 8 tests with zero errors/failures.
- Windows Electron ZIP packaged; ZIP CRC verification passed, Spire.exe and resources/app.asar present. No Windows runtime acceptance performed.
- Android baseline APK re-signed and verified using canonical Mini SHA-256 certificate `096dc9323929255c3b3ff9f781a3c29a32f86a7c2d36016031deb6a2e7933af6`.

Artifacts are explicitly BASELINE, not unified-workspace releases; no Telegram delivery or hosted deployment performed. Protected phones/ADB were not accessed. No source push/public release. Evidence and baseline artifacts: `/home/spire/.hermes/artifacts/spire-unified-continuation/`.

Required remaining implementation: production mounted engine/identity migration and durable scoped caches; trusted native authenticated HTTPS transport; Settings connect/login/sign-out; dual labeled sidebar and same editor routing for every API/media/style/reference; opened-server-only offline caching and conflict UI/replay; attachment acquisition/reference integrity; journaled conditional bidirectional transfers with crash recovery, create-only destinations and source CAS; touch Move and desktop drag/drop; integrated Android/Electron tests; final-source rebuild, package/signature/hash validation; reviewed rollback-safe hosted release and live checks; exact accepted artifact delivery. Existing Android bootstrap forbids cross-origin fetch; Electron opens local and server as separate windows; the current single engine uses one relative `/api` endpoint and cache key. These integration boundaries have not been altered.
