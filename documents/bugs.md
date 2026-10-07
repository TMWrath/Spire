# Spire — Bugs

## Spherical-map release browser regressions

Resolved: mobile focus/history tests used the obsolete Create note selector; the touch-map test requested the authenticated snapshot before setup completed. Updated selectors to Create file and awaited the authenticated Settings control without weakening behavioral assertions. Final production build and all 43 unit/API and 38 browser tests pass, including touch orbit/pinch/twist/cancel, mobile selection/focus, and revision comparisons. Deployment pending verification.

## Table editor header overlapped its size controls on mobile

**State:** Resolved and deployed to the private preview from source commit `d7eaca2`; the container is healthy and the live stylesheet contains the content-driven table-dialog header fix.

At narrow mobile widths, the table editor header inherited the application's fixed `58px` mobile header height. Its instruction text overflowed that fixed box, so the Rows and Columns controls rendered over the sentence. The table dialog header now explicitly uses content-driven height, and browser coverage verifies that the size controls begin below the complete instruction text at a 390px mobile viewport.

## Permanent deletion remained visible when invoked from the open trashed note

**State:** Resolved locally; not yet deployed to the private preview.

After a note was moved to Trash, using **Delete permanently** while that note remained open could complete the server purge while leaving the stale note visible in the browser cache and Trash list. Reopening the note from Trash before purging avoided the stale state. The client now removes the successfully purged note from its local snapshot, persists that state, clears the open editor, and synchronizes again. Browser coverage reproduces the exact open-note sequence and verifies that the note disappears immediately.
