-- Sprint C — FAMILY_MEMBER occupancy.
--
-- Household members added by a resident from their own app were being stored as
-- SECONDARY, which is the value an ADMIN uses for a co-occupant they created.
-- The residents register showed both identically, so there was no way to tell a
-- self-added family member from an admin-created one.
--
-- Appending an enum value is safe for existing rows and existing queries.
ALTER TYPE "ResidentRole" ADD VALUE IF NOT EXISTS 'FAMILY_MEMBER';
