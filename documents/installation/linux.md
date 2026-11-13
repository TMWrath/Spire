# Install Spire on Linux

The current supported way to run Spire on Linux is with Docker Engine and Docker Compose. A dedicated Linux client is planned for a future release but is not yet available as a supported package.

## Requirements

- A currently supported Linux distribution
- Git
- Docker Engine 24 or newer
- Docker Compose v2 (`docker compose`)

Install Docker from the official instructions for your distribution:

- [Docker Engine installation](https://docs.docker.com/engine/install/)
- [Linux post-installation steps](https://docs.docker.com/engine/install/linux-postinstall/)

If your account is not configured to use Docker without elevated privileges, prefix the Docker commands below with `sudo`.

## Install

```sh
git clone https://github.com/TMWrath/Spire.git
cd Spire
docker compose up --build -d
docker compose ps
```

Open [http://localhost:4173](http://localhost:4173). The first visitor creates the owner account. Use a unique password containing at least 12 characters.

Spire stores its data in the persistent `spire_data` Docker volume. The source checkout and application data are separate.

## Start automatically after reboot

The Compose service uses `restart: unless-stopped`. It can restart after a reboot when the Docker service starts automatically:

```sh
sudo systemctl enable --now docker
```

The exact service-management command may differ on distributions that do not use systemd.

## Start and stop Spire

Run these commands from the cloned `Spire` directory:

```sh
# Start
docker compose up -d

# Stop without deleting data
docker compose down
```

**Do not run `docker compose down -v` unless you intend to permanently delete the Spire data volume.**

## Update

Back up your Spire data before upgrading. Then run:

```sh
git pull --ff-only
docker compose up --build -d
docker compose ps
```

## Access from other devices

The included configuration publishes Spire only at `127.0.0.1:4173`. For access from another computer, use an HTTPS reverse proxy instead of exposing the internal application port directly.

Set the browser-facing origin when starting Spire:

```sh
SPIRE_ORIGIN=https://notes.example.com docker compose up --build -d
```

This setting does not install or configure the reverse proxy. See the [Docker installation guide](docker.md#access-from-another-device) for the full explanation.

## Firewall and permissions

- Do not open port `4173` to the public internet.
- Keep Docker, the host operating system, and the reverse proxy updated.
- Restrict administrative access to the host.
- Back up the Docker volume to storage outside the host.
- Spire does not currently provide end-to-end encryption or encryption at rest.

## Troubleshooting

Check the Docker service, container state, and logs:

```sh
systemctl status docker
docker compose ps
docker compose logs --tail=200 spire
```

If the browser cannot connect, verify that:

1. The Docker service is running.
2. The Spire container reports as healthy.
3. Port `4173` is not already occupied.
4. You are opening Spire from the same Linux computer unless an HTTPS reverse proxy has been configured.

## Dedicated Linux client

A dedicated Linux client is planned. Package-specific instructions will be added here after release builds have been produced and tested. Until then, Docker Engine is the supported Linux installation method.
