# Architecture

Stoku is built as a modular monolith. The backend keeps business workflows close to the database transaction boundary, while the frontend is a separate React application that consumes `/api/v1`.

## Tenancy

Tenant data is isolated by `store_id`. Users access store data only when they are assigned in `store_users`, unless they have the platform `super_admin` role.

Tenant checks are enforced by:

- Route structure: `/api/v1/stores/{store}/...`
- `EnsureStoreAccess` middleware
- Store-scoped service queries
- Store-scoped indexes on high-volume tables

## Backend Modules

```text
app/Domain/Stores
app/Domain/Inventory
app/Domain/Sales
app/Domain/Cash
app/Domain/Users
app/Domain/Audit
```

Controllers validate HTTP input and call services. Services own transactional workflows and audit writes.

## Critical Workflows

Inventory creation:

1. Create `inventory_items`.
2. Create `inventory_movements` with `purchase/in`.
3. Write audit log.

Normal sale:

1. Lock inventory item.
2. Validate `in_stock`.
3. Create sale and sale item.
4. Mark item `sold`.
5. Create `sale/out` movement.
6. Increase cash balance.
7. Create `sale_income/in` cash transaction.
8. Write audit log.

Exchange:

1. Lock outgoing item.
2. Create incoming item.
3. Create exchange.
4. Mark outgoing item `exchanged_out`.
5. Create `exchange_out/out` movement.
6. Create `exchange_in/in` movement.
7. Apply optional cash income or payout.
8. Write audit log.

Cash movement:

1. Lock cash register row.
2. Update balance.
3. Create immutable cash transaction with `balance_after`.

## Frontend

The first screen is the operational dashboard, not a landing page. It is designed for scanning store state on desktop and mobile:

- Stock metrics
- Sales and profit chart
- Recent transactions
- Inventory snapshot table
