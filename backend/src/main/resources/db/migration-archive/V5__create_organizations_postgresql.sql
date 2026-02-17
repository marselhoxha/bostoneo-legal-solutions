-- ============================================
-- V5: Create Organizations Table (PostgreSQL)
-- Multi-Tenant Foundation
-- ============================================

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id BIGSERIAL PRIMARY KEY,

    -- Basic Info
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    logo_url VARCHAR(500),
    website VARCHAR(255),
    email VARCHAR(100),
    phone VARCHAR(30),
    address TEXT,

    -- Subscription/Plan
    plan_type VARCHAR(20) DEFAULT 'FREE',
    plan_expires_at TIMESTAMP,

    -- Twilio Subaccount Settings
    twilio_subaccount_sid VARCHAR(50),
    twilio_auth_token_encrypted VARCHAR(255),
    twilio_phone_number VARCHAR(20),
    twilio_whatsapp_number VARCHAR(20),
    twilio_friendly_name VARCHAR(100),
    twilio_enabled BOOLEAN DEFAULT FALSE,
    twilio_provisioned_at TIMESTAMP,

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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_org_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_org_plan ON organizations(plan_type);

-- Insert default organization for existing data
INSERT INTO organizations (id, name, slug, plan_type, email)
VALUES (1, 'Default Organization', 'default', 'PROFESSIONAL', 'admin@bostoneo.com')
ON CONFLICT (id) DO NOTHING;

-- Reset sequence to continue after id=1
SELECT setval('organizations_id_seq', COALESCE((SELECT MAX(id) FROM organizations), 1));

-- ============================================
-- Organization Invitations Table
-- For inviting team members
-- ============================================

CREATE TABLE IF NOT EXISTS organization_invitations (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'USER',
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    accepted_at TIMESTAMP,
    created_by BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_invitation_organization FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT fk_invitation_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for invitations
CREATE INDEX IF NOT EXISTS idx_invitation_token ON organization_invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitation_email ON organization_invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitation_org ON organization_invitations(organization_id);
