-- Ensure a primary partner can only have one association (one secondary)
CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_assoc_primary_unique ON partner_associations(primary_partner_id);
