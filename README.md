# Spire

Spire is a self-hosted, local-first knowledge and writing workspace. Portable Markdown and attachments are the canonical user content; the service keeps revision, synchronization, and conflict metadata separately.

## Terminology

- **Spire** is the application.
- A **Reliquary** is the complete collection of stored knowledge and items.
- Product-specific names for folders and Markdown documents remain provisional. Codex, Cluster, and Shard are candidates rather than established interface language.

Every Markdown document must belong to a folder. Loose Markdown files are not permitted at the Reliquary root; creation, import, and move operations must always provide a destination folder.

## Preview with Docker

Requirements: Docker Engine with the Compose plugin.

```sh
docker compose up --build -d
docker compose ps
```

Open [https://spire.example](https://spire.example) on a device connected to the project owner's Tailscale network. Caddy on self-hosted server provides HTTPS and listens only on the self-hosted server Tailscale IP; the Compose port is bound to loopback only. The hostname's A record points to self-hosted server's Tailscale IP. Persistent app state and Markdown files are isolated in the named `spire-preview_spire_data` Docker volume. This preview does not mount or import the real Wrath Vault. The first visitor creates the sole owner account; use a unique password of at least 12 characters. Do not share the preview endpoint or use a reused password.

To stop while keeping data: `docker compose down`. To permanently erase this preview and its data: `docker compose down -v` (destructive).

For access from another device, use an authenticated private tunnel or a properly configured HTTPS reverse proxy. Set `SPIRE_ORIGIN` to the exact browser origin when using HTTPS; do not publish port 4173 directly. Back up the Docker volume before upgrades. No encryption at rest or end-to-end encryption is implemented.

## Development

- Node.js >=22.12.0
- `npm ci`
- `npm test`
- `npm run build`
- `npm start` (serves built `dist`; default loopback on port 4173)
- `npm run test:browser`

The browser client has an IndexedDB offline cache/outbox and a service-worker app shell; validate the installed offline flow before relying on it. Single-owner preview, not a multi-user service.

Project plans and clean-room capability research are in `documents/`. No Obsidian implementation code, brand assets, or real Vault content is included in the image.

## Canonical source and platforms

One repository contains Server/web (`client/`, `server/`, `shared/`), Windows (`windows/`), and Android (`android/`). See [source layout](documents/source-layout.md). Do not develop in retired worktrees or the archived standalone Android repository.
