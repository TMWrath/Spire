# Local startup fix verification

- Full bundled editor initializes independently of SAF enumeration.
- Local identity initialization bypasses server sign-in without dropping cached drafts; canonical client sync.ts handles local initialization.
- Bundled asset requests do not contend for the SAF transaction monitor.
- Binary attachments indexed as opaque metadata references; read lazily. Native transaction checks preserve references, reject unsafe overwrite/removal, retain recovery journals.
- Seven local runtime tests passed; six download adapter checks passed; bundled editor delayed-load, source/editor/split, Help, save/reopen, offline save and failed-save recovery browser journey passed.
- Buildbox test (debug and release), lint and assembleDebug passed.
- Signed artifact: artifacts/Spire-local-startup-fixed.apk
- SHA-256: eba5acef028bc885448b95273c1c1894e44e4aeb12a2cd2b2bdf5bf9529732c8
- Signing certificate SHA-256: 096dc9323929255c3b3ff9f781a3c29a32f86a7c2d36016031deb6a2e7933af6
- Installed with adb install -r over existing com.tmwrath.spire, no uninstall/data clear or selected-folder change.
- Pixel hardware: existing Documents selection indexed successfully, Synchronized, 296 files and 52 attachments. Source and Split preview visible; Help dialog visible. Reload completed and returned to Synchronized using persisted folder grant. Existing content was not edited for this check.
- Hardware saving/failed-save recovery, attachment download, physical IME and rotation not exercised in this verification; saving/recovery covered by automated browser/native tests, not claimed as hardware acceptance.
- Hosted/Windows distribution not changed: local identity capability is inactive absent Android bootstrap global. Shared canonical source changed; hosted/Windows packaging propagation not verified in this task.
