-- PostgreSQL Migration: Add organization_id to remaining tables for multi-tenant isolation
-- Phase 7: Data Leakage Fix

-- Add organization_id to vendor table
ALTER TABLE vendor ADD COLUMN IF NOT EXISTS organization_id BIGINT;

-- Add organization_id to billing_rates table
ALTER TABLE billing_rates ADD COLUMN IF NOT EXISTS organization_id BIGINT;

-- Add organization_id to case_transfer_requests table
ALTER TABLE case_transfer_requests ADD COLUMN IF NOT EXISTS organization_id BIGINT;

-- Add organization_id to conflict_checks table
ALTER TABLE conflict_checks ADD COLUMN IF NOT EXISTS organization_id BIGINT;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_vendor_organization_id ON vendor(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_rates_organization_id ON billing_rates(organization_id);
CREATE INDEX IF NOT EXISTS idx_case_transfer_requests_organization_id ON case_transfer_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_conflict_checks_organization_id ON conflict_checks(organization_id);

-- Update existing records to use organization 1 as default (main organization)
UPDATE vendor SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE billing_rates SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE case_transfer_requests SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE conflict_checks SET organization_id = 1 WHERE organization_id IS NULL;
