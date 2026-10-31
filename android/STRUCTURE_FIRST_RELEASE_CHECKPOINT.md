# Spire 0.2.91 — structure-first release checkpoint

## Source and scope
- Web source: `/home/spire/Projects/spire`.
- Android source: `/home/spire/spire-whistle-release/android`.
- Android versionName 0.2.91, versionCode 93; package com.tmwrath.spire.
- Resumed native failures were obsolete eager-body startup expectations and an invalid state fixture missing the file path. Native tests now assert opaque startup references, zero startup body reads, explicit-open bounded retries/current provider bytes, exact legacy journal preservation, and save performance from an explicitly opened baseline. No production safety checks or test cases were disabled.

## Collected gates
- Prior collected web unit/API suite: 247 passed; production build passed.
- Prior collected Android runtime suite: 54 passed; Chromium adapter checks: 6 passed.
- Fresh authoritative buildbox `test lint assembleDebug`: BUILD SUCCESSFUL, exit 0.
- Debug native tests: 82, failures 0, errors 0, skipped 0.
- Release native tests: 82, failures 0, errors 0, skipped 0.
- Remote: `/mnt/hermes_forgejo_data/spire-builds/spire-0.2.91-structure`.
- Remote successful log: `verification-rerun.log`; earlier failing `verification.log` is superseded, retained as evidence.
- Final APK: `/home/spire/spire-whistle-release/android/artifacts/Spire-0.2.91.apk`.
- Size: 84669240 bytes.
- SHA-256: b25c5be471ab160948e0ef3582d13b597efd7a5bed184d9ed1561b11a623714d.
- Canonical signer SHA-256: 096dc9323929255c3b3ff9f781a3c29a32f86a7c2d36016031deb6a2e7933af6; matches 0.2.90; v2/v3 verified.
- Full packaged asset inventory and bytes: 176 assets, zero missing/extra/changed.

## Delivery and physical acceptance
- MTProto upload completed with exit 0. Telegram attachment message 88333 was read back with document size 84669240 bytes, matching the final signed APK. Script: `/tmp/send_spire_0291.py`.
- ADB rediscovered/reconnected. Installed app is still 0.2.90/code 92.
- Phone is dozing; WebView/CDP unsaved-state query timed out. Do not terminate its process/install/reload without establishing writing is safe. No data cleared, no user documents edited, no installation performed in this resumed run.
- Physical populated-workspace structure-first startup, single-file open, history/recovery/style/save/sync acceptance remain unverified for 0.2.91.
- The earlier full-browser template-selector timeout remains separate and unresolved; unit/API and Gradle success do not prove that wider browser suite green.
- No hosted deployment or source push performed by this resumed release task.
