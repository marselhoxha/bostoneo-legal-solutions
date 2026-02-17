-- PostgreSQL Migration: Add organization_id to appointment_requests and attorney_availability tables
-- This enables multi-tenant data isolation

-- Add organization_id column to appointment_requests
ALTER TABLE appointment_requests ADD COLUMN IF NOT EXISTS organization_id BIGINT;

-- Create index for tenant filtering
CREATE INDEX IF NOT EXISTS idx_appointment_requests_organization_id ON appointment_requests(organization_id);

-- Add organization_id column to attorney_availability
ALTER TABLE attorney_availability ADD COLUMN IF NOT EXISTS organization_id BIGINT;

-- Create index for tenant filtering
CREATE INDEX IF NOT EXISTS idx_attorney_availability_organization_id ON attorney_availability(organization_id);

-- Add organization_id column to communication_logs (if not already exists)
ALTER TABLE communication_logs ADD COLUMN IF NOT EXISTS organization_id BIGINT;

-- Create index for tenant filtering
CREATE INDEX IF NOT EXISTS idx_communication_logs_organization_id ON communication_logs(organization_id);
