-- Impersonation attribution: record the real Platform-Admin operator behind a
-- "log in as" session on the refresh-token row so it survives rotation and every
-- refreshed access token stays traceable to the operator. Additive + nullable.

ALTER TABLE "refresh_tokens" ADD COLUMN "impersonatorId" TEXT;
ALTER TABLE "refresh_tokens" ADD COLUMN "impersonatorEmail" TEXT;
