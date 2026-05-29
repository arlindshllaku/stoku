# Database Schema

## Platform

- `users`
- `stores`
- `store_users`
- `roles`
- `permissions`
- `role_permissions`
- `user_store_roles`

## Inventory

- `inventory_categories`
- `suppliers`
- `inventory_items`
- `inventory_movements`

Important index:

```sql
CREATE UNIQUE INDEX inventory_items_store_imei_unique
ON inventory_items (store_id, imei)
WHERE imei IS NOT NULL;
```

This allows accessories without IMEI while preventing duplicate device IMEIs inside one store.

## Sales And Exchange

- `customers`
- `sales`
- `sale_items`
- `exchanges`

## Cash

- `cash_registers`
- `cash_transactions`
- `cash_daily_closures`

Cash balance is derived operationally from immutable `cash_transactions`, with `cash_registers.current_balance` maintained for fast reads.

## Audit

- `audit_logs`

Audit rows store action, actor, tenant, entity, old values, new values, request IP, user agent, and metadata.
