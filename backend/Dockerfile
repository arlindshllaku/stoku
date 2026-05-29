FROM dunglas/frankenphp:1-php8.3 AS vendor
WORKDIR /app

RUN install-php-extensions \
    bcmath \
    intl \
    pcntl \
    pdo_pgsql \
    zip

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
COPY composer.json ./
RUN composer install --no-dev --no-interaction --prefer-dist --no-scripts --no-autoloader
COPY . .
RUN composer dump-autoload --optimize

FROM dunglas/frankenphp:1-php8.3
WORKDIR /app

RUN install-php-extensions \
    bcmath \
    intl \
    opcache \
    pcntl \
    pdo_pgsql \
    redis \
    zip

COPY --from=vendor /app /app
COPY docker/Caddyfile /etc/caddy/Caddyfile
COPY docker/entrypoint.sh /usr/local/bin/stoku-entrypoint
RUN chmod +x /usr/local/bin/stoku-entrypoint \
    && chown -R www-data:www-data /app/storage /app/bootstrap

EXPOSE 8000
ENTRYPOINT ["stoku-entrypoint"]
CMD ["frankenphp", "run", "--config", "/etc/caddy/Caddyfile"]
