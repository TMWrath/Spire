# Install Spire with Docker

This is the recommended installation method for the current Spire release.

## Requirements

- Git
- Docker Engine 24 or newer
- Docker Compose v2 (`docker compose`)

Docker Desktop already includes the required Compose plugin on Windows and macOS.

## Install

Clone the repository and start Spire:

```sh
git clone https://github.com/TMWrath/Spire.git
cd Spire
docker compose up --build -d
```

Check that the container is healthy:

```sh
docker compose ps
```

Open [http://localhost:4173](http://localhost:4173). The first visitor creates the owner account. Use a unique password containing at least 12 characters.

## Storage

The included Compose configuration stores Spire data in the `spire_data` Docker volume and publishes the application only on the host's loopback interface:

- Application: `127.0.0.1:4173`
- Data inside the container: `/data`
- Persistent volume: `spire_data`

Stopping the container does not remove the volume:

```sh
docker compose down
```

**Do not run `docker compose down -v` unless you intend to permanently delete the Spire data volume.**

## Update

Back up your data before upgrading. Then update the source and rebuild the container:

```sh
git pull --ff-only
docker compose up --build -d
docker compose ps
```

## Back up the data volume

Create a compressed backup in the current directory:

```sh
docker compose stop
docker compose run --rm --no-deps spire \
  tar -czf - -C /data . > spire-data-backup.tar.gz
docker compose start
```

This command uses the same named volume as the Spire service, including any Compose project-name prefix. Keep backups somewhere other than the Docker host and test your recovery process before relying on them.

## Access from another device

The default port binding is intentionally local-only. For remote access, place Spire behind an HTTPS reverse proxy and set the exact external browser origin:

```sh
SPIRE_ORIGIN=https://notes.example.com docker compose up --build -d
```

Changing `SPIRE_ORIGIN` does not configure HTTPS and does not expose the local-only port. Configure the reverse proxy separately. Do not publish Spire's internal application port directly to the internet.

Recording, microphone access, and some other browser APIs require HTTPS or localhost.

## Configuration

- `SPIRE_ORIGIN`: Exact browser origin. The Docker default is `http://localhost:4173`.
- `SPIRE_DATA`: Application data directory. The container uses `/data`.
- `HOST`: Listening address inside the container. The included configuration uses `0.0.0.0` behind a loopback-only published port.
- `PORT`: Application port. The default is `4173`.

Spire does not currently provide end-to-end encryption or encryption at rest. Secure and back up the Docker host and its storage appropriately.

## Troubleshooting

View container status and recent logs:

```sh
docker compose ps
docker compose logs --tail=200 spire
```

Rebuild after dependency or source changes:

```sh
docker compose up --build -d
```

If the browser cannot connect, confirm that the container is healthy and that another program is not already using port `4173`.
