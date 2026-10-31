# Unavailable local items — Android 0.2.2

## Cause and behavior
The persisted index referenced a Markdown file missing from the mounted snapshot. Previously the Store verification rejected the entire local workspace. Whether the original file was moved, deleted or omitted by the provider is not established.

Unavailable indexed files, folders, styles and attachments are excluded from the active local view while their original metadata/content/history remain on disk. Healthy files remain editable. Native enumeration skips missing or permission-denied user children and continues readable siblings. Unavailable root grants and private recovery metadata remain fail-closed. Missing items are not deleted or silently recreated; transfers/exports containing skipped items are blocked.

The shared renderer provides a dismissible, non-modal notice and Settings → Activity log (latest 200 entries, device-local). Dismissal does not clear the log. Restoring access and reopening retries the item. No implicit Local → Server upload was added.

## Verification
- Missing-index reproduction was RED before the fix, GREEN afterward; healthy edit/save, retained recovery metadata, blocked path recreation, blocked incomplete exports/transfers and reopen after restoration passed.
- Existing local-runtime tests passed.
- 1280px and 390px browser notice/log tests passed, including dismissal, reload persistence and no page overflow.
- Root unit suite, unified-workspace browser acceptance and Android browser command exited 0 in the prior verification run.
- Final buildbox `test lint assembleDebug` exited 0 after re-syncing final source; BUILD SUCCESSFUL.
- Signed with canonical Mini debug certificate SHA-256: `096dc9323929255c3b3ff9f781a3c29a32f86a7c2d36016031deb6a2e7933af6`.
- Artifact: `/home/spire/.hermes/artifacts/spire-availability-final/spire-0.2.2.apk`.
- APK SHA-256: `cc8b9950e4ce7e586277c17a58bd926e7d9b1b523ad256573324db9d4d644e41`.
- Installed using `adb install -r` on Pixel 10 Pro Fold. Package `com.tmwrath.spire`, version 0.2.2 / code 6 verified after upgrade from 0.2.1 / code 5. No uninstall or app-data reset.
- Launch intent succeeded. Actual on-device folder/notice/Settings acceptance blocked by locked phone (`isKeyguardShowing=true`, screen asleep). This is not visual or physical SAF acceptance.
- Hosted/Windows rollout and their equivalent local-loader behavior are not verified by this Android installation. Earlier broad browser regression status is not superseded by focused acceptance.
