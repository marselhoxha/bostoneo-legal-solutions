-- AI Legal Templates System Migration
-- Version: V62
-- Description: Creates tables for AI-powered document generation and template management

-- AI Legal Templates - Core template storage
CREATE TABLE ai_legal_templates (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category ENUM(
        'MOTION', 'BRIEF', 'PLEADING', 'CONTRACT', 'CORRESPONDENCE', 
        'DISCOVERY', 'SETTLEMENT', 'COURT_FILING', 'INTERNAL_MEMO', 
        'CLIENT_ADVICE', 'RESEARCH_MEMO', 'OPINION_LETTER',
        'IMMIGRATION_FORM', 'FAMILY_LAW_FORM', 'CRIMINAL_MOTION',
        'REAL_ESTATE_DOC', 'PATENT_APPLICATION'
    ) NOT NULL,
    practice_area VARCHAR(100),
    jurisdiction VARCHAR(100) DEFAULT 'Massachusetts',
    ma_jurisdiction_specific BOOLEAN DEFAULT FALSE,
    document_type VARCHAR(100),
    template_content LONGTEXT,
    ai_prompt_structure TEXT,
    variable_mappings JSON,
    formatting_rules JSON,
    style_guide_id BIGINT,
    usage_count INT DEFAULT 0,
    success_rate DECIMAL(5,2) DEFAULT 0.00,
    average_rating DECIMAL(3,2) DEFAULT 0.00,
    is_public BOOLEAN DEFAULT FALSE,
    is_approved BOOLEAN DEFAULT FALSE,
    is_ma_certified BOOLEAN DEFAULT FALSE,
    firm_id BIGINT,
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_category (category),
    INDEX idx_practice_area (practice_area),
    INDEX idx_jurisdiction (jurisdiction),
    INDEX idx_ma_specific (ma_jurisdiction_specific),
    INDEX idx_usage_count (usage_count),
    INDEX idx_success_rate (success_rate)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- AI Template Variables - Variable definitions for templates
CREATE TABLE ai_template_variables (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    template_id BIGINT NOT NULL,
    variable_name VARCHAR(100) NOT NULL,
    display_name VARCHAR(150),
    variable_type ENUM('TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'EMAIL', 'PHONE', 'ADDRESS', 'CASE_REF', 'CLIENT_REF') NOT NULL,
    data_source ENUM('CASE_DATA', 'CLIENT_DATA', 'USER_INPUT', 'COMPUTED', 'LOOKUP') NOT NULL,
    source_field VARCHAR(100),
    validation_rules JSON,
    default_value TEXT,
    is_required BOOLEAN DEFAULT FALSE,
    is_computed BOOLEAN DEFAULT FALSE,
    computation_formula TEXT,
    display_order INT DEFAULT 0,
    help_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (template_id) REFERENCES ai_legal_templates(id) ON DELETE CASCADE,
    INDEX idx_template_variable (template_id, variable_name),
    INDEX idx_data_source (data_source)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- AI Style Guides - Firm-specific formatting and style rules
CREATE TABLE ai_style_guides (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    firm_id BIGINT,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    rules_json JSON,
    formatting_preferences JSON,
    citation_style ENUM('BLUEBOOK', 'MASSACHUSETTS', 'ALWD', 'CUSTOM') DEFAULT 'BLUEBOOK',
    terminology_preferences JSON,
    signature_blocks JSON,
    letterhead_template TEXT,
    footer_template TEXT,
    font_preferences JSON,
    margin_settings JSON,
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_firm_guide (firm_id),
    INDEX idx_default_guide (is_default),
    INDEX idx_citation_style (citation_style)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- AI Editing Sessions - Real-time collaborative editing
CREATE TABLE ai_editing_sessions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    file_id BIGINT UNSIGNED NOT NULL,
    template_id BIGINT,
    session_name VARCHAR(200),
    participants JSON,
    owner_id BIGINT NOT NULL,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP NULL,
    active_status ENUM('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED') DEFAULT 'ACTIVE',
    lock_status ENUM('UNLOCKED', 'LOCKED', 'READ_ONLY') DEFAULT 'UNLOCKED',
    locked_by BIGINT,
    current_content LONGTEXT,
    change_log JSON,
    ai_suggestions_enabled BOOLEAN DEFAULT TRUE,
    auto_save_interval INT DEFAULT 30,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (file_id) REFERENCES file_items(id) ON DELETE CASCADE,
    FOREIGN KEY (template_id) REFERENCES ai_legal_templates(id) ON DELETE SET NULL,
    INDEX idx_file_session (file_id),
    INDEX idx_active_sessions (active_status),
    INDEX idx_session_owner (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- AI Edit Suggestions - AI-powered editing suggestions
CREATE TABLE ai_edit_suggestions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    session_id BIGINT NOT NULL,
    suggested_by_ai BOOLEAN DEFAULT TRUE,
    suggested_by_user BIGINT,
    suggestion_type ENUM(
        'GRAMMAR', 'STYLE', 'LEGAL_ACCURACY', 'CITATION', 'FORMATTING',
        'STRUCTURE', 'CLARITY', 'COMPLIANCE', 'TEMPLATE_MATCH'
    ) NOT NULL,
    original_text TEXT,
    suggested_text TEXT,
    suggestion_explanation TEXT,
    position_start INT,
    position_end INT,
    confidence_score DECIMAL(3,2) DEFAULT 0.00,
    is_accepted BOOLEAN DEFAULT FALSE,
    is_rejected BOOLEAN DEFAULT FALSE,
    accepted_by BIGINT,
    accepted_at TIMESTAMP NULL,
    priority ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') DEFAULT 'MEDIUM',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (session_id) REFERENCES ai_editing_sessions(id) ON DELETE CASCADE,
    INDEX idx_session_suggestions (session_id),
    INDEX idx_suggestion_type (suggestion_type),
    INDEX idx_confidence (confidence_score),
    INDEX idx_pending_suggestions (is_accepted, is_rejected)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- AI Document Generation Log - Track all AI document generations
CREATE TABLE ai_document_generation_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    template_id BIGINT NOT NULL,
    case_id BIGINT UNSIGNED,
    generated_file_id BIGINT UNSIGNED,
    user_id BIGINT NOT NULL,
    generation_type ENUM('NEW_DOCUMENT', 'AUTO_FILL', 'TEMPLATE_MERGE', 'BATCH_GENERATE') NOT NULL,
    input_data JSON,
    variables_used JSON,
    ai_model_used VARCHAR(50),
    processing_time_ms INT,
    tokens_used INT,
    cost_estimate DECIMAL(8,4),
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    quality_score DECIMAL(3,2),
    user_rating INT,
    user_feedback TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (template_id) REFERENCES ai_legal_templates(id),
    FOREIGN KEY (case_id) REFERENCES legal_cases(id) ON DELETE SET NULL,
    FOREIGN KEY (generated_file_id) REFERENCES file_items(id) ON DELETE SET NULL,
    INDEX idx_template_usage (template_id),
    INDEX idx_case_generation (case_id),
    INDEX idx_user_generation (user_id),
    INDEX idx_generation_date (created_at),
    INDEX idx_success_rate (success),
    INDEX idx_model_usage (ai_model_used)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Insert default Massachusetts legal templates
INSERT INTO ai_legal_templates (name, description, category, practice_area, jurisdiction, ma_jurisdiction_specific, template_content, ai_prompt_structure, is_public, is_approved, is_ma_certified) VALUES 
('Massachusetts Civil Complaint', 'Standard civil complaint template for Massachusetts Superior Court', 'PLEADING', 'Civil Litigation', 'Massachusetts', TRUE, 
'COMMONWEALTH OF MASSACHUSETTS\n\n[COURT_NAME]\n\nCIVIL ACTION NO. [CASE_NUMBER]\n\n[PLAINTIFF_NAME],\n\tPlaintiff\n\nv.\n\n[DEFENDANT_NAME],\n\tDefendant\n\nCOMPLAINT\n\n[COMPLAINT_BODY]', 
'Generate a civil complaint for Massachusetts Superior Court with proper formatting and jurisdictional requirements', TRUE, TRUE, TRUE),

('Motion for Summary Judgment - MA', 'Motion for Summary Judgment under Mass. R. Civ. P. 56', 'MOTION', 'Civil Litigation', 'Massachusetts', TRUE,
'COMMONWEALTH OF MASSACHUSETTS\n\n[COURT_NAME]\n\nCIVIL ACTION NO. [CASE_NUMBER]\n\n[PLAINTIFF_NAME],\n\tPlaintiff\n\nv.\n\n[DEFENDANT_NAME],\n\tDefendant\n\nMOTION FOR SUMMARY JUDGMENT\n\n[MOTION_BODY]',
'Create a motion for summary judgment following Massachusetts Rules of Civil Procedure Rule 56', TRUE, TRUE, TRUE),

('Purchase and Sale Agreement - MA', 'Standard Massachusetts real estate purchase agreement', 'CONTRACT', 'Real Estate', 'Massachusetts', TRUE,
'MASSACHUSETTS PURCHASE AND SALE AGREEMENT\n\nProperty Address: [PROPERTY_ADDRESS]\nPurchase Price: [PURCHASE_PRICE]\nBuyer: [BUYER_NAME]\nSeller: [SELLER_NAME]\n\n[CONTRACT_TERMS]',
'Generate a Massachusetts-compliant real estate purchase and sale agreement', TRUE, TRUE, TRUE),

('Massachusetts Divorce Complaint', 'No-fault divorce complaint under M.G.L. c. 208', 'PLEADING', 'Family Law', 'Massachusetts', TRUE,
'COMMONWEALTH OF MASSACHUSETTS\n\nPROBATE AND FAMILY COURT\n\n[COUNTY] DIVISION\n\nDOCKET NO. [DOCKET_NUMBER]\n\n[PLAINTIFF_NAME],\n\tPlaintiff\n\nv.\n\n[DEFENDANT_NAME],\n\tDefendant\n\nCOMPLAINT FOR DIVORCE\n\n[DIVORCE_GROUNDS]',
'Create a Massachusetts divorce complaint following M.G.L. Chapter 208 requirements', TRUE, TRUE, TRUE),

('Immigration I-130 Petition', 'USCIS Form I-130 petition template', 'IMMIGRATION_FORM', 'Immigration', 'Federal', FALSE,
'I-130, Immigrant Petition for Alien Relative\n\nPetitioner Information:\nName: [PETITIONER_NAME]\nAddress: [PETITIONER_ADDRESS]\n\nBeneficiary Information:\nName: [BENEFICIARY_NAME]\nRelationship: [RELATIONSHIP]\n\n[FORM_CONTENT]',
'Generate USCIS Form I-130 petition with proper formatting and required information', TRUE, TRUE, FALSE);

-- Insert default style guide for Massachusetts firms
INSERT INTO ai_style_guides (name, description, citation_style, is_default, is_active, rules_json, formatting_preferences) VALUES 
('Massachusetts Legal Standard', 'Default style guide for Massachusetts legal documents', 'MASSACHUSETTS', TRUE, TRUE,
'{"citations": {"court_format": "Massachusetts format", "statute_format": "M.G.L. c. [chapter] § [section]"}, "formatting": {"margins": "1 inch all sides", "font": "Times New Roman 12pt", "line_spacing": "double"}}',
'{"font_family": "Times New Roman", "font_size": 12, "line_spacing": 2.0, "margins": {"top": 1, "bottom": 1, "left": 1, "right": 1}}');

-- Create indexes for performance
CREATE INDEX idx_templates_ma_specific ON ai_legal_templates(ma_jurisdiction_specific, is_approved);
CREATE INDEX idx_templates_practice_area ON ai_legal_templates(practice_area, category);
CREATE INDEX idx_generation_stats ON ai_document_generation_log(template_id, success, created_at);