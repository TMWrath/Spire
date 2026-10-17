# Workspace loading and per-file saving — in progress

the project owner authorized simpler selected-directory workspace loading, remembered per-file autosave, an idle delay, and save/discard/cancel protection when leaving unsaved work. Aphelion proposed the initial two-second idle delay and cached index strategy; the project owner approved implementation.

Acceptance: reuse indexed workspace on reopening; do not rescan on routine focus changes; manual refresh discovers external changes; retain external-change validation on writes. Autosave toggles apply per file and workspace/device, default on. Edits reset the two-second timer. Save failure must retain edits and prevent navigation. Save/discard/cancel applies to file/home/mount navigation; browser termination retains the native warning fallback. No personal data, recovery journals or app installation may be changed during implementation.

Source and artifact verification pending. No completion or physical-device acceptance claimed.
