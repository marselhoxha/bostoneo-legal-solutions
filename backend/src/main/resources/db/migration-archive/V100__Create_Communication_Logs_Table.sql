-- Create communication_logs table for SMS, WhatsApp, Voice, and Email tracking
-- Essential for legal compliance and audit trail

CREATE TABLE IF NOT EXISTS communication_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NULL,
    client_id BIGINT UNSIGNED NULL,
    case_id BIGINT UNSIGNED NULL,
    appointment_id BIGINT UNSIGNED NULL,

    channel VARCHAR(20) NOT NULL COMMENT 'SMS, WHATSAPP, VOICE, EMAIL',
    direction VARCHAR(10) NOT NULL DEFAULT 'OUTBOUND' COMMENT 'INBOUND, OUTBOUND',

    to_address VARCHAR(100) NOT NULL COMMENT 'Recipient phone/email',
    from_address VARCHAR(100) NOT NULL COMMENT 'Sender phone/email',

    content TEXT NULL COMMENT 'Message content',
    subject VARCHAR(255) NULL COMMENT 'Email subject',

    status VARCHAR(20) NOT NULL DEFAULT 'QUEUED' COMMENT 'QUEUED, SENT, DELIVERED, FAILED, UNDELIVERED',
    twilio_sid VARCHAR(50) NULL COMMENT 'Twilio message SID',

    error_message VARCHAR(500) NULL,
    error_code VARCHAR(20) NULL,

    template_code VARCHAR(50) NULL COMMENT 'Template used if any',

    sent_by_user_id BIGINT UNSIGNED NULL,
    sent_by_user_name VARCHAR(100) NULL,

    duration_seconds INT NULL COMMENT 'For voice calls',
    cost DECIMAL(10, 4) NULL COMMENT 'Communication cost',
    cost_currency VARCHAR(3) DEFAULT 'USD',

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    delivered_at DATETIME NULL,
    updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_comm_user_id (user_id),
    INDEX idx_comm_client_id (client_id),
    INDEX idx_comm_case_id (case_id),
    INDEX idx_comm_channel (channel),
    INDEX idx_comm_created_at (created_at),
    INDEX idx_comm_twilio_sid (twilio_sid),
    INDEX idx_comm_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create SMS templates table
CREATE TABLE IF NOT EXISTS sms_templates (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE COMMENT 'Template identifier',
    name VARCHAR(100) NOT NULL COMMENT 'Display name',
    content TEXT NOT NULL COMMENT 'Template content with {{placeholders}}',
    category VARCHAR(50) NOT NULL DEFAULT 'GENERAL' COMMENT 'APPOINTMENT, CASE, PAYMENT, GENERAL',
    variables JSON NULL COMMENT 'Available variables for this template',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_sms_template_code (code),
    INDEX idx_sms_template_category (category),
    INDEX idx_sms_template_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default SMS templates
INSERT INTO sms_templates (code, name, content, category, variables) VALUES
('APPOINTMENT_REMINDER', 'Appointment Reminder',
 'Hi {{clientName}}, reminder: {{appointmentTitle}} on {{date}} at {{time}}. Please call us if you need to reschedule. - Bostoneo Legal',
 'APPOINTMENT', '["clientName", "appointmentTitle", "date", "time"]'),

('APPOINTMENT_CONFIRMED', 'Appointment Confirmation',
 'Hi {{clientName}}, your appointment "{{appointmentTitle}}" with {{attorneyName}} is confirmed for {{date}} at {{time}}. We look forward to seeing you! - Bostoneo Legal',
 'APPOINTMENT', '["clientName", "appointmentTitle", "attorneyName", "date", "time"]'),

('APPOINTMENT_CANCELLED', 'Appointment Cancellation',
 'Hi {{clientName}}, your appointment "{{appointmentTitle}}" has been cancelled. {{reason}} Please contact us to reschedule. - Bostoneo Legal',
 'APPOINTMENT', '["clientName", "appointmentTitle", "reason"]'),

('APPOINTMENT_RESCHEDULE', 'Appointment Rescheduled',
 'Hi {{clientName}}, your appointment has been rescheduled to {{date}} at {{time}}. Please confirm or call us. - Bostoneo Legal',
 'APPOINTMENT', '["clientName", "date", "time"]'),

('CASE_UPDATE', 'Case Status Update',
 'Hi {{clientName}}, update on your case #{{caseNumber}}: {{message}}. Log in to your portal for details. - Bostoneo Legal',
 'CASE', '["clientName", "caseNumber", "message"]'),

('CASE_DOCUMENT_READY', 'Document Ready',
 'Hi {{clientName}}, a new document for case #{{caseNumber}} is ready for your review. Log in to view. - Bostoneo Legal',
 'CASE', '["clientName", "caseNumber"]'),

('PAYMENT_RECEIVED', 'Payment Confirmation',
 'Hi {{clientName}}, we received your payment of {{amount}}. Thank you! Reference: {{reference}}. - Bostoneo Legal',
 'PAYMENT', '["clientName", "amount", "reference"]'),

('PAYMENT_REMINDER', 'Payment Reminder',
 'Hi {{clientName}}, this is a reminder about your outstanding balance of {{amount}} for invoice #{{invoiceNumber}}. - Bostoneo Legal',
 'PAYMENT', '["clientName", "amount", "invoiceNumber"]'),

('DOCUMENT_SIGNATURE_REQUEST', 'Signature Request',
 'Hi {{clientName}}, a document requires your signature. Please log in to your portal to review and sign. - Bostoneo Legal',
 'DOCUMENT', '["clientName"]'),

('GENERAL_MESSAGE', 'General Message',
 '{{message}} - Bostoneo Legal',
 'GENERAL', '["message"]');

-- Note: sms_enabled column is added to user_notification_preferences
-- The model has been updated with the field. If migration fails, run manually:
-- ALTER TABLE user_notification_preferences ADD COLUMN sms_enabled BOOLEAN NOT NULL DEFAULT TRUE AFTER push_enabled;
