# Install Spire on Windows

The current supported way to run Spire on Windows is through Docker Desktop. A dedicated Windows client is planned for a future release but is not yet available as a supported installer.

## Requirements

- Windows 10 or Windows 11 with current updates
- Hardware virtualization enabled
- [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/)
- Git for Windows, or another way to download the repository

During Docker Desktop setup, use the WSL 2 backend when it is available. Restart Windows if the installer requests it, then open Docker Desktop and wait until the Docker engine is running.

## Install

Open PowerShell and run:

```powershell
git clone https://github.com/TMWrath/Spire.git
Set-Location Spire
docker compose up --build -d
docker compose ps
```

Open [http://localhost:4173](http://localhost:4173) in your browser. The first visitor creates the owner account. Use a unique password containing at least 12 characters.

Spire's files are stored in a persistent Docker volume rather than the cloned source folder.

## Start and stop Spire

From the `Spire` folder:

```powershell
# Start
docker compose up -d

# Stop without deleting data
docker compose down
```

**Do not add `-v` to `docker compose down` unless you intend to permanently delete the Spire data volume.**

## Update

Back up your Spire data before upgrading. Then run:

```powershell
git pull --ff-only
docker compose up --build -d
docker compose ps
```

## Access from other devices

The default installation listens only on the Windows computer at `127.0.0.1:4173`. This is intentional.

Do not change the port binding to expose Spire directly to the internet. Use an HTTPS reverse proxy and set `SPIRE_ORIGIN` to the exact public address. See the [Docker installation guide](docker.md#access-from-another-device) for the server configuration.

## Troubleshooting

If Docker reports that the engine is unavailable:

1. Open Docker Desktop.
2. Wait for Docker Desktop to report that the engine is running.
3. Confirm WSL 2 is installed and enabled.
4. Retry `docker compose ps`.

View Spire logs:

```powershell
docker compose logs --tail=200 spire
```

If port `4173` is already occupied, stop the conflicting application before starting Spire.

## Dedicated Windows client

A dedicated Windows client is planned. Its download and installation steps will be added here after a packaged build has completed release testing. Until then, Docker Desktop is the supported Windows installation method.
