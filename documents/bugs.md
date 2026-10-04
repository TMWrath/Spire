# Spire — Bugs

## Permanent deletion remained visible when invoked from the open trashed note

**State:** Resolved locally; not yet deployed to the private preview.

After a note was moved to Trash, using **Delete permanently** while that note remained open could complete the server purge while leaving the stale note visible in the browser cache and Trash list. Reopening the note from Trash before purging avoided the stale state. The client now removes the successfully purged note from its local snapshot, persists that state, clears the open editor, and synchronizes again. Browser coverage reproduces the exact open-note sequence and verifies that the note disappears immediately.
