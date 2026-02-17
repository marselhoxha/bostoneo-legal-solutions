-- Create Invoice Workflow Rules table
CREATE TABLE IF NOT EXISTS invoice_workflow_rules (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Trigger conditions
    trigger_event VARCHAR(50) NOT NULL, -- CREATED, STATUS_CHANGED, OVERDUE, PAYMENT_RECEIVED
    trigger_status VARCHAR(20), -- Target status for STATUS_CHANGED events
    days_before_due INT, -- For reminder workflows
    days_after_due INT, -- For overdue workflows
    
    -- Actions
    action_type VARCHAR(50) NOT NULL, -- SEND_EMAIL, UPDATE_STATUS, CREATE_REMINDER, APPLY_LATE_FEE
    action_config JSON, -- Configuration for the action (email template, status to set, etc.)
    
    -- Execution settings
    execution_time TIME, -- Specific time to run (for scheduled workflows)
    max_executions INT DEFAULT 1, -- Maximum times to execute per invoice
    
    -- Metadata
    created_by BIGINT UNSIGNED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    PRIMARY KEY (id),
    INDEX idx_workflow_active (is_active),
    INDEX idx_workflow_trigger (trigger_event, is_active),
    CONSTRAINT fk_workflow_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create Invoice Workflow Executions table (track workflow runs)
CREATE TABLE IF NOT EXISTS invoice_workflow_executions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    workflow_rule_id BIGINT UNSIGNED NOT NULL,
    invoice_id BIGINT UNSIGNED NOT NULL,
    
    -- Execution details
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL, -- SUCCESS, FAILED, SKIPPED
    result_message TEXT,
    
    PRIMARY KEY (id),
    CONSTRAINT fk_execution_workflow FOREIGN KEY (workflow_rule_id) REFERENCES invoice_workflow_rules(id) ON DELETE CASCADE,
    CONSTRAINT fk_execution_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    INDEX idx_execution_invoice (invoice_id),
    INDEX idx_execution_workflow (workflow_rule_id),
    INDEX idx_execution_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create Invoice Reminders table
CREATE TABLE IF NOT EXISTS invoice_reminders (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    invoice_id BIGINT UNSIGNED NOT NULL,
    
    -- Reminder details
    reminder_type VARCHAR(50) NOT NULL, -- DUE_SOON, OVERDUE, PAYMENT_RECEIVED, CUSTOM
    scheduled_date DATE NOT NULL,
    scheduled_time TIME,
    
    -- Status
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, SENT, CANCELLED
    sent_at TIMESTAMP NULL,
    
    -- Content
    subject VARCHAR(255),
    message TEXT,
    recipients JSON, -- Array of email addresses
    
    -- Metadata
    created_by_workflow BIGINT UNSIGNED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    PRIMARY KEY (id),
    CONSTRAINT fk_reminder_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    CONSTRAINT fk_reminder_workflow FOREIGN KEY (created_by_workflow) REFERENCES invoice_workflow_rules(id) ON DELETE SET NULL,
    INDEX idx_reminder_invoice (invoice_id),
    INDEX idx_reminder_status (status, scheduled_date),
    INDEX idx_reminder_scheduled (scheduled_date, scheduled_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default workflow rules
INSERT INTO invoice_workflow_rules (name, description, trigger_event, action_type, action_config, is_active) VALUES
-- Auto-send invoice when created
('Auto-send New Invoices', 'Automatically email invoice to client when created', 'CREATED', 'SEND_EMAIL', 
 JSON_OBJECT(
    'email_template', 'invoice_created',
    'send_to_client', true,
    'attach_pdf', true
 ), TRUE),

-- Payment reminder 7 days before due
('Payment Reminder - 7 Days', 'Send payment reminder 7 days before due date', 'SCHEDULED', 'SEND_EMAIL',
 JSON_OBJECT(
    'email_template', 'payment_reminder',
    'days_before_due', 7,
    'send_to_client', true
 ), TRUE),

-- Payment reminder 1 day before due
('Payment Reminder - 1 Day', 'Send payment reminder 1 day before due date', 'SCHEDULED', 'SEND_EMAIL',
 JSON_OBJECT(
    'email_template', 'payment_reminder_urgent',
    'days_before_due', 1,
    'send_to_client', true
 ), TRUE),

-- Mark as overdue
('Mark Overdue Invoices', 'Automatically mark invoices as overdue after due date', 'SCHEDULED', 'UPDATE_STATUS',
 JSON_OBJECT(
    'new_status', 'OVERDUE',
    'days_after_due', 1,
    'condition_status', JSON_ARRAY('ISSUED', 'PENDING')
 ), TRUE),

-- Overdue notice
('Overdue Notice', 'Send overdue notice 3 days after due date', 'SCHEDULED', 'SEND_EMAIL',
 JSON_OBJECT(
    'email_template', 'overdue_notice',
    'days_after_due', 3,
    'send_to_client', true,
    'cc_accounting', true
 ), TRUE),

-- Apply late fee
('Apply Late Fee', 'Apply 1.5% late fee 10 days after due date', 'SCHEDULED', 'APPLY_LATE_FEE',
 JSON_OBJECT(
    'fee_percentage', 1.5,
    'days_after_due', 10,
    'fee_description', 'Late payment fee (1.5%)',
    'max_fee_amount', 500.00
 ), TRUE),

-- Thank you for payment
('Payment Thank You', 'Send thank you email when payment is received', 'STATUS_CHANGED', 'SEND_EMAIL',
 JSON_OBJECT(
    'email_template', 'payment_received',
    'trigger_status', 'PAID',
    'send_to_client', true
 ), TRUE);

-- Update workflow rules with proper scheduling
UPDATE invoice_workflow_rules 
SET days_before_due = 7, execution_time = '09:00:00'
WHERE name = 'Payment Reminder - 7 Days';

UPDATE invoice_workflow_rules 
SET days_before_due = 1, execution_time = '09:00:00'
WHERE name = 'Payment Reminder - 1 Day';

UPDATE invoice_workflow_rules 
SET days_after_due = 1, execution_time = '00:01:00'
WHERE name = 'Mark Overdue Invoices';

UPDATE invoice_workflow_rules 
SET days_after_due = 3, execution_time = '09:00:00'
WHERE name = 'Overdue Notice';

UPDATE invoice_workflow_rules 
SET days_after_due = 10, execution_time = '00:01:00'
WHERE name = 'Apply Late Fee';

-- Create stored procedure to process scheduled workflows
DELIMITER $$

CREATE PROCEDURE process_scheduled_workflows()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE rule_id BIGINT;
    DECLARE rule_action_type VARCHAR(50);
    DECLARE rule_config JSON;
    DECLARE days_before INT;
    DECLARE days_after INT;
    
    DECLARE cur CURSOR FOR 
        SELECT id, action_type, action_config, days_before_due, days_after_due
        FROM invoice_workflow_rules
        WHERE is_active = TRUE 
        AND trigger_event = 'SCHEDULED'
        AND (execution_time IS NULL OR TIME(NOW()) >= execution_time);
        
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    OPEN cur;
    
    read_loop: LOOP
        FETCH cur INTO rule_id, rule_action_type, rule_config, days_before, days_after;
        IF done THEN
            LEAVE read_loop;
        END IF;
        
        -- Process invoices based on workflow conditions
        IF days_before IS NOT NULL THEN
            -- Handle before due date workflows
            INSERT INTO invoice_reminders (invoice_id, reminder_type, scheduled_date, subject, message, created_by_workflow)
            SELECT 
                i.id,
                'DUE_SOON',
                CURDATE(),
                CONCAT('Payment Reminder: Invoice ', i.invoice_number, ' due in ', days_before, ' days'),
                CONCAT('Your invoice ', i.invoice_number, ' for $', FORMAT(i.total_amount, 2), ' is due in ', days_before, ' days.'),
                rule_id
            FROM invoices i
            LEFT JOIN invoice_workflow_executions e ON e.invoice_id = i.id AND e.workflow_rule_id = rule_id
            WHERE i.status IN ('ISSUED', 'PENDING')
            AND i.due_date = DATE_ADD(CURDATE(), INTERVAL days_before DAY)
            AND e.id IS NULL; -- Not already executed
            
        ELSEIF days_after IS NOT NULL THEN
            -- Handle after due date workflows
            IF rule_action_type = 'UPDATE_STATUS' THEN
                -- Update overdue invoices
                UPDATE invoices 
                SET status = 'OVERDUE'
                WHERE status IN ('ISSUED', 'PENDING')
                AND due_date < CURDATE()
                AND DATEDIFF(CURDATE(), due_date) >= days_after;
            END IF;
        END IF;
        
        -- Log executions
        INSERT INTO invoice_workflow_executions (workflow_rule_id, invoice_id, status, result_message)
        SELECT rule_id, id, 'SUCCESS', 'Workflow executed successfully'
        FROM invoices
        WHERE id IN (
            SELECT invoice_id FROM invoice_reminders 
            WHERE created_by_workflow = rule_id 
            AND created_at >= DATE_SUB(NOW(), INTERVAL 1 MINUTE)
        );
        
    END LOOP;
    
    CLOSE cur;
END$$

DELIMITER ;

-- Create event scheduler to run workflows
SET GLOBAL event_scheduler = ON;

DROP EVENT IF EXISTS run_invoice_workflows;

CREATE EVENT run_invoice_workflows
ON SCHEDULE EVERY 1 HOUR
DO CALL process_scheduled_workflows();