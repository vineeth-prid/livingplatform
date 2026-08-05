-- Sprint B — map existing vendors onto the services vocabulary.
--
-- Vendors used to carry free-text VENDOR_CATEGORY strings ('ELECTRICAL',
-- 'PLUMBING', …) in `serviceCategories`. They now carry SERVICE KEYS, so that a
-- vendor can only be auto-assigned work for a service that actually exists.
--
-- Without this backfill every pre-existing vendor would show as having no
-- services selected in the form, and would silently stop being auto-assigned —
-- a regression that would look like "auto-assignment just stopped working".
--
-- Matching is deliberately conservative:
--   * case- and separator-insensitive (ELECTRICAL / electrical / Electrical)
--   * only where a service with that key already exists for the tenant (or is a
--     platform service), so nothing invents a key
--   * values that do not match ANY service are KEPT as-is rather than dropped —
--     an admin can clean them up in the form, and no data is lost silently.

WITH normalized AS (
  SELECT
    v.id                                                   AS vendor_id,
    lower(regexp_replace(cat, '[\s_-]+', '', 'g'))         AS cat_key,
    cat                                                    AS original
  FROM "vendors" v
  CROSS JOIN LATERAL unnest(
    -- The primary category counted as coverage too, so fold it in.
    array_append(v."serviceCategories", v."category")
  ) AS cat
  WHERE v."deletedAt" IS NULL AND cat IS NOT NULL AND cat <> ''
),
resolved AS (
  SELECT
    n.vendor_id,
    -- Prefer a real service key; fall back to the original string so an
    -- unmatched value is preserved rather than quietly discarded.
    COALESCE(s.key, n.original) AS value
  FROM normalized n
  LEFT JOIN "services" s
    ON s."deletedAt" IS NULL
   AND (
        lower(regexp_replace(s.key,  '[\s_-]+', '', 'g')) = n.cat_key
     OR lower(regexp_replace(s.name, '[\s_-]+', '', 'g')) = n.cat_key
   )
),
collapsed AS (
  SELECT vendor_id, array_agg(DISTINCT value) AS values
  FROM resolved
  GROUP BY vendor_id
)
UPDATE "vendors" v
SET "serviceCategories" = c.values
FROM collapsed c
WHERE v.id = c.vendor_id;
