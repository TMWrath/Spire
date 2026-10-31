# One Spire source of truth

Spire has one source repository: https://git.example/spire (master).
The home fallback is https://forge.tmwrath.com/Wrath/spire. It is a read-only pull mirror, not an independently developed product. Changes originate in the primary; request its mirror-sync API and verify the resulting commit instead of pushing into the mirror. Do not force-overwrite divergent histories.

## Three delivery targets

- **Server/web**: `server/`, `client/`, `shared/`, root package scripts, Dockerfile and Compose. The shared editor is built with `npm run build`.
- **Windows**: `windows/src/` and `windows/tests/` preserve the native .NET/WPF implementation and its complete history. Existing `desktop/` Electron code remains a compatibility/reference layer because shared types and tests depend on it; it is not a fourth product or a separate repository. Do not delete it without a separately tested retirement change.
- **Android**: `android/`, including Gradle app, local bridge, tests and bundler. Its original history is preserved by a non-squashed subtree import. `android/scripts/bundle.mjs` defaults to the parent project's shared frontend/store; build root `dist` before bundling. `SPIRE_SOURCE`/`SPIRE_DIST` overrides are only for deliberate verified builds, not another development checkout. Existing vendored files are packaging snapshots, not independent authoring copies.

## Local project

Canonical project-files checkout: self-hosted server `/srv/spire`, normally exposed on the coordinator as `/workspace/spire`. The coordinator's old `/home/spire/Projects/spire` path is a compatibility link to that location, not another repository. The coordinator NFS automount is currently failed and requires local administrator access to restore; until then operate on the canonical checkout over SSH. Never create a second checkout underneath an unmounted mountpoint. Old `spire-android` and `spire-windows` paths link to the corresponding subdirectories, not independent repositories.

Retired worktrees and the former Android checkout are preserved outside active projects under `/home/spire/Archives/`. The stale reconcile tree's persistent-selection work already landed in master at `57c8509`; conflict markers and line-number-corrupted leftover files are not a new feature to merge. Git bundles preserve branches and original Android history. Historical Android and Windows repositories are archived, not build inputs. NAS checkout backups and the uncommitted older Android version/packaging patch are kept under `/export/self-hosted server/Archives/`; they are superseded by Android 0.3.18 in the consolidated source and are not applied as a downgrade.

## Release boundaries

Consolidating source does not deploy a new website, rebuild Android APKs, or package Windows. Those are separate validation and delivery steps. Keep deployment rollback images and data backups; they are not competing source repositories.

The retired mobile-exit branch is a superseded implementation: it used a Home confirmation while the canonical layered Back handler already supports closing panels before returning Home and leaving the site. Preserve its historical ref, not its older replacement hook.
