# Authentication

Mobile number is the primary login for every person on the platform. The JWT /
RBAC architecture is unchanged — this documents what Sprint 11 added around it.

---

## 1. Identity

| User kind | Username | Password |
| --- | --- | --- |
| Resident / Staff / Vendor | **Mobile number** (digits only) | `AUTH_DEFAULT_PASSWORD`, forced change on first sign-in |
| Platform / Association Admin | Email | Set at provisioning |

`POST /auth/login` accepts either in the same field: the identifier is matched
against `email` **or** `username` (the phone, normalised to digits so
`+91 98765 43210` and `9876543210` collide as intended).

One phone → one login account. A second `RESIDENT` profile with the same phone
is allowed (an owner may own several flats) and shares the account; any other
cross-kind reuse is a conflict.

### The default password is configuration

```dotenv
AUTH_DEFAULT_PASSWORD=Living@123   # CHANGE THIS IN PRODUCTION
```

`AccountProvisioningService` reads it from config. The `ONE_TIME_PASSWORD`
constant remains only as the documented dev default so a fresh checkout works.

---

## 2. Token architecture (unchanged)

- Access JWT (`JWT_ACCESS_TTL`, default 15m) carries roles + flattened permissions
- Refresh token as `selector.verifier`, rotated, family-tracked, DB-backed
- `JWT_REFRESH_TTL` / `JWT_REFRESH_TTL_REMEMBER`
- Any password change revokes **every** refresh token for that user

---

## 3. First-login password change

Provisioned accounts are created with `users.mustChangePassword = true`. The
portal's `ChangePasswordGate` blocks the app until
`POST /auth/change-password` succeeds, which clears the flag.

---

## 4. Password recovery

Two paths, chosen by what the user typed:

```
POST /auth/forgot-password  { identifier }   → { message, channel: 'otp' | 'link' }
```

| Identifier | Path |
| --- | --- |
| A mobile-number account | **OTP** delivered over WhatsApp (and email if the account has a real one) |
| An email-only account | Reset **link** by email |

Then one of:

```
POST /auth/reset-password       { token, password }         # link path
POST /auth/reset-password-otp   { mobile, code, password }  # OTP path
```

### Why this is safe

- The response is identical whether or not the account exists; the `channel`
  hint is shaped from the *identifier*, not from the lookup result.
- The OTP is argon2-hashed into the existing `VerificationToken` table
  (`PASSWORD_RESET` type — no new model) and expires in `AUTH_OTP_TTL`.
- Only **one live code per user** — issuing a new one consumes the old.
- Wrong attempts are counted in Redis; the code is **burned after 5**. If Redis
  is unreachable the counter fails closed (treated as the last attempt) so a
  brute-force cannot ride an outage.
- Both endpoints are throttled at 5/minute.

---

## 5. Admin reset

```
POST /auth/users/:userId/reset-password    (permission: user:update)
→ { message, temporaryPassword, mustChangePassword: true }
```

Sets the account back to the configured one-time password (or an explicit one),
re-arms `mustChangePassword`, and revokes every session. A tenant admin can only
reset users inside their own tenant.

The temporary password is returned so the admin can read it out — it is the
platform's documented one-time password and must be changed at next sign-in
anyway. The portal shows it once, in a dialog, from the key icon on a
resident / staff / vendor detail page.

---

## 6. Password history

`PasswordPolicyService` is the **only** way a password is written. Every path —
first-login change, self-service reset, OTP reset, admin reset — goes through
`hashAndRecord`, so history cannot be bypassed by adding a new flow later.

| Setting | Default | Effect |
| --- | --- | --- |
| `AUTH_PASSWORD_HISTORY_SIZE` | `5` | Rejects reuse of the current password or the last N. `0` disables. |
| `AUTH_PASSWORD_MIN_LENGTH` | `8` | Minimum length on change/reset |

Old hashes go to `password_history`, trimmed to the configured depth. An
**admin** reset is allowed to fall back past the history check — a forced reset
must always succeed.

Policy on the DTO is unchanged: ≥8 characters with at least one letter and one
number.

---

## 7. Environment

| Variable | Default | Notes |
| --- | --- | --- |
| `AUTH_DEFAULT_PASSWORD` | `Living@123` | One-time password for provisioned accounts |
| `AUTH_PASSWORD_HISTORY_SIZE` | `5` | `0` disables reuse checking |
| `AUTH_PASSWORD_MIN_LENGTH` | `8` | |
| `AUTH_OTP_TTL` | `10m` | Mobile reset code lifetime |
| `AUTH_OTP_LENGTH` | `6` | Clamped to 4–8 |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | — | ≥32 chars, required |

---

## 8. Testing

| Check | How |
| --- | --- |
| Mobile login | Sign in with the phone number + `AUTH_DEFAULT_PASSWORD` |
| First-login change | Portal blocks on the change-password gate until set |
| Reset by mobile | Login → *Forgot password?* → enter mobile → OTP arrives on WhatsApp → set new password |
| Reset by email | Same dialog with an email → link arrives |
| Admin reset | Resident detail → key icon → temporary password shown, user signed out everywhere |
| History | Try to reuse a recent password → rejected with the depth in the message |
