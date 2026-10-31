# Spire for Android — 0.2.0

Android client with **local-folder or HTTPS-server workspaces**, following the Windows client's model. Local mode bundles the canonical Spire frontend and Store rather than implementing a reduced editor. Android WebView renders the shared interface; native Java implements Storage Access Framework access, permissions, durable transaction journals, file pickers, downloads and printing. It is not a wholly Kotlin/native-widget rewrite.

## Use

Install the signed APK **over the existing Spire app**. Package identity and existing server preferences, cookies and cached writing are retained; do not uninstall or clear app data.

- First launch offers **Open local folder** or **Connect** to your HTTPS Docker-hosted Spire server.
- Existing installations reopen the previous server. Use **Settings → Android app → Server connection → Change workspace** to reach the chooser.
- **Open local folder** uses Android's folder picker. Grant read/write access. **Reopen local folder** and relaunch retain the selected URI permission.
- Local folders edit actual Markdown, styles and attachment bytes. `.spire-android/state.json` retains IDs, revision history, templates, sources and other Spire metadata.
- Each folder receives its own synthetic HTTPS origin, separating IndexedDB drafts and UI preferences from other folders and servers.
- Local and server workspaces **do not automatically synchronize**. No local files are uploaded when switching to a server.
- Wait for saving to finish before switching workspaces or reloading.

## Shared editor

The packaged frontend is the canonical Spire build, including Editor / Source / Split, compact Quick formats Help, formatting, templates, source library, media controls, maps, file/folder operations and settings. The local API adapter delegates document operations, revisions, conflicts, templates, attachments, folder operations and portable import/export to a vendored copy of the canonical Store and archive code.

Server mode retains the existing hosted UI and authenticated server API, so it remains available as the fallback. It requires a trusted HTTPS root origin; Docker deployments behind HTTPS reverse proxies are supported. Cleartext HTTP, invalid certificates and subpath installations remain rejected.

## Storage safeguards and limits

- SAF grants only: no all-files permission, direct filesystem access from JavaScript, or remote-page filesystem bridge.
- Local bridge restricted to the selected synthetic origin and main frame; stale WebView callbacks rejected. Native local asset interception and CSP prevent local code from making remote requests.
- Save checks compare provider contents against the expected previous tree before writing. A private `AtomicFile` journal retains both versions until every write and final readback succeeds.
- Interrupted transactions can replay when provider contents match the old/new versions. Unexpected edits or partial provider writes fail closed and retain the journal for manual recovery. SAF providers cannot promise cross-app compare-and-swap or multi-file atomicity; avoid concurrent external editing.
- An external change to a tracked file can block reopening rather than being silently overwritten. Keep the metadata directory with the workspace. Do not delete metadata as a conflict-resolution shortcut.
- Provider enumeration failures are errors, not empty directories. Unknown/hidden files are not recursively deleted.
- Revoked grants or startup errors show a recovery page with **Workspaces** access. Queued editor drafts are retained in origin-specific IndexedDB. Unsaved text not yet queued is not guaranteed after abrupt process death.
- Local workspace limit: **32 MiB including metadata/history**, 10,000 entries, maximum folder depth 40. Canonical per-file limits also apply: Markdown 1,000,000 characters, attachments 10 MB. Downloads are limited to 32 MiB.
- Online video lookup/proxy services require a **server workspace**. Local media selection/capture remains in the bundled interface, subject to WebView codecs and device testing. Screen/tab capture is not promised on Android.
- This is a build-verified release candidate, **not an assertion of complete device-level Windows parity**. See verification below.

## Build

```sh
npm ci
npm run bundle
npm test
```

`npm test` rebuilds the local runtime, runs Node API/storage checks, the download adapter checks, and an actual bundled-editor Chromium journey using a mock native message transport. This is not an Android DocumentsProvider test.

To refresh canonical source/assets deliberately, first build the canonical Spire repository, then:

```sh
SPIRE_SOURCE=/workspace/spire npm run bundle
```

The normal build is self-contained: `vendor/` stores canonical Store/shared sources and `app/src/main/assets/web/` stores the frontend snapshot. `vendor/provenance.json` records source asset hashes; Android's index wrapper and generated `local.js` are intentional additions. `local/runtime.mjs` is generated for Node tests.

Sync to `hermes-buildbox-1` excluding `.git`, `.gradle`, `build`, `local.properties`, `node_modules` and `artifacts`, then run:

```sh
ANDROID_HOME=/opt/android-sdk ./gradlew test lint assembleDebug
```

Re-sign the APK locally with the canonical local build host debug certificate, not the buildbox default. Verify final package/version, signature, SHA-256 and bundled asset parity before delivery. Never copy signing keys to buildbox.

## Verification for 0.2.0

- Android `test lint assembleDebug`: **passed**. 22 Java/Robolectric tests per debug/release variant, zero failures; lint has warnings but no errors.
- Node local-runtime checks: **4 passed** (real-file indexing and reopen, failure acknowledgement safety, traversal/conflicts/archive).
- Download-adapter Chromium checks: **6 passed**.
- Bundled-editor Chromium journey: **passed** for source/visual/split, all ten Help rows, quick-format output, durable saves/reloads, viewport rotation, disconnected saving, failed-save queued draft recovery, and unavailable-folder recovery UI.
- Server-preservation, HTTPS normalization and bridge restrictions covered by the existing Java tests. No authenticated production mutation was performed.
- **Physical device / Android WebView / real SAF provider / IME / microphone / PDF / process-kill acceptance remain unverified.** Emulator installation was attempted but the buildbox lacked disk space; the newly installed emulator was removed afterward. No changes were made to the project owner's phone.
- No production Docker deployment or Windows changes were needed: shared editor behavior is reused, not changed by this Android adapter.

See `documents/build-verification.json` for final APK metadata and source digest.
