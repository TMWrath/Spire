## Server-origin identity return — Android verification

The Android client vendors Spire's origin-scoped identity and fail-closed explicit-transfer model. Local SAF files remain device-only unless the user deliberately moves them. Retained provenance identifies the original Server/account/workspace but never enables background upload.

Verification after the generated bundle was refreshed:
- Android local runtime/SAF tests: 23/23 passed;
- Chromium download-adapter checks: 6/6 passed;
- bundled shared editor acceptance passed, including offline save and recovery behavior;
- buildbox `./gradlew test lint assembleDebug`: BUILD SUCCESSFUL, 75 tasks;
- `vendor/provenance.json` was preserved byte-for-byte with SHA-256 `16f3378251a7c01096e114dd85cd278d7dc16e2452e814fc95954b000ae47ede`.

This is build and simulated-runtime evidence, not physical Android WebView/device acceptance. No APK was copied, signed, installed or delivered, and no deployment was performed.
