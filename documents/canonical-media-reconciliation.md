# Canonical media reconciliation

The canonical `master` tree merges the complete `canonical-combined` checkpoint (media gallery, custom video player, attachment byte-range streaming, publication media isolation/transfers and file sync controls) with the compact audio work previously committed on master.

- `client/AudioTrack.tsx` and `client/compact-audio.css` retain the compact horizontal audio player, double border, seek/time/transport/mute/options controls and mobile sizing.
- MediaGallery and the editor/split-preview enhancement use this same AudioTrack component. The older standalone audio enhancer is historical, not used by these runtime surfaces.
- Editor media enhancement mounts both audio and custom video controls while retaining source Markdown.
- Canonical MediaGallery remains responsible for folder/file image and video previews; its modal uses the custom video player.
- Both frontend and backend source must be deployed together, not a frontend overlay on the old names backend.
- Production data stays in `spire-preview_spire_data`; use an isolated disposable candidate volume, stopped-writer backup, immutable release and explicit Compose project.

Validation before release: production TypeScript/build passed; all 315 unit/API tests passed; 12 focused media/video browser cases passed. Combined audio/video assertions were added to the file-media case; the full browser run is tracked separately and must not be described as green without checking its final result.

No source push authorized for this reconciliation. Android offline bundle/rebuild and physical-device acceptance are separate and not part of this hosted deployment.
