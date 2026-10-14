# Unified workspace direct-execution checkpoint

Status: acceptance NOT complete. This continuation owns no inherited edits.
Authoritative contract: documents/unified-workspace.md; Android mirror must agree.

## Protected baseline
Spire baseline commit: 903121f. Existing dirty tracked files: client/FormattingToolbar.tsx, client/main.tsx, client/style.css, client/sync.ts, documents/features.md, documents/todo.md, tests/browser/quick-format.spec.ts. Existing untracked acceptance document retained.
Android contains prior dirty native MainActivity, build configuration, tests, package files, documentation, and untracked LocalFolder/FolderTransaction, local runtime, scripts/vendor/assets. Preserve all; no reset/stash or blanket staging.
Current Windows implementation: Spire desktop Electron. Historical WPF excluded.

## Acceptance gates
- [ ] Behavioral RED tests: dual mounted navigation and origin/account/workspace identity isolation.
- [ ] Settings HTTPS login retains Local; sign-out retains Local.
- [ ] Same canonical full editor on both mounts; simultaneous labeled sidebar trees.
- [ ] Opened server files cached for offline edits, durable pending writes, conflict-safe sync preserving both versions.
- [ ] Explicit bidirectional transfers only; destination acknowledged and byte-verified before conditional source removal.
- [ ] Attachment bytes/references integrity; interruption, changed source, pending edits, revoked permissions fail closed.
- [ ] Desktop drag/drop and touch Move action.
- [ ] Native bridges restricted to trusted bundled renderer.
- [ ] Final-source applicable regression suites, Android build/canonical Mini signer verification, Windows packaging.
- [ ] Reviewed rollback-safe hosted deployment, backup/candidate validation/live asset and health verification.
- [ ] Exact artifact verification before Telegram home delivery.
- [ ] Both project docs and Vault updated with observed evidence.

## Scope restrictions
No delegation or CLI coding agents. No phones/ADB/device installation. No source push/public releases. No secrets in logs/repositories. Only independently completed scoped actions may be committed.

## Evidence
Initial git inventories captured. Scoped domain-only implementation committed as 319847d: shared/mounted-workspace.ts, shared/mounted-transfer.ts and two test files (no inherited edits staged). All inherited tracked dirty paths remain dirty. No push.

## Exit checkpoint — incomplete acceptance
This pass stops with buildable source and tested domain contracts, NOT the requested unified workspace. No worker or background continuation remains. Execution did not reach production integration; no external blocker was established. Remaining work must not be represented as implemented.

Observed gates: 14 focused domain tests GREEN after captured behavioral RED; 140 Spire unit tests GREEN; 115 existing browser regressions GREEN; TypeScript check and final web build GREEN. Android npm tests GREEN; remote test/lint/assembleDebug BUILD SUCCESSFUL; Windows Electron ZIP packaged and CRC-checked. Native Android report counts per variant: 2 AppActions, 6 MainActivity, 2 LocalFolder, 8 ServerAddress, 8 FolderTransaction. Browser checks are Chromium, not physical-device/WebView proof. No Windows runtime verification.

Domain state serialization is not durable platform cache integration. Adapter transfer tests are not SAF/server/Electron transfers. No production caller imports the new modules. Product acceptance boxes remain unchecked.

Exact remaining gates: production mounted engine/cache migration; trusted native HTTPS authentication transport; Settings login/sign-out preserving Local; simultaneous labeled trees; editor/API/media/style/reference routing; durable opened-server-only offline cache/outbox and conflict replay/UI; atomic create-only destination adapters and conditional source removal; attachment acquisition/relative reference preservation; durable transfer journal/crash recovery; touch Move and desktop drag/drop; integrated parity/security tests; rebuild/sign/package after those final changes; reviewed backup/candidate deployment/live checks and rollback; exact accepted artifact delivery.

Artifacts (baseline only, NOT feature releases):
- /home/spire/.hermes/artifacts/spire-unified-continuation/spire-0.2.1-baseline-mini-debug.apk
  SHA-256: 0d3d3207772ee31f5b0803eeca35f98c92a5852a46ee391b36d3fe1e86f1134b
  Mini signer SHA-256: 096dc9323929255c3b3ff9f781a3c29a32f86a7c2d36016031deb6a2e7933af6
- /home/spire/.hermes/artifacts/spire-unified-continuation/Spire-0.1.0-windows-x64-baseline.zip
  SHA-256: be90920a7070125f626936cb19070f92d4cb0b5e4af7d29ed32464d2dd2293dc
Evidence logs persisted in /home/spire/.hermes/artifacts/spire-unified-continuation/evidence/.

Both acceptance documents and Vault observed-evidence note updated, explicitly retaining incomplete status. No phones/ADB/install, Telegram artifact delivery, hosted deployment, source push or public release occurred. Production UI/transport were preserved rather than shipping a cosmetic or unsafe integration.
