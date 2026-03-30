-- V32: Drop trust accounting tables (feature removed, not in scope for current platform)
-- trust_account_transactions must be dropped first due to FK dependency on trust_accounts

DROP TABLE IF EXISTS trust_account_transactions;
DROP TABLE IF EXISTS trust_accounts;
