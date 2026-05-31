#!/bin/sh
set -e

if [ ! -f .env ] && [ -f .env.example ]; then
  cp .env.example .env
fi

mkdir -p \
  storage/app \
  storage/framework/cache/data \
  storage/framework/sessions \
  storage/framework/testing \
  storage/framework/views \
  storage/logs \
  bootstrap/cache

chown -R www-data:www-data storage bootstrap/cache

if [ "${APP_ENV:-production}" = "production" ]; then
  php artisan optimize:clear || true
  php artisan config:cache
  php artisan route:cache
  php artisan event:cache
else
  php artisan optimize:clear || true
fi

run_migrations="${RUN_MIGRATIONS:-auto}"

if [ "$run_migrations" = "auto" ]; then
  case "$*" in
    *"queue:work"*|*"schedule:work"*) run_migrations=false ;;
    *) run_migrations=true ;;
  esac
fi

if [ "$run_migrations" = "true" ]; then
  php artisan migrate --force
fi

exec "$@"
