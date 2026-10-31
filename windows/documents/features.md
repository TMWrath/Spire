# Spire Windows

## Native offline preview — implemented
WPF native Windows x64 application: create files under folders, edit Markdown source, save locally, rename via path, recoverable trash and restore. Atomic workspace persistence with previous-state backup. Local storage is isolated under LocalAppData/TM Wrath/Spire/offline-preview. This is not full Spire parity.

## Server compatibility adapter — implemented, not integrated
HTTPS-only cookie-session login, identity/CSRF retrieval, lossless snapshots, mutation requests and explicit HTTP 409 response handling. No credentials persisted. Adapter is not yet connected to UI or an automatic sync scheduler.

## Verification
.NET 10 build and Windows self-contained publish passed. Core regression harness passed restart round-trip, pending mutation preservation, previous-state backup, path validation and corrupt-state refusal. Windows runtime interaction not tested on target. Hosted source untouched.
