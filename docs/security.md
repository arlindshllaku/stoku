# Security Review

Implemented controls:

- Laravel Sanctum token authentication
- Password hashing through Laravel casts
- Store-access middleware
- Platform and store role model
- Request validation classes
- Login rate limiting
- Security response headers
- Eloquent/query builder parameterization
- Immutable inventory, cash, and audit history records

Known follow-up hardening:

- Add permission middleware per route/action.
- Add feature tests for every store-scoped endpoint.
- Add dashboard/report query limits.
- Add export job authorization checks before generating files.
- Rotate default credentials immediately after deployment.
- Use Cloudflare Access or IP allowlists for admin-only environments if needed.
