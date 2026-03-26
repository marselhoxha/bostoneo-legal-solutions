-- Seed default invoice workflow rules for organizations that have none.
-- Only inserts if the organization has zero workflow rules.

-- Use a CTE to find orgs with no workflows
WITH orgs_without_workflows AS (
    SELECT o.id AS org_id
    FROM organizations o
    WHERE NOT EXISTS (SELECT 1 FROM invoice_workflow_rules r WHERE r.organization_id = o.id)
)
INSERT INTO invoice_workflow_rules (name, description, is_active, trigger_event, days_before_due, days_after_due, action_type, action_config, max_executions, organization_id, created_at, updated_at)
SELECT rules.name, rules.description, rules.is_active, rules.trigger_event, rules.days_before_due, rules.days_after_due, rules.action_type, rules.action_config, rules.max_executions, ow.org_id, NOW(), NOW()
FROM orgs_without_workflows ow
CROSS JOIN (VALUES
    ('Payment Reminder (7 days)', 'Send a payment reminder 7 days before the invoice due date', true, 'DAYS_BEFORE_DUE', 7, NULL::int, 'SEND_REMINDER', '{"reminderType": "UPCOMING_DUE", "template": "payment_reminder"}', 1),
    ('Payment Reminder (1 day)', 'Send a final payment reminder 1 day before the invoice due date', true, 'DAYS_BEFORE_DUE', 1, NULL::int, 'SEND_REMINDER', '{"reminderType": "FINAL_REMINDER", "template": "payment_reminder_urgent"}', 1),
    ('Auto-send New Invoices', 'Automatically email invoices to clients when created', true, 'CREATED', NULL::int, NULL::int, 'SEND_EMAIL', '{"template": "new_invoice"}', 1),
    ('Mark Overdue', 'Automatically mark invoices as overdue when past due date', true, 'DAYS_AFTER_DUE', NULL::int, 1, 'UPDATE_STATUS', '{"newStatus": "OVERDUE"}', 1),
    ('Overdue Notice', 'Send an overdue notice to the client 3 days after due date', true, 'DAYS_AFTER_DUE', NULL::int, 3, 'SEND_REMINDER', '{"reminderType": "OVERDUE_NOTICE", "template": "overdue_notice"}', 1),
    ('Apply Late Fee', 'Automatically apply a late fee 10 days after due date', false, 'DAYS_AFTER_DUE', NULL::int, 10, 'APPLY_LATE_FEE', '{"feePercentage": 1.5, "maxFee": 500}', 1),
    ('Payment Thank You', 'Send a thank you email when invoice is paid', true, 'STATUS_CHANGED', NULL::int, NULL::int, 'SEND_EMAIL', '{"triggerStatus": "PAID", "template": "payment_thank_you"}', 1)
) AS rules(name, description, is_active, trigger_event, days_before_due, days_after_due, action_type, action_config, max_executions);
