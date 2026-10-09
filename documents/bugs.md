# Spire — Bugs

## Drag acceptance read stale coordinates after folder creation

**State:** Test synchronization corrected and verified locally. The source row was measured before the asynchronous folder insertion shifted the tree; pointer-down then hit a folder summary and its long-press deletion safeguard legitimately appeared. The test now waits for the new folder target and Playwright-stable source hover before measuring. Existing ghost, drag-source, hover transform, successful drop and destination-path assertions remain unchanged. Reproduced failure before correction; focused regression passed afterward and the final full suite passed 80/80. No product drag implementation or deletion safeguard was weakened. No deployment performed.

## Newly recorded audio did not play immediately in Editor

**State:** Reproduced and resolved locally; production build, 45/45 unit/API tests, and 3/3 focused recording tests pass. Full repeated browser verification and deployment are tracked separately.

Recording inserts a preserved HTML audio block before the synchronized attachment list includes the uploaded recording. The node view previously rendered only once, leaving its portable relative URL unresolved even after synchronization. Preserved node views now refresh when attachment metadata or the file path changes, replacing their rendered DOM only when the sanitized HTML changes. The Markdown source remains portable and unchanged.

The regression now requires the freshly inserted rich-editor audio to resolve through the authenticated attachment endpoint, successfully execute `play()`, and advance `currentTime`. Before the fix it failed on the unresolved relative URL; after the fix actual playback passes. Tests use real MediaRecorder bytes from a generated audio stream, not a physical microphone. Native Android microphone permission and real-device capture remain unverified.

## Sidebar remained open after clicking outside it

**State:** Resolved locally; production build and focused browser acceptance passed. Release acceptance: full browser suite passed 98/98 repeated checks (49 scenarios), unit/API suite passed 45/45, and production build/TypeScript passed. Deployment verification is recorded separately.

An open folder sidebar now closes on pointer-down outside the sidebar (including canvas and controls), while clicks within the sidebar and its toggle remain usable. Browser acceptance verifies outside dismissal.

## Empty folder deletion incorrectly offered file disposition

**State:** Resolved locally; unit/API and focused browser acceptance passed. Release acceptance: full browser suite passed 98/98 repeated checks (49 scenarios), unit/API suite passed 45/45, and production build/TypeScript passed. Deployment verification is recorded separately.

Empty folders now show only the ordinary folder confirmation. The server revalidates emptiness at deletion time, including nested folders, attachments, and styles, so concurrent additions are not silently removed. Populated folders retain their existing file disposition flow.

## File movement lacked animated drag-and-drop feedback

**State:** Resolved locally; focused browser acceptance passed. Release acceptance: full browser suite passed 98/98 repeated checks (49 scenarios), unit/API suite passed 45/45, and production build/TypeScript passed. Deployment verification is recorded separately.

File dragging now presents pickup/drag-ghost feedback, highlights and animates a valid folder target, then persists the move. Existing collision and server-side path validation remain in effect.


## Existing temporal repeated-insertion regression
Full browser verification during Blocks work still fails `combined temporal gallery inserts formatted manual plain text`: resetting the source between manual insertions can retain previous insertion/selection state. Blocks acceptance passes independently. This date/time defect remains unresolved; the full suite is not green.
