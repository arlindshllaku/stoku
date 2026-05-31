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

php artisan migrate --force

exec "$@"
