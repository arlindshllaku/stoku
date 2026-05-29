Act as a Senior DevOps Engineer.

Prepare this project for deployment inside a Proxmox LXC container.

Infrastructure:
- The app will run inside an LXC container on Proxmox
- Cloudflare Tunnel is used for public access
- Cloudflare Tunnel may run in a separate LXC container
- Do not assume Kubernetes
- Do not assume VPS/cloud hosting
- Prefer simple, reliable deployment

Focus on:
- Docker or native service inside LXC
- Correct ports and internal networking
- .env configuration
- Persistent volumes/data
- PostgreSQL or SQL Server connection
- Cloudflare Tunnel routing compatibility
- No unnecessary Nginx unless required
- Systemd service if not using Docker
- Restart policies
- Logs
- Backups
- Security hardening

Before changing anything, inspect:
- Dockerfile
- docker-compose.yml
- .env.example
- exposed ports
- volumes
- database config
- app startup command

When finished, provide:
- LXC deployment steps
- Required Proxmox/LXC settings
- Internal port to expose
- Cloudflare Tunnel public hostname mapping
- Restart/recovery instructions
- Backup instructions