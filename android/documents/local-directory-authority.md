# Local directory authority

Implemented per the project owner's approved discussion: Local reads the selected directory; private metadata is an index/history, not a competing authoritative workspace.

- Readable external Markdown changes become active content without timestamp arbitration or an opening-time save. The former cached revision is preserved in history; the active revision advances so stale editor writes conflict.
- Missing files/folders/styles/attachments are absent from the active view without synthetic mismatch/missing warnings when the scan reports no applicable provider failure. Cached records remain available for optional explicit recovery, not implicit restoration.
- Provider warnings remain active and continue blocking unsafe export/recovery/writes. Native durable transaction validation and recovery are unchanged.
- Subsequent acknowledged writes retain external content plus cached history in metadata; reopening alone does not rewrite the directory.
- Server synchronization behavior is unchanged. No phone access, installation, commit, or push performed for this slice.

Verification:
- Established behavioral RED: external edit was absent from the active snapshot (1 file instead of 2).
- 23/23 Local, availability, recovery, and directory-authority tests passed.
- 6/6 Chromium download-adapter checks and bundled editor browser scenario passed. These are not Android WebView/device acceptance.
- Android lintDebug and assembleDebug passed using ANDROID_HOME=/home/spire/Android/Sdk.
- Android testDebugUnitTest: 33 executed, 23 failed in Robolectric native runtime loading / UnsatisfiedLinkError on this ARM host. This gate is NOT green; rerun on a compatible test host before release.
- git diff --check passed before final documentation update.

Existing Activity log entries are historical and are not erased by this change. A real-device acceptance pass is still required; no update has been installed on the project owner's phone.
