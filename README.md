# Stoku

Production-oriented multi-tenant inventory, sales, exchange, and cash management for mobile phone stores.

## Stack

- Backend: Laravel 12 API, Sanctum auth, PostgreSQL, Redis
- Frontend: React, TypeScript, TailwindCSS, ApexCharts, lucide-react
- Runtime: Docker Compose inside Proxmox LXC
- Public access: Cloudflare Tunnel to exposed internal ports

## Local Structure

```text
backend/   Laravel API
frontend/  React dashboard
infra/     PostgreSQL init and backup scripts
docs/      Architecture, deployment, and API documentation
```

## First Run In LXC

```bash
cp backend/.env.example backend/.env
docker compose build
docker compose run --rm backend php artisan key:generate --force
docker compose up -d
docker compose exec backend php artisan db:seed --force
```

The API is exposed on `http://<lxc-ip>:8000`.

The frontend is exposed on `http://<lxc-ip>:4173`.

## Current Implementation Status

Implemented foundation:

- Tenant-aware store model
- Users, roles, permissions, and store assignments
- Sanctum token authentication
- Inventory items and inventory movements
- Normal sale workflow
- Exchange/trade-in workflow
- Cash register and cash transactions
- Audit log table and logger
- Docker Compose for app, queue, scheduler, PostgreSQL, Redis, frontend, and backup profile
- First responsive dashboard UI

Next build milestones:

- Full user/employee management UI
- Report exports to PDF/Excel
- Dashboard API aggregation endpoints
- Feature tests for tenant isolation and transactional workflows
- Cloudflare Tunnel production hostname wiring
