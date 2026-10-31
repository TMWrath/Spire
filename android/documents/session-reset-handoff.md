# Session-reset handoff

## Current request
the project owner requested committing and pushing all accumulated Spire work so the conversation can be reset. This checkpoint is not a claim that physical performance diagnosis is complete. No server deployment is part of this checkpoint.

## Preserved work
- Web: tree gestures, rename/move handling, navigation/save safeguards, manual Android Local save UI, operation-specific statuses, incremental local deltas and regression tests.
- Android: direct affected-path filesystem operations, staged/verified writes, optimized SAF directory lookup, manual Local storage/runtime integration, recovery-preservation safeguards and regression tests; version 0.2.19 / versionCode 23.
- Earlier unpushed commits on the current branches are included in the push.

## Evidence and unfinished work
Earlier session reports describe successful web/native/build checks and APK installation; those test totals were not rerun or independently reconfirmed during this checkpoint. Physical create/delete/move timings remain unverified. Do not claim the slowness is solved. Investigate full memory dump/state serialization and native validation/provider calls if the project owner resumes profiling.

Earlier session connection: Pixel at 100.85.221.102:5555, package com.tmwrath.spire; CDP forwarded at local 9229. These are historical endpoints and must be rediscovered before reuse. No disposable phone tests were completed in the visible resumed portion of the session.

## Preservation boundaries
Do not clear app data, uninstall, reset the selected Documents/Wrath Vault directory, replay old journals, or alter existing writing (including unsaved `hey`). Preserve backups, recovery data, queued changes, and /home/spire/.hermes/artifacts/spire-local-recovery/pixel-journal-diagnostic.tar. Existing `test file99 - Archive` is not a disposable test item. Use only newly created disposable items if renewed testing is requested.

## Local artifacts (not source commits)
/tmp/Spire-0.2.19.apk and /tmp/Spire-0.2.19-verification.txt were reported as release artifacts. /tmp/spire-phone-cdp.py and /tmp/spire-phone-before.log were reported as diagnostic aids. /tmp/spire-phone-instrument.js was written but not executed in the visible resumed exchange. These temporary paths are not durable publication or fresh verification evidence.

## Next session
Read this file, inspect both repositories and current user intent, then resume only the work the project owner requests. Do not automatically resume device testing from this handoff.
