-- ============================================
-- V116: Create Signature Tables for BoldSign Integration
-- ============================================

-- ============================================
-- SIGNATURE REQUESTS
-- ============================================
CREATE TABLE IF NOT EXISTS signature_requests (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    -- Multi-tenant
    organization_id BIGINT UNSIGNED NOT NULL,

    -- BoldSign reference
    boldsign_document_id VARCHAR(100) UNIQUE,

    -- Internal references
    case_id BIGINT UNSIGNED,
    client_id BIGINT UNSIGNED,
    document_id BIGINT UNSIGNED,

    -- Request details
    title VARCHAR(255) NOT NULL,
    message TEXT,
    file_name VARCHAR(255),
    file_url VARCHAR(500),

    -- Status
    status ENUM('DRAFT', 'SENT', 'VIEWED', 'PARTIALLY_SIGNED', 'SIGNED', 'COMPLETED', 'DECLINED', 'EXPIRED', 'VOIDED') DEFAULT 'DRAFT',

    -- Primary signer
    signer_name VARCHAR(100) NOT NULL,
    signer_email VARCHAR(100) NOT NULL,
    signer_phone VARCHAR(20),

    -- Additional signers (JSON array)
    additional_signers JSON,

    -- Reminder settings
    reminder_email BOOLEAN DEFAULT TRUE,
    reminder_sms BOOLEAN DEFAULT TRUE,
    reminder_whatsapp BOOLEAN DEFAULT FALSE,
    last_reminder_sent_at DATETIME,
    reminder_count INT DEFAULT 0,

    -- Timing
    expires_at DATETIME,
    sent_at DATETIME,
    viewed_at DATETIME,
    signed_at DATETIME,
    completed_at DATETIME,
    declined_at DATETIME,
    decline_reason VARCHAR(500),

    -- Tracking
    created_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,

    -- Signed document
    signed_document_url VARCHAR(500),

    INDEX idx_sig_org (organization_id),
    INDEX idx_sig_case (case_id),
    INDEX idx_sig_client (client_id),
    INDEX idx_sig_status (status),
    INDEX idx_sig_boldsign (boldsign_document_id),
    INDEX idx_sig_expires (expires_at),
    INDEX idx_sig_created_by (created_by)
);

-- ============================================
-- SIGNATURE AUDIT LOGS
-- ============================================
CREATE TABLE IF NOT EXISTS signature_audit_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    organization_id BIGINT UNSIGNED NOT NULL,
    signature_request_id BIGINT UNSIGNED NOT NULL,

    event_type VARCHAR(50) NOT NULL,
    event_data JSON,

    actor_type ENUM('SYSTEM', 'USER', 'SIGNER', 'WEBHOOK') NOT NULL,
    actor_id BIGINT UNSIGNED,
    actor_name VARCHAR(100),
    actor_email VARCHAR(100),

    -- Communication channel
    channel ENUM('EMAIL', 'SMS', 'WHATSAPP', 'WEB', 'API') DEFAULT 'WEB',

    ip_address VARCHAR(45),
    user_agent VARCHAR(500),

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_audit_org (organization_id),
    INDEX idx_audit_request (signature_request_id),
    INDEX idx_audit_event (event_type),
    INDEX idx_audit_created (created_at),

    FOREIGN KEY (signature_request_id) REFERENCES signature_requests(id) ON DELETE CASCADE
);

-- ============================================
-- SIGNATURE TEMPLATES
-- ============================================
CREATE TABLE IF NOT EXISTS signature_templates (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    organization_id BIGINT UNSIGNED NOT NULL,

    boldsign_template_id VARCHAR(100),

    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50),

    file_name VARCHAR(255),
    file_url VARCHAR(500),
    field_config JSON,

    -- Default settings
    default_expiry_days INT DEFAULT 30,
    default_reminder_email BOOLEAN DEFAULT TRUE,
    default_reminder_sms BOOLEAN DEFAULT TRUE,

    is_active BOOLEAN DEFAULT TRUE,
    is_global BOOLEAN DEFAULT FALSE,

    created_by BIGINT UNSIGNED NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_template_org (organization_id),
    INDEX idx_template_category (category),
    INDEX idx_template_active (is_active)
);

-- ============================================
-- SIGNATURE REMINDER QUEUE
-- ============================================
CREATE TABLE IF NOT EXISTS signature_reminder_queue (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    organization_id BIGINT UNSIGNED NOT NULL,
    signature_request_id BIGINT UNSIGNED NOT NULL,

    channel ENUM('EMAIL', 'SMS', 'WHATSAPP') NOT NULL,
    scheduled_at DATETIME NOT NULL,

    status ENUM('PENDING', 'SENT', 'FAILED', 'CANCELLED') DEFAULT 'PENDING',
    sent_at DATETIME,
    error_message VARCHAR(500),

    communication_log_id BIGINT UNSIGNED,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_reminder_scheduled (scheduled_at, status),
    INDEX idx_reminder_request (signature_request_id),

    FOREIGN KEY (signature_request_id) REFERENCES signature_requests(id) ON DELETE CASCADE
);

-- ============================================
-- DEFAULT TEMPLATES (Global)
-- ============================================
INSERT INTO signature_templates (organization_id, name, description, category, is_global, created_by) VALUES
(1, 'Retainer Agreement', 'Standard client retainer agreement for legal services', 'RETAINER', TRUE, 1),
(1, 'Non-Disclosure Agreement', 'Confidentiality agreement for sensitive matters', 'NDA', TRUE, 1),
(1, 'Settlement Agreement', 'Case settlement document template', 'SETTLEMENT', TRUE, 1),
(1, 'Consent Form', 'General consent and authorization form', 'CONSENT', TRUE, 1),
(1, 'Power of Attorney', 'Limited power of attorney document', 'POA', TRUE, 1),
(1, 'Fee Agreement', 'Legal fee structure and payment agreement', 'FEE', TRUE, 1),
(1, 'Medical Records Release', 'HIPAA compliant medical records release form', 'RELEASE', TRUE, 1),
(1, 'Representation Agreement', 'Agreement for legal representation', 'REPRESENTATION', TRUE, 1);
