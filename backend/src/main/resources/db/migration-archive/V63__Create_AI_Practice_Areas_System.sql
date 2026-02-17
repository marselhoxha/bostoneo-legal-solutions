-- AI Practice Areas System Migration
-- Version: V63
-- Description: Creates tables for specialized practice area modules (Immigration, Family Law, Criminal Defense, Real Estate, Patent)

-- Immigration Cases and Forms
CREATE TABLE ai_immigration_cases (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    case_id BIGINT UNSIGNED,
    uscis_case_number VARCHAR(50),
    receipt_number VARCHAR(20),
    form_type VARCHAR(20) NOT NULL,
    petitioner_name VARCHAR(200) NOT NULL,
    beneficiary_name VARCHAR(200) NOT NULL,
    relationship VARCHAR(100),
    priority_date DATE,
    receipt_date DATE,
    notice_date DATE,
    status ENUM(
        'PREPARATION', 'FILED', 'RECEIVED', 'IN_REVIEW', 'RFE_ISSUED', 'RFE_RESPONDED',
        'INTERVIEW_SCHEDULED', 'APPROVED', 'DENIED', 'WITHDRAWN', 'TERMINATED'
    ) DEFAULT 'PREPARATION',
    service_center VARCHAR(100),
    processing_time_estimate INT, -- in days
    next_action_date DATE,
    next_action_description TEXT,
    case_notes TEXT,
    documents_checklist JSON,
    filing_fee DECIMAL(10,2),
    attorney_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (case_id) REFERENCES legal_cases(id) ON DELETE SET NULL,
    INDEX idx_uscis_case (uscis_case_number),
    INDEX idx_form_type (form_type),
    INDEX idx_status (status),
    INDEX idx_priority_date (priority_date),
    INDEX idx_next_action (next_action_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE ai_immigration_forms (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    form_number VARCHAR(20) NOT NULL,
    form_title VARCHAR(200) NOT NULL,
    form_category ENUM(
        'FAMILY_BASED', 'EMPLOYMENT_BASED', 'HUMANITARIAN', 'NATURALIZATION',
        'TEMPORARY_STATUS', 'ADJUSTMENT', 'WAIVER', 'APPEAL'
    ) NOT NULL,
    form_template LONGTEXT,
    required_documents JSON,
    filing_requirements JSON,
    processing_time_range VARCHAR(50),
    filing_fee DECIMAL(10,2),
    form_instructions TEXT,
    ai_assistance_prompts JSON,
    is_active BOOLEAN DEFAULT TRUE,
    last_updated DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_form_number (form_number),
    INDEX idx_form_category (form_category),
    INDEX idx_active_forms (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Family Law Calculations and Cases
CREATE TABLE ai_family_law_calculations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    case_id BIGINT UNSIGNED,
    calculation_type ENUM(
        'CHILD_SUPPORT', 'ALIMONY', 'PROPERTY_DIVISION', 'ATTORNEY_FEES'
    ) NOT NULL,
    ma_guidelines_version VARCHAR(20) DEFAULT '2021',
    input_parameters JSON NOT NULL,
    calculation_result JSON NOT NULL,
    gross_income_payor DECIMAL(12,2),
    gross_income_recipient DECIMAL(12,2),
    number_of_children INT,
    custody_percentage DECIMAL(5,2),
    calculated_amount DECIMAL(10,2),
    deviation_amount DECIMAL(10,2) DEFAULT 0.00,
    deviation_reason TEXT,
    effective_date DATE,
    review_date DATE,
    calculated_by BIGINT,
    verified_by BIGINT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (case_id) REFERENCES legal_cases(id) ON DELETE CASCADE,
    INDEX idx_case_calculations (case_id),
    INDEX idx_calculation_type (calculation_type),
    INDEX idx_effective_date (effective_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Criminal Defense Cases and Guidelines
CREATE TABLE ai_criminal_cases (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    case_id BIGINT UNSIGNED,
    docket_number VARCHAR(50),
    court_name VARCHAR(200),
    charge_codes JSON NOT NULL,
    primary_offense VARCHAR(200),
    offense_level ENUM('MISDEMEANOR', 'FELONY', 'VIOLATION', 'INFRACTION') NOT NULL,
    offense_class VARCHAR(10),
    max_penalty VARCHAR(200),
    prior_record_points INT DEFAULT 0,
    criminal_history JSON,
    sentencing_guidelines JSON,
    plea_offer JSON,
    plea_deadline DATE,
    trial_date DATE,
    discovery_deadline DATE,
    motion_deadlines JSON,
    bail_amount DECIMAL(10,2),
    bail_conditions TEXT,
    victim_information JSON,
    prosecutor_name VARCHAR(200),
    defense_strategy TEXT,
    case_strengths TEXT,
    case_weaknesses TEXT,
    potential_defenses JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (case_id) REFERENCES legal_cases(id) ON DELETE CASCADE,
    INDEX idx_docket_number (docket_number),
    INDEX idx_offense_level (offense_level),
    INDEX idx_trial_date (trial_date),
    INDEX idx_plea_deadline (plea_deadline)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE ai_ma_sentencing_guidelines (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    offense_code VARCHAR(20) NOT NULL,
    offense_description VARCHAR(500) NOT NULL,
    category VARCHAR(100),
    subcategory VARCHAR(100),
    statutory_citation VARCHAR(100),
    min_sentence VARCHAR(100),
    max_sentence VARCHAR(100),
    mandatory_minimum BOOLEAN DEFAULT FALSE,
    fine_range VARCHAR(100),
    points_value INT,
    eligibility_notes TEXT,
    recent_updates TEXT,
    effective_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_offense_code (offense_code),
    INDEX idx_category (category),
    INDEX idx_mandatory_minimum (mandatory_minimum),
    INDEX idx_points_value (points_value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Real Estate Transactions and Documents
CREATE TABLE ai_real_estate_transactions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    case_id BIGINT UNSIGNED,
    transaction_type ENUM(
        'PURCHASE', 'SALE', 'REFINANCE', 'COMMERCIAL', 'LEASE'
    ) NOT NULL,
    property_address TEXT NOT NULL,
    property_type ENUM('RESIDENTIAL', 'COMMERCIAL', 'LAND', 'CONDO', 'MULTI_FAMILY') NOT NULL,
    purchase_price DECIMAL(15,2),
    loan_amount DECIMAL(15,2),
    buyer_name VARCHAR(300),
    seller_name VARCHAR(300),
    lender_name VARCHAR(200),
    closing_date DATE,
    registry_of_deeds VARCHAR(100),
    book_page VARCHAR(50),
    lot_plan_info VARCHAR(200),
    title_company VARCHAR(200),
    closing_attorney VARCHAR(200),
    inspection_deadline DATE,
    mortgage_contingency_deadline DATE,
    purchase_and_sale_signed DATE,
    deed_type ENUM('WARRANTY', 'QUITCLAIM', 'FORECLOSURE', 'TAX') DEFAULT 'WARRANTY',
    title_issues JSON,
    special_conditions TEXT,
    closing_costs JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (case_id) REFERENCES legal_cases(id) ON DELETE CASCADE,
    INDEX idx_transaction_type (transaction_type),
    INDEX idx_property_type (property_type),
    INDEX idx_closing_date (closing_date),
    INDEX idx_registry (registry_of_deeds)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE ai_closing_documents (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    transaction_id BIGINT NOT NULL,
    document_type ENUM(
        'PURCHASE_SALE_AGREEMENT', 'DEED', 'MORTGAGE', 'NOTE', 'TITLE_INSURANCE',
        'SURVEY', 'INSPECTION_REPORT', 'APPRAISAL', 'INSURANCE_BINDER',
        'CLOSING_DISCLOSURE', 'DEED_CERTIFICATE', 'LIEN_WAIVER', 'AFFIDAVIT',
        'POWER_OF_ATTORNEY', 'IRS_FORMS', 'STATE_TAX_FORMS', 'MUNICIPAL_FORMS'
    ) NOT NULL,
    document_name VARCHAR(200),
    is_required BOOLEAN DEFAULT TRUE,
    completion_status ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'NOT_APPLICABLE') DEFAULT 'PENDING',
    responsible_party ENUM('BUYER', 'SELLER', 'LENDER', 'ATTORNEY', 'TITLE_COMPANY', 'OTHER') NOT NULL,
    due_date DATE,
    completion_date DATE,
    file_id BIGINT UNSIGNED,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (transaction_id) REFERENCES ai_real_estate_transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id) REFERENCES file_items(id) ON DELETE SET NULL,
    INDEX idx_transaction_docs (transaction_id),
    INDEX idx_document_type (document_type),
    INDEX idx_completion_status (completion_status),
    INDEX idx_due_date (due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Patent Analysis and Searches
CREATE TABLE ai_patent_searches (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    case_id BIGINT UNSIGNED,
    search_type ENUM(
        'PRIOR_ART', 'FREEDOM_TO_OPERATE', 'PATENTABILITY', 'INVALIDITY', 'INFRINGEMENT'
    ) NOT NULL,
    invention_title VARCHAR(300) NOT NULL,
    invention_description TEXT,
    search_terms JSON,
    search_databases JSON,
    search_strategy TEXT,
    search_results JSON,
    prior_art_references JSON,
    analysis_results TEXT,
    patentability_score DECIMAL(3,2),
    risk_assessment ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'),
    recommendations TEXT,
    search_date DATE,
    searcher_name VARCHAR(200),
    review_status ENUM('PENDING', 'IN_REVIEW', 'COMPLETED', 'REQUIRES_UPDATE') DEFAULT 'PENDING',
    search_cost DECIMAL(10,2),
    ai_analysis_confidence DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (case_id) REFERENCES legal_cases(id) ON DELETE CASCADE,
    INDEX idx_search_type (search_type),
    INDEX idx_risk_assessment (risk_assessment),
    INDEX idx_search_date (search_date),
    INDEX idx_review_status (review_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Massachusetts Court Rules and Statutes
CREATE TABLE ai_ma_court_rules (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    court_level ENUM(
        'SUPERIOR_COURT', 'DISTRICT_COURT', 'PROBATE_FAMILY', 'LAND_COURT', 
        'HOUSING_COURT', 'JUVENILE_COURT', 'APPEALS_COURT', 'SJC'
    ) NOT NULL,
    rule_number VARCHAR(20) NOT NULL,
    rule_title VARCHAR(300) NOT NULL,
    rule_text LONGTEXT NOT NULL,
    rule_category VARCHAR(100),
    effective_date DATE,
    last_amended DATE,
    deadlines_json JSON,
    related_statutes JSON,
    practice_notes TEXT,
    local_rules JSON,
    forms_required JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_court_level (court_level),
    INDEX idx_rule_number (rule_number),
    INDEX idx_rule_category (rule_category),
    INDEX idx_effective_date (effective_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE ai_ma_statutes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    chapter VARCHAR(10) NOT NULL,
    section VARCHAR(20) NOT NULL,
    title VARCHAR(500) NOT NULL,
    statute_text LONGTEXT NOT NULL,
    practice_area VARCHAR(100),
    keywords JSON,
    related_cases JSON,
    amendments_history JSON,
    effective_date DATE,
    last_updated DATE,
    citation_format VARCHAR(100),
    cross_references JSON,
    practice_notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_chapter_section (chapter, section),
    INDEX idx_chapter (chapter),
    INDEX idx_practice_area (practice_area),
    -- INDEX idx_keywords (keywords), -- JSON columns need generated columns for indexing
    FULLTEXT KEY ft_statute_text (statute_text, title)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- AI Research Cache for performance optimization
CREATE TABLE ai_research_cache (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    query_hash VARCHAR(64) NOT NULL,
    query_text TEXT NOT NULL,
    query_type ENUM(
        'CASE_LAW', 'STATUTE_INTERPRETATION', 'PRECEDENT_SEARCH', 'LEGAL_MEMO', 
        'CONTRACT_ANALYSIS', 'IMMIGRATION_RESEARCH', 'CRIMINAL_RESEARCH',
        'FAMILY_LAW_RESEARCH', 'REAL_ESTATE_RESEARCH', 'PATENT_RESEARCH'
    ) NOT NULL,
    jurisdiction VARCHAR(100),
    practice_area VARCHAR(100),
    ai_response LONGTEXT NOT NULL,
    ai_model_used VARCHAR(50),
    confidence_score DECIMAL(3,2),
    usage_count INT DEFAULT 1,
    last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    is_valid BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE KEY uk_query_hash (query_hash),
    INDEX idx_query_type (query_type),
    INDEX idx_jurisdiction (jurisdiction),
    INDEX idx_practice_area (practice_area),
    INDEX idx_last_used (last_used),
    INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- AI Usage Metrics for analytics and ROI tracking
CREATE TABLE ai_usage_metrics (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    case_id BIGINT UNSIGNED,
    feature_type ENUM(
        'DOCUMENT_GENERATION', 'LEGAL_RESEARCH', 'CONTRACT_ANALYSIS',
        'IMMIGRATION_ASSISTANCE', 'FAMILY_LAW_CALCULATION', 'CRIMINAL_ANALYSIS',
        'REAL_ESTATE_ASSISTANCE', 'PATENT_ANALYSIS', 'COLLABORATION',
        'TEMPLATE_USAGE', 'AI_SUGGESTIONS'
    ) NOT NULL,
    action_taken VARCHAR(200),
    time_saved_minutes INT,
    cost_estimate DECIMAL(10,4),
    tokens_used INT,
    ai_model_used VARCHAR(50),
    success_rate DECIMAL(3,2),
    user_satisfaction_rating INT, -- 1-5 scale
    efficiency_gain_percentage DECIMAL(5,2),
    error_count INT DEFAULT 0,
    session_duration_minutes INT,
    documents_processed INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (case_id) REFERENCES legal_cases(id) ON DELETE SET NULL,
    INDEX idx_user_metrics (user_id),
    INDEX idx_feature_type (feature_type),
    INDEX idx_case_metrics (case_id),
    INDEX idx_date_metrics (created_at),
    INDEX idx_efficiency (efficiency_gain_percentage)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Insert sample immigration forms
INSERT INTO ai_immigration_forms (form_number, form_title, form_category, filing_fee, form_instructions) VALUES
('I-130', 'Immigrant Petition for Alien Relative', 'FAMILY_BASED', 535.00, 'Use this form to petition for qualifying family members'),
('I-485', 'Application to Adjust Status to Permanent Resident', 'ADJUSTMENT', 1225.00, 'Apply for adjustment of status to permanent resident'),
('I-140', 'Immigrant Petition for Alien Workers', 'EMPLOYMENT_BASED', 700.00, 'Petition for employment-based immigration'),
('I-765', 'Application for Employment Authorization Document', 'TEMPORARY_STATUS', 410.00, 'Apply for work authorization'),
('N-400', 'Application for Naturalization', 'NATURALIZATION', 725.00, 'Apply for U.S. citizenship');

-- Insert sample Massachusetts court rules
INSERT INTO ai_ma_court_rules (court_level, rule_number, rule_title, rule_text, rule_category) VALUES
('SUPERIOR_COURT', 'Rule 9A', 'Appearance and Withdrawal of Counsel', 'An attorney may appear in a civil action by filing a notice of appearance...', 'REPRESENTATION'),
('SUPERIOR_COURT', 'Rule 56', 'Summary Judgment', 'A party may move for summary judgment upon all or any part of the claims...', 'MOTIONS'),
('DISTRICT_COURT', 'Rule 7', 'Process and Service', 'Process in civil actions shall be served as provided by law...', 'SERVICE');

-- Insert sample Massachusetts statutes
INSERT INTO ai_ma_statutes (chapter, section, title, statute_text, practice_area) VALUES
('93A', '2', 'Unfair or Deceptive Acts or Practices', 'Unfair methods of competition and unfair or deceptive acts or practices...', 'Consumer Protection'),
('231', '85K', 'Offers of Judgment', 'In any civil action in the superior court...', 'Civil Litigation'),
('208', '1A', 'Irretrievable Breakdown of Marriage', 'A divorce may be adjudged for irretrievable breakdown of the marriage...', 'Family Law');