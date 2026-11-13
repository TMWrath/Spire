# Spire source layout

Spire currently ships as a self-hosted web application.

## Application

- `client/` contains the responsive web interface and editor.
- `server/` contains authentication, storage, revisions, backups, and application APIs.
- `shared/` contains formats and rules used by both the browser and server.
- `public/` contains static assets copied into the production build.

## Operations

- `Dockerfile` builds the production container.
- `compose.yaml` provides the default local-only deployment with persistent storage.
- `scripts/` contains build-time utilities.

## Quality and documentation

- `tests/` contains unit, integration, and browser tests.
- `examples/` contains optional fictional showcase content.
- `documents/` contains installation and technical documentation.

Android, Windows, and Linux clients are planned separately. Their source will be added when those clients are ready to be developed and released as supported products.
