# Credits and third-party software

Spire is built with open-source software. This file identifies the third-party projects used directly by the application and its development toolchain.

The links below lead to the projects' official source repositories or home pages. Each project remains subject to its own license. Spire's complete resolved npm dependency graph, including transitive packages and exact installed versions, is recorded in [`package-lock.json`](package-lock.json).

## Bundled speech components

- [Whistle speech-to-text model](https://huggingface.co/Cactus-Compute/whistle) — Apache License 2.0. Spire bundles the model for local transcription.
- [Cactus Needle](https://github.com/cactus-compute/needle) — Apache License 2.0. Runtime used to execute Whistle locally.

Copies of the speech-component license texts are included with the prepared voice assets and served from Spire's About and voice-authoring interfaces.

## Application libraries

### Editing and interface

- [Tiptap](https://github.com/ueberdosis/tiptap) (`@tiptap/extension-list`, `@tiptap/extension-underline`, `@tiptap/markdown`, `@tiptap/react`, and `@tiptap/starter-kit`) — MIT License.
- [React](https://github.com/facebook/react) (`react` and `react-dom`) — MIT License.
- [Lucide](https://github.com/lucide-icons/lucide) (`lucide-react`) — ISC License.
- [Marked](https://github.com/markedjs/marked) — MIT License.
- [highlight.js](https://github.com/highlightjs/highlight.js) — BSD 3-Clause License.
- [KaTeX](https://github.com/KaTeX/KaTeX) — MIT License.
- [Mermaid](https://github.com/mermaid-js/mermaid) — MIT License.

### Documents, media, and data

- [Mammoth](https://github.com/mwilliamson/mammoth.js) — BSD 2-Clause License.
- [PDF.js](https://github.com/mozilla/pdf.js) (`pdfjs-dist`) — Apache License 2.0.
- [fflate](https://github.com/101arrowz/fflate) — MIT License.
- [idb](https://github.com/jakearchibald/idb) — ISC License.
- [jsdiff](https://github.com/kpdecker/jsdiff) (`diff`) — BSD 3-Clause License.
- [YAML](https://github.com/eemeli/yaml) — ISC License.

### Server, validation, and security

- [Express](https://github.com/expressjs/express) — MIT License.
- [cookie-parser](https://github.com/expressjs/cookie-parser) — MIT License.
- [express-rate-limit](https://github.com/express-rate-limit/express-rate-limit) — MIT License.
- [Helmet](https://github.com/helmetjs/helmet) — MIT License.
- [DOMPurify](https://github.com/cure53/DOMPurify) — Mozilla Public License 2.0 or Apache License 2.0.
- [sanitize-html](https://github.com/apostrophecms/sanitize-html) — MIT License.
- [Zod](https://github.com/colinhacks/zod) — MIT License.
- [Noble Hashes](https://github.com/paulmillr/noble-hashes) (`@noble/hashes`) — MIT License.

## Development and testing tools

- [TypeScript](https://github.com/microsoft/TypeScript) — Apache License 2.0.
- [Vite](https://github.com/vitejs/vite) and [Vite React plugin](https://github.com/vitejs/vite-plugin-react) — MIT License.
- [esbuild](https://github.com/evanw/esbuild) — MIT License.
- [tsx](https://github.com/privatenumber/tsx) — MIT License.
- [Playwright](https://github.com/microsoft/playwright) — Apache License 2.0.
- [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped) (`@types/*` packages) — MIT License.

## Container and system components

The provided container build uses these third-party runtime components:

- [Node.js](https://github.com/nodejs/node) — distributed under the Node.js license and licenses of its bundled dependencies.
- [Alpine Linux](https://www.alpinelinux.org/) — packages are distributed under their respective licenses.
- [FFmpeg](https://ffmpeg.org/) — LGPL 2.1 or later by default, with the effective license depending on build configuration and enabled components. The container installs Alpine's packaged build.

## License information

Spire itself is licensed under the [Apache License 2.0](LICENSE). Third-party names and trademarks belong to their respective owners. This credits file does not replace or modify any third-party license terms.
