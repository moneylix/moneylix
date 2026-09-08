-- 013: Store IFSC code and branch name for connected bank accounts
-- (used by manually-added accounts and shown for AA-linked accounts when available)

ALTER TABLE bank_connections ADD COLUMN ifsc_code TEXT;
ALTER TABLE bank_connections ADD COLUMN branch_name TEXT;
