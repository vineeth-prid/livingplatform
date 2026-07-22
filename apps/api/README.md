# @living/api

NestJS backend for the Living Platform — the multi-tenant PropTech foundation.

## Run

```bash
# from repo root
pnpm --filter @living/api db:migrate   # apply schema
pnpm --filter @living/api db:seed      # roles, permissions, demo tenant
pnpm --filter @living/api dev          # http://localhost:4000/api/v1
```

Swagger: <http://localhost:4000/api/docs>

## Layout

```
src/
├─ main.ts                 # bootstrap: helmet, CORS, URI versioning, Swagger, pino
├─ app.module.ts           # global guards / pipes / filters / interceptors wiring
├─ config/                 # configuration() + env.validation (fail-fast at boot)
├─ common/
│  ├─ decorators/          # @Public @Roles @RequirePermissions @CurrentUser
│  ├─ guards/              # JwtAuthGuard, PermissionsGuard, RolesGuard
│  ├─ filters/             # AllExceptionsFilter (consistent error shape)
│  ├─ interceptors/        # TransformInterceptor (response envelope)
│  ├─ dto/                 # PaginationQueryDto
│  ├─ types/               # AuthenticatedUser, token payloads
│  └─ utils/               # duration parser (+ spec)
└─ modules/
   ├─ prisma/              # global PrismaService
   ├─ redis/               # global RedisService (lazy)
   ├─ mail/                # nodemailer (Mailpit in dev)
   ├─ tenancy/             # request-scoped TenantContextService
   ├─ audit/               # AuditService + global AuditInterceptor
   ├─ rbac/                # RbacService, roles/permissions API, RBAC catalog
   ├─ auth/               # register/verify/login/refresh/reset + TokensService + JwtStrategy
   ├─ users/              # tenant-scoped user administration
   └─ health/             # liveness, readiness (Terminus), /metrics
```

## Auth flows (all under `/api/v1/auth`)

| Endpoint | Purpose |
| --- | --- |
| `POST /register` | Create account → sends verification email |
| `POST /verify-email` | Confirm email (PENDING → ACTIVE) |
| `POST /resend-verification` | Re-send verification link |
| `POST /login` | Email + password → access + refresh tokens (`rememberMe` supported) |
| `POST /refresh` | Rotate refresh token (reuse ⇒ family revoked) |
| `POST /logout` | Revoke one refresh token |
| `POST /logout-all` | Revoke all sessions (auth required) |
| `POST /forgot-password` | Send reset email (no user enumeration) |
| `POST /reset-password` | Set new password (revokes all sessions) |
| `GET /me` | Current principal (auth required) |

## Testing

```bash
pnpm --filter @living/api test        # unit (jest)
pnpm --filter @living/api test:e2e    # e2e (needs a test DB)
```

## Notes / deliberate ceilings

Searchable with `grep -rn "ponytail:" src`:

- Permissions are embedded in the access token → changes take effect on next
  refresh (≤ access TTL). Redis-backed live lookup is the upgrade for instant
  revocation.
- Rate limiter is in-memory (single node). Swap to Redis storage for multi-node.
- Soft-delete is filtered per-query; a Prisma client extension can globalize it.
- `/metrics` is hand-rolled process metrics; swap for prom-client / OpenTelemetry.
