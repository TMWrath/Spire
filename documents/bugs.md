# Spire — Bugs

## Sidebar remained open after clicking outside it

**State:** Resolved locally; production build and focused browser acceptance passed. Release acceptance: full browser suite passed 98/98 repeated checks (49 scenarios), unit/API suite passed 45/45, and production build/TypeScript passed. Deployment verification is recorded separately.

An open folder sidebar now closes on pointer-down outside the sidebar (including canvas and controls), while clicks within the sidebar and its toggle remain usable. Browser acceptance verifies outside dismissal.

## Empty folder deletion incorrectly offered file disposition

**State:** Resolved locally; unit/API and focused browser acceptance passed. Release acceptance: full browser suite passed 98/98 repeated checks (49 scenarios), unit/API suite passed 45/45, and production build/TypeScript passed. Deployment verification is recorded separately.

Empty folders now show only the ordinary folder confirmation. The server revalidates emptiness at deletion time, including nested folders, attachments, and styles, so concurrent additions are not silently removed. Populated folders retain their existing file disposition flow.

## File movement lacked animated drag-and-drop feedback

**State:** Resolved locally; focused browser acceptance passed. Release acceptance: full browser suite passed 98/98 repeated checks (49 scenarios), unit/API suite passed 45/45, and production build/TypeScript passed. Deployment verification is recorded separately.

File dragging now presents pickup/drag-ghost feedback, highlights and animates a valid folder target, then persists the move. Existing collision and server-side path validation remain in effect.
