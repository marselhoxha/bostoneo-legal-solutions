-- ============================================
-- V115: Create Organizations Table (Multi-Tenant Foundation)
-- ============================================

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    -- Basic Info
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    logo_url VARCHAR(500),
    website VARCHAR(255),
    email VARCHAR(100),
    phone VARCHAR(30),
    address TEXT,

    -- Subscription/Plan
    plan_type ENUM('FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE') DEFAULT 'FREE',
    plan_expires_at DATETIME,

    -- Twilio Subaccount Settings
    twilio_subaccount_sid VARCHAR(50),
    twilio_auth_token_encrypted VARCHAR(255),
    twilio_phone_number VARCHAR(20),
    twilio_whatsapp_number VARCHAR(20),
    twilio_friendly_name VARCHAR(100),
    twilio_enabled BOOLEAN DEFAULT FALSE,
    twilio_provisioned_at DATETIME,

    -- BoldSign Settings
    boldsign_api_key_encrypted VARCHAR(255),
    boldsign_enabled BOOLEAN DEFAULT TRUE,
    boldsign_brand_id VARCHAR(100),

    -- Notification Preferences
    sms_enabled BOOLEAN DEFAULT TRUE,
    whatsapp_enabled BOOLEAN DEFAULT FALSE,
    email_enabled BOOLEAN DEFAULT TRUE,

    -- Signature Reminder Settings
    signature_reminder_email BOOLEAN DEFAULT TRUE,
    signature_reminder_sms BOOLEAN DEFAULT TRUE,
    signature_reminder_whatsapp BOOLEAN DEFAULT FALSE,
    signature_reminder_days VARCHAR(50) DEFAULT '7,3,1',

    -- SMS Templates (customizable per org)
    sms_template_signature_request TEXT,
    sms_template_signature_reminder TEXT,
    sms_template_signature_completed TEXT,

    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_org_slug (slug),
    INDEX idx_org_plan (plan_type)
);

-- Insert default organization for existing data
INSERT IGNORE INTO organizations (id, name, slug, plan_type, email) VALUES
(1, 'Default Organization', 'default', 'PROFESSIONAL', 'admin@bostoneo.com');

-- Add organization_id to Users table (use procedure to check if column exists)
DROP PROCEDURE IF EXISTS add_org_columns;
DELIMITER //
CREATE PROCEDURE add_org_columns()
BEGIN
    -- Users table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'bostoneosolutions' AND table_name = 'Users' AND column_name = 'organization_id') THEN
        ALTER TABLE Users ADD COLUMN organization_id BIGINT UNSIGNED AFTER id;
        CREATE INDEX idx_user_org ON Users(organization_id);
    END IF;

    -- clients table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'bostoneosolutions' AND table_name = 'clients' AND column_name = 'organization_id') THEN
        ALTER TABLE clients ADD COLUMN organization_id BIGINT UNSIGNED AFTER id;
        CREATE INDEX idx_client_org ON clients(organization_id);
    END IF;

    -- legal_cases table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'bostoneosolutions' AND table_name = 'legal_cases' AND column_name = 'organization_id') THEN
        ALTER TABLE legal_cases ADD COLUMN organization_id BIGINT UNSIGNED AFTER id;
        CREATE INDEX idx_case_org ON legal_cases(organization_id);
    END IF;

    -- communication_logs table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'bostoneosolutions' AND table_name = 'communication_logs' AND column_name = 'organization_id') THEN
        ALTER TABLE communication_logs ADD COLUMN organization_id BIGINT UNSIGNED AFTER id;
        CREATE INDEX idx_comm_org ON communication_logs(organization_id);
    END IF;
END //
DELIMITER ;

CALL add_org_columns();
DROP PROCEDURE IF EXISTS add_org_columns;

-- Update existing records to default organization
UPDATE Users SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE clients SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE legal_cases SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE communication_logs SET organization_id = 1 WHERE organization_id IS NULL;
