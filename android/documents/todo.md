# Todo

- Physical-device acceptance covering login, editing, keyboard, downloads, microphone and PDF.
- Larger streaming exports and in-flight picker recovery.
- Server-authoritative editing and leases are separate hosted-server work.

## Android local-folder and server client replacement — requested

the project owner requests replacing the hosted-only Android shell with a 1:1 Spire client matching the current Electron Windows client's local-folder and remote-server choices. Status: implemented and build-verified in 0.2.0 (versionCode 4); signed APK produced. Physical-device/real-SAF/IME acceptance remains pending. See README.md and documents/build-verification.json for exact scope and limits.

Acceptance:
- Reuse the canonical Spire editor/interface and complete feature surface, including the latest compact Help; no reduced native editor.
- Bundle the interface so local workspaces launch with no network/server dependency.
- Open a user-selected Android folder via the Storage Access Framework with persistable permission; work with actual portable Markdown and attachments, not just an imported browser cache.
- Support local create/edit/save/reopen, folder operations, attachments, templates, metadata, history/recovery and external-change protection; preserve ordinary files and existing contents.
- Preserve HTTPS server connection, authentication, existing cached writing and per-origin isolation; connect to the existing Docker-hosted server.
- Local-folder and server workspaces are separate choices, matching current Electron behavior. Automatic bidirectional folder/server mirroring is not implied or silently enabled.
- Preserve package identity and upgrade data. Do not clear old WebView cookies/storage or uninstall the existing app.
- Narrow origin/main-frame-only native bridges; remote pages must never gain local-folder access. Handle revoked grants, process death, rotation, interrupted writes, switching workspaces and unavailable server explicitly.
- Verify source parity, automated tests, Android lint/build, canonical Mini debug signing and exact APK delivery. Device verification must be separately reported.

Architecture discovery: current Android is a Java WebView host loading remote UI. Current Electron client bundles the same frontend and uses the canonical Node/Express server/store against a selected local folder. Android SAF URI storage is not a normal filesystem path; select and verify an adapter/runtime architecture before claiming parity. The older Spire Windows Vault note describes a WPF preview and is not the current Electron implementation.

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

Supersedes the earlier separate-choice-only UI contract, not the prohibition on implicit uploads. Automated Android browser/SAF acceptance and buildbox test/lint/assemble are complete; physical Android WebView/device acceptance remains pending.
# Server-origin identity return
- [x] Vendor the stable origin/identity and fail-closed transfer model from canonical Spire.
- [x] Preserve Local-only storage unless the user explicitly moves a file.
- [x] Preserve attachments/styles and reject changed, deleted or colliding destination identities.
- [x] Rebuild bundled web assets and run Android runtime/browser regression plus buildbox test/lint/assemble.
- [ ] Perform physical Android WebView/device acceptance when an unlocked authorized device is available.
