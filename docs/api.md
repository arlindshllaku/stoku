# API

Base path:

```text
/api/v1
```

## Auth

```text
POST /auth/login
POST /auth/logout
GET  /auth/me
```

## Stores

```text
GET    /stores
POST   /stores
GET    /stores/{store}
PUT    /stores/{store}
DELETE /stores/{store}
PATCH  /stores/{store}/status
POST   /stores/{store}/owners
```

## Inventory

```text
GET    /stores/{store}/inventory
POST   /stores/{store}/inventory
GET    /stores/{store}/inventory/{inventory}
PUT    /stores/{store}/inventory/{inventory}
DELETE /stores/{store}/inventory/{inventory}
POST   /stores/{store}/inventory/{inventory}/adjust
GET    /stores/{store}/inventory/{inventory}/movements
```

## Sales

```text
GET  /stores/{store}/sales
POST /stores/{store}/sales/normal
POST /stores/{store}/sales/exchange
```

## Cash

```text
GET  /stores/{store}/cash
POST /stores/{store}/cash/deposit
POST /stores/{store}/cash/withdraw
POST /stores/{store}/cash/expense
```

All store routes require authentication and store access.
