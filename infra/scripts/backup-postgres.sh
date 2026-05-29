#!/bin/sh
set -e

BACKUP_DIR=${BACKUP_DIR:-/backups}
RETENTION_DAYS=${RETENTION_DAYS:-30}
STAMP=$(date +%Y%m%d-%H%M%S)

mkdir -p "$BACKUP_DIR"
pg_dump -h "${DB_HOST:-postgres}" -U "${DB_USERNAME:-stoku}" -d "${DB_DATABASE:-stoku}" -Fc > "$BACKUP_DIR/stoku-$STAMP.dump"
find "$BACKUP_DIR" -name 'stoku-*.dump' -mtime +"$RETENTION_DAYS" -delete
