#!/bin/sh
set -e

if [ ! -f .env ] && [ -f .env.example ]; then
  cp .env.example .env
fi

php artisan config:clear || true
php artisan migrate --force

exec "$@"
