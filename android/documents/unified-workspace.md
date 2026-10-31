# Spire unified workspace

## Unified Local + Server workspace — requested, not implemented

the project owner requires server sign-in to remain discoverable in Settings after opening a local folder, without replacing that folder. One sidebar contains separate Local and Server trees, with one editor and cross-storage file movement. Windows (current Electron implementation in /workspace/spire/desktop, not the historical WPF preview) must match Android.

Required acceptance:
- Settings offers HTTPS server connection/sign-in while retaining the selected local folder.
- Connected workspace displays Local and Server simultaneously, clearly labeled; same filenames in different mounts remain independent.
- Users explicitly move files in both directions using a unified filesystem interaction; provide a touch-accessible Move action as well as desktop drag/drop.
- Local data is never implicitly uploaded or mirrored; disconnect/sign-out does not remove local files or revoke the selected local folder.
- Preserve the full canonical editor, local offline operation and persisted workspace configuration.
- Verify Android and Windows parity; do not claim an updated build or live deployment from planning alone.

Aphelion safety recommendations:
- Destination write and verification precede source removal; interruption retains recoverable transfer state.
- Conflicts never silently overwrite; pending source edits and concurrent external edits are protected.
- Transfer linked attachments deliberately and preserve relative references; never move opaque references without acquiring and verifying their actual bytes.
- Preserve origin-scoped credentials and limit local-folder privileges to the trusted bundled client; remote pages gain no direct SAF/filesystem bridge.

the project owner selected: cache previously opened Server files for offline editing, then synchronize queued edits back with conflict protection. Local files remain independently offline-capable. Server caches do not turn local-folder files into server files, and whole-server replication is not implied. Conflicts must preserve both versions rather than silently overwriting either.

Supersedes the earlier separate-choice-only UI contract, not the prohibition on implicit uploads. Implementation, tests, builds and deployment are pending.

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
