# Dictionary links — proposed design, not implementation approval

Goal: portable Markdown term definitions with mobile tap and desktop hover previews.

Confirmed direction: selected text gets a Link to term button; popup offers dictionary and searchable term dropdowns. Preserve selected display text. Dictionary template marks files with optional YAML frontmatter `spire_type: dictionary`; each level-two heading defines a term and subsequent content until next same/higher heading defines its entry. Standard relative file/heading Markdown links remain underlying representation. Marker enables discovery, not a dependency for reading exported content.

Proposed steps: inspect existing editor selection, linking, Markdown rendering, templates and file path/export behavior; resolve selection retention and anchor generation; implement dictionary template/discovery/parser; implement accessible picker and link insertion; implement desktop hover/focus and mobile tap preview with explicit open-definition action; handle missing targets, duplicate headings, move/rename updates, escaping and safe rendering. No automatic linking of every matching word.

Likely inspection targets: client/main.tsx, client/PropertiesPanel.tsx, shared/full-templates.ts and existing editor/renderer and template tests (exact integration files require repository inspection).

Validation: parser boundaries, duplicate anchors, relative paths and export round-trip; selection retention; desktop hover and keyboard focus; touch tap without accidental navigation; missing/deleted targets; mobile preview dismissal; persisted links after reload; no unrelated editor regressions. Verify hosted UI and Android separately before claiming acceptance.

Open design points: marker name provisional; entry structure and preview truncation; link repair/export mapping require inspection rather than assumptions about existing support.
