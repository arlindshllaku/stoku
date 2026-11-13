# Proxmox LXC Deployment

## Recommended LXC Settings

- Debian 12 or Ubuntu 24.04 template
- 2 CPU cores minimum
- 4 GB RAM minimum
- 30 GB disk minimum
- Enable nesting for Docker
- Use a static LAN IP

## Install Runtime

```bash
apt update
apt install -y ca-certificates curl gnupg
curl -fsSL https://get.docker.com | sh
apt install -y docker-compose-plugin
```

## Deploy

```bash
git clone <repo-url> stoku
cd stoku
cp backend/.env.example backend/.env
```

Edit:

```text
APP_URL
FRONTEND_URL
DB_PASSWORD
POSTGRES_PASSWORD in docker-compose.yml
SUPER_ADMIN_EMAIL
SUPER_ADMIN_PASSWORD
```

Then:

```bash
docker compose build
docker compose run --rm backend php artisan key:generate --force
docker compose up -d
docker compose exec backend php artisan db:seed --force
```

## Ports

- Backend API: `8000`
- Frontend: `4173`
- PostgreSQL and Redis are internal Docker services only.

## Cloudflare Tunnel

Create public hostnames:

```text
app.example.com  -> http://<lxc-ip>:4173
api.example.com  -> http://<lxc-ip>:8000
```

Set `APP_URL=https://api.example.com` and `FRONTEND_URL=https://app.example.com`.
Set `VITE_API_BASE_URL=https://api.example.com/api/v1` before rebuilding the frontend image.

For Sanctum/CORS, also set:

```text
SANCTUM_STATEFUL_DOMAINS=app.example.com
SESSION_DOMAIN=.example.com
```

## Report runtime memory

The backend image sets PHP `memory_limit=512M` for HTTP exports, queue workers
and scheduler child processes. Rebuild and recreate `backend`, `queue` and
`scheduler` after changing `backend/docker/php-reports.ini`; restarting an old
image does not load the new configuration.

PDF file size and PHP memory usage are different measurements: an 850-row stock
PDF was about 1 MB while Dompdf used about 306 MB of peak PHP memory to lay it
out. The 512 MB limit is per PHP process, so allow capacity for concurrent jobs.

Reports are generated as byte strings and sent with `attachData`; the application
does not save completed PDF/XLSX reports to the storage volume. Keep that path
in memory rather than adding an archive of generated attachments. Existing
uploads, font caches, logs and backups must not be removed as report cleanup.

## Backups

Manual backup:

```bash
mkdir -p backups
docker compose --profile backup run --rm backup
```

Restore:

```bash
docker compose exec -T postgres pg_restore -U stoku -d stoku --clean --if-exists < backups/stoku-file.dump
```

Also back up Docker volumes:

- `postgres_data`
- `backend_storage`
