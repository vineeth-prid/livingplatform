# Security Report & Posture — Living v1.0 RC

## Application security controls (implemented)

| Area | Control | Where |
| --- | --- | --- |
| **Transport** | TLS at Cloudflare (Full/Strict) + edge; HSTS via CF | `deploy/nginx` |
| **Headers** | `helmet()` (CSP defaults, nosniff, frameguard, etc.) + edge headers | `main.ts`, `edge.conf` |
| **CORS** | Explicit allow-list from `CORS_ORIGINS`; credentials on | `main.ts` |
| **AuthN** | Argon2id password hashing; JWT access (15m) + **rotating opaque refresh** with reuse detection; email verification | `auth` module |
| **AuthZ** | Configurable RBAC; permissions embedded in JWT; `PermissionsGuard` + `@RequirePermissions`; global `JwtAuthGuard` (opt-out via `@Public`) | `common/guards`, `rbac` |
| **Tenant isolation** | `CommunityAccessService.assert()` choke point; cross-tenant ids return **404** (never leak existence); `tenantId`+`communityId` on every business row | `tenancy` |
| **Input validation** | Global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`); class-validator DTOs on every endpoint | `app.module.ts` |
| **SQL injection** | Prisma parameterised queries throughout; no raw string SQL | all services |
| **Rate limiting** | `@nestjs/throttler` (120 req/60s/IP default) + edge `limit_req` backstop | `app.module.ts`, `edge.conf` |
| **Secrets** | Env-validated at boot (JWT secrets ≥ 32 chars enforced); never logged; auth headers/cookies redacted in logs | `env.validation.ts`, pino redact |
| **Audit** | Every mutating request → append-only `audit_logs` (actor, tenant, path, status) | `AuditInterceptor` |
| **File upload** | Metadata-only signed-URL flow; **no multipart body parsing** in the app (no `multer` usage) → no upload-parser attack surface | `StorageService` |

## XSS / CSRF

- **XSS**: React escapes by default; no `dangerouslySetInnerHTML` in the codebase.
  Helmet sets `X-Content-Type-Options` and a baseline CSP.
- **CSRF**: the API is token-based (Bearer in `Authorization`), not cookie-session
  for state-changing calls, so classic CSRF does not apply. CORS is allow-listed.

## Dependency vulnerabilities (`pnpm audit --prod`)

**0 critical · 8 high · 15 moderate · 2 low** — **all in the backend framework
dependency tree** (Nest / Express / Swagger / nodemailer transitive deps). None in
the frontend bundles (no browser-delivered vulnerable code).

**Exposure assessment (real attack surface in Living):**

| Package | Sev | Used by Living? | Assessment |
| --- | --- | --- | --- |
| `multer` | high | **No** — 0 imports; app parses no multipart bodies | No reachable path. |
| `file-type` | mod | **No** — 0 imports | No reachable path. |
| `qs` | mod | Transitive (express query parsing) | Low; query strings validated by DTOs. |
| `nodemailer` | high/mod/low | Yes — outbound SMTP only (verify/reset) | Server-to-trusted-SMTP; not attacker-controlled in the vulnerable paths. |
| `lodash` | high/mod | Transitive (`@nestjs/config`) | No latest fix available (≤4.17.21); prototype-pollution, not reachable from user input. |
| `js-yaml` | high/mod | Transitive (`@nestjs/swagger`) | Swagger doc generation only; not a runtime request path. |
| `@nestjs/core`, `uuid`, `body-parser` | mod/low | Framework transitive | Framework-managed; patch on Nest minor bumps. |

**Disposition:** No exploitable path is reachable given Living's usage (no
multipart upload processing; SMTP is trusted; the vulnerable code is in
doc-generation/config paths). Per RC-freeze discipline we did **not** force
major-version bumps of framework deps (breakage risk). **Remediation plan:** a
dependency-refresh in **v1.0.1** — bump `@nestjs/*` to the latest 10.x/11.x
patches, `nodemailer` to current, and re-audit. Tracked as a release-blocker for
v1.0.1, **not** for the v1.0 RC deployment.

## Hardening checklist for the operator

- [ ] Rotate the seeded admin password (`admin@living.local`) on first login.
- [ ] Set two distinct ≥48-char JWT secrets; never reuse across environments.
- [ ] Lock the origin firewall to Cloudflare IP ranges (or Cloudflare Tunnel).
- [ ] Never publish Postgres/Redis/MinIO ports on the host (internal network only).
- [ ] Enable Cloudflare WAF, HSTS, Always-HTTPS, Bot Fight Mode.
- [ ] Encrypt off-box backups; store secrets in a separate manager.
- [ ] Schedule the v1.0.1 dependency refresh.
