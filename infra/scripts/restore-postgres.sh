#!/bin/sh
set -e

if [ -z "$1" ]; then
  echo "Usage: restore-postgres.sh /backups/stoku-YYYYMMDD-HHMMSS.dump"
  exit 1
fi

pg_restore -h "${DB_HOST:-postgres}" -U "${DB_USERNAME:-stoku}" -d "${DB_DATABASE:-stoku}" --clean --if-exists "$1"
