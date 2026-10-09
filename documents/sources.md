# Sources and portable citations

## Deployment

Live at https://spire.example as `sources-169917a` (code revision `169917a`). Candidate and live HTML/entry JS/CSS match the tested production build. Health passes; fresh anonymous browser sign-in has no page errors; private snapshot rejects anonymous requests. Original read/write named volume and loopback-only binding retained. Verified application backup and full-volume archive with checksums are at `/srv/spire/backups/sources-169917a-20261009T214337Z`. Pinned prior image and rollback configuration retained; no rollback drill, authenticated production edit, physical Android test or repository push was performed.

Sources is a reusable sidebar library for books, websites, images, audio, video, documents and other references. Records include author/creator, title, publication year, edition, publisher, ISBN, URL, access date, description and optional attached media. Existing source edits use revision checks; stale edits reject rather than overwrite another device.

Use Sources → Add source to create a record. In a writing file, the Sources toolbar button opens an explicit citation picker with page/timestamp/section and optional quotation. Browsing the library does not insert or rewrite writing. Source details list individual citation locations and jump to the corresponding Markdown selection. Rendered citation links open the source record.

Citations are ordinary Markdown links and blockquotes with human-readable attribution and locator. Source edits never regenerate historical citation wording. Relative source links rebase when writing files move. Code examples do not become citation relationships. Cited sources cannot be deleted while active or restorable Trash files reference them.

The Sources map derives source-to-file edges from citations. Repeated citations remain separate location backlinks but share one graph edge. Uncited sources remain visible. Shared-source relationships are visible through the common source node; they are not stored as inferred file-to-file citations.

Reliquary ZIP exports include readable `Sources/<id>.md` source records, versioned `Sources/library.json` metadata and normal attached media. Import restores stable source identities, validates records and attachment presence, and rejects identity/path collisions or malformed archives without applying partial state. Source metadata also survives authoritative snapshots, cached snapshots, restart and application backup/restore. Generated source records are export representations; canonical metadata is in application state.

Acceptance before deployment: configured TypeScript/production build, 91 unit/API tests and 96 browser tests passed. Focused desktop/touch Sources checks passed. One existing rich-editor bookmark cursor setup assertion failed on a full run; focused recheck and repeat full suite passed without changing bookmark behavior, so it is recorded as non-reproduced, not fixed. Physical Android WebView acceptance and authenticated production editing remain unverified. No native APK change is required for hosted UI delivery.
