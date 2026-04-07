-- Fix audit_log entity_type check constraint to include all entity types
-- The original constraint was missing newer types (MEDICAL_RECORD, MEDICAL_SUMMARY, LEAD, etc.)

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_entity_type_check;

ALTER TABLE audit_log ADD CONSTRAINT audit_log_entity_type_check CHECK (
    entity_type IN (
        'CUSTOMER', 'CASE', 'LEGAL_CASE', 'DOCUMENT', 'INVOICE', 'USER',
        'APPOINTMENT', 'PAYMENT', 'EXPENSE', 'ROLE',
        'PERMISSION', 'EMAIL', 'CALENDAR_EVENT',
        'ORGANIZATION', 'INVITATION', 'CLIENT', 'TASK', 'NOTE',
        'ANALYTICS', 'SYSTEM', 'SECURITY', 'ANNOUNCEMENT', 'INTEGRATION', 'AUDIT_LOG', 'PLATFORM',
        'MEDICAL_RECORD', 'MEDICAL_SUMMARY', 'CONFLICT_CHECK', 'LEAD'
    )
);
