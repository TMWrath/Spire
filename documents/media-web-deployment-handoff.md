# Spire media web deployment

## Current canonical hosted release

- Live release/image: `canonical-d31b007` / `spire-preview:canonical-d31b007`.
- Exact deployed code revision: `d31b00766384742c2b2708bebd955b77f015d84b` on local `master`; no source push was authorized or performed.
- Full canonical frontend and backend deployed together, including media gallery, custom video player, publication/attachment sync, byte-range streaming, and today's compact shared audio player in editor, split preview, and gallery.
- All 315 unit/API tests and production build passed. Twelve focused media/video browser cases passed; the final five-case run additionally verified the combined editor/gallery audio and custom video integration.
- Broad browser run was stopped after three template tests timed out on the obsolete `Select a file in the map` selector. Full browser regression is NOT green.
- Isolated candidate passed complete image/frontend hash parity, authenticated upload/read, byte-range, and workspace-field API checks.
- Stopped-writer backup, gzip/tar integrity check, and rollback image retained at `/srv/spire/releases/canonical-d31b007/backup/data.tar.gz`.
- Production volume remains `spire-preview_spire_data`; bind remains loopback-only `127.0.0.1:4173`. Final health check passed, restart count was zero, and both release pointers resolve to this release.
- All public distribution files were verified byte-for-byte against the release manifest after cutover. Manifest and candidate/live verification records are stored in the release directory.
- Offline Android bundle/APK and physical-device acceptance are not updated or claimed by this hosted release.

## Historical frontend-only release

Hosted frontend deployed as `spire-preview:media-0318` on self-hosted server. This is a scoped frontend-only image derived from incumbent `spire-preview:names-0316`; the existing backend and production volume were preserved. It is not a clean canonical combined release.

- Release: `/srv/spire/releases/media-0318`.
- Previous release: `names-0316`; retained for rollback.
- Stopped-writer backup: `/srv/spire/backups/media-0318-before.tar.gz`; tar integrity checked before cutover.
- Both current and active-release pointers updated.
- Fresh production build and focused file-media browser test passed.
- Candidate health passed before production cutover. HTTPS health passed afterward; live entry JS SHA-256 equals the local candidate and includes media gallery marker.
- Broader browser suite remains non-green (earlier run exited 1). Do not claim full regression success.
- No new APK delivered by this deployment. Offline Android bundle and physical-device behavior remain separate pending work.
- Frontend SHA-256 inventory and working-tree provenance stored in release `frontend-manifest.json`.
- Nos development is paused; see `../Nos/Resume notes.md`, particularly the project owner's URL-based pull direction.
