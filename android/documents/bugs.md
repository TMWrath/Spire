# Bugs

## Resolved — Local revision history compared edits against the original file

Android Local manual commits discarded the revision appended by `Store.revise`, so later saves retained only the initial imported snapshot. The Changes view therefore marked all previously written lines as newly added instead of showing only the latest edit. Version 0.2.80 preserves each prior saved revision in the immutable note bucket; regressions verify two consecutive edits reopen with ordered history `Initial → first edit → current`.

No known failing automated checks at handoff. Physical Android/WebView acceptance remains unverified.
# Rich-editor trailing spaces and stale revision selection

- Fixed the visual editor removing meaningful trailing spaces when serializing Markdown.
- Revision history now follows the newest saved revision instead of remaining on a stale selection after Save.
