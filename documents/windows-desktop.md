# Windows desktop delivery

## Authorized scope
the project owner requests a 1:1 Windows copy of Docker Spire with local-directory and Docker-server connection modes. the project owner selected Aphelion's recommendation to bundle the existing interface and engine rather than rewrite the interface with native controls.

## Implementation decision
Use an isolated Electron desktop host around the canonical web production build and existing Node API/store. The app bundles its own runtime; users do not install Docker, Node, or a browser. Server mode uses the existing authenticated HTTPS instance. Local mode binds only loopback and stores ordinary files in the selected folder with isolated application metadata. No automatic merging between local folders and server accounts. Preserve existing conflict and edit protections.

## Acceptance (not yet complete)
- [ ] Shared production interface and engine bundled for Windows x64.
- [ ] Native directory chooser; local files persist and reopen offline.
- [ ] Existing directories are opened non-destructively; external changes cannot be silently overwritten.
- [ ] HTTPS server connection with normal authentication; per-workspace browser state isolation.
- [ ] Recoverable mode switching and startup errors; no arbitrary Node access from renderer.
- [ ] Export/download, print/PDF, media permission and capture integration.
- [ ] Windows-safe atomic persistence and exclusive workspace ownership.
- [ ] Focused desktop tests and full shared regression/build acceptance.
- [ ] Packaged artifact independently inspected and checksummed.
- [ ] Packaged Windows runtime tested, including local editing/reopen and server connection.
- [ ] Delivery of actual artifact with honest remaining limits.

## Baseline
Canonical source `/workspace/spire`; clean baseline at start of implementation, source revision `80d682f`. Docker production and Android are not deployment targets of this task. Do not push or deploy server changes without authorization. Preserve all existing user data. This document is a task checkpoint, not a completion report.
