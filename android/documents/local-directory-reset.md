# Local directory reset — active implementation

User scope: rebuild Android Local directory opening/editing/manual saving, creation, file-to-folder moves and nested folder moves. Disable Local server integration, autosave and automatic backup/recovery workflows. Existing files, saved metadata, private journals and browser drafts must not be erased or automatically replayed. Hosted server behavior is outside this reset; no deployment or device access authorized by this task.

Architecture: explicit synchronous-to-caller Local commands, no durable mutation outbox or background replay. Directory bytes are authoritative. Native commits operate only on affected paths rather than taking whole-vault verification snapshots. Save acknowledgement requires provider readback. Legacy journals remain untouched and disconnected from startup. Keep unsaved-navigation confirmation, collision checks, path validation and source-before-delete ordering.

Acceptance: open/edit/manual save/reopen; file creation; folder creation; file move; nested folder move; collisions and descendant moves refused; failed writes retain editor text and report failure; no autosave even with a legacy enabled preference; no remote mount restoration; no journal generation/replay; no unrelated-file reads during a one-file operation. Verify source/runtime/native/browser separately. Physical device not yet verified.
