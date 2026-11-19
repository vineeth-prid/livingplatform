-- Two-factor sign-in (TOTP). Both nullable: existing accounts are unaffected
-- and two-factor stays off until a user enrols. The secret is stored
-- AES-256-GCM encrypted by the application (SecretCipher), never in clear.
ALTER TABLE "users" ADD COLUMN "mfaSecret" TEXT;
ALTER TABLE "users" ADD COLUMN "mfaEnabledAt" TIMESTAMP(3);
