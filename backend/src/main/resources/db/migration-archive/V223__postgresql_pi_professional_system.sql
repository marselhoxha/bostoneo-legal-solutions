-- V120__postgresql_pi_professional_system.sql
-- Professional Personal Injury Platform - Enhanced Data Model
-- Creates tables for comprehensive medical records, document tracking, and damage calculations

-- ============================================
-- 1. PI Medical Records Table
-- Detailed medical record tracking with ICD codes, procedures, and findings
-- ============================================
CREATE TABLE IF NOT EXISTS pi_medical_records (
    id BIGSERIAL PRIMARY KEY,
    case_id BIGINT NOT NULL,
    organization_id BIGINT NOT NULL,

    -- Provider Information
    provider_name VARCHAR(255) NOT NULL,
    provider_npi VARCHAR(20),
    provider_type VARCHAR(100),
    provider_address TEXT,
    provider_phone VARCHAR(50),
    provider_fax VARCHAR(50),

    -- Record Type & Dates
    record_type VARCHAR(50) NOT NULL, -- ER, Follow-up, Surgery, PT, Imaging, Lab, Consultation, etc.
    treatment_date DATE NOT NULL,
    treatment_end_date DATE,

    -- Clinical Information (JSONB for flexibility)
    diagnoses JSONB DEFAULT '[]'::jsonb, -- Array of {icd_code, description, primary: boolean}
    procedures JSONB DEFAULT '[]'::jsonb, -- Array of {cpt_code, description, units}

    -- Billing Information
    billed_amount DECIMAL(12, 2) DEFAULT 0,
    adjusted_amount DECIMAL(12, 2) DEFAULT 0,
    paid_amount DECIMAL(12, 2) DEFAULT 0,
    lien_holder VARCHAR(255),
    lien_amount DECIMAL(12, 2),

    -- Clinical Notes (AI-extractable fields)
    key_findings TEXT,
    treatment_provided TEXT,
    prognosis_notes TEXT,
    work_restrictions TEXT,
    follow_up_recommendations TEXT,

    -- Completeness Tracking
    is_complete BOOLEAN DEFAULT FALSE,
    missing_elements JSONB DEFAULT '[]'::jsonb, -- Array of missing items

    -- Document Reference
    document_id BIGINT, -- Link to uploaded document if available

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,

    CONSTRAINT fk_pi_medical_records_case FOREIGN KEY (case_id)
        REFERENCES legal_cases(id) ON DELETE CASCADE,
    CONSTRAINT fk_pi_medical_records_organization FOREIGN KEY (organization_id)
        REFERENCES organizations(id) ON DELETE CASCADE
);

-- Indexes for pi_medical_records
CREATE INDEX idx_pi_medical_records_case_id ON pi_medical_records(case_id);
CREATE INDEX idx_pi_medical_records_organization_id ON pi_medical_records(organization_id);
CREATE INDEX idx_pi_medical_records_treatment_date ON pi_medical_records(treatment_date);
CREATE INDEX idx_pi_medical_records_provider_name ON pi_medical_records(provider_name);
CREATE INDEX idx_pi_medical_records_record_type ON pi_medical_records(record_type);

-- ============================================
-- 2. PI Document Checklist Table
-- Required document tracking for case preparation
-- ============================================
CREATE TABLE IF NOT EXISTS pi_document_checklist (
    id BIGSERIAL PRIMARY KEY,
    case_id BIGINT NOT NULL,
    organization_id BIGINT NOT NULL,

    -- Document Information
    document_type VARCHAR(100) NOT NULL, -- Police Report, Medical Records, Bills, Wage Docs, Insurance, Photos, etc.
    document_subtype VARCHAR(100), -- Specific subtype (e.g., "ER Records", "MRI Films")
    provider_name VARCHAR(255), -- Associated provider for medical docs

    -- Status Tracking
    required BOOLEAN DEFAULT TRUE,
    received BOOLEAN DEFAULT FALSE,
    received_date DATE,
    status VARCHAR(50) DEFAULT 'MISSING', -- MISSING, PENDING, RECEIVED, NOT_APPLICABLE, REQUESTED

    -- Request Tracking
    requested_date DATE,
    request_sent_to VARCHAR(255),
    follow_up_date DATE,
    follow_up_count INTEGER DEFAULT 0,

    -- Document Reference
    document_id BIGINT, -- Link to uploaded document when received

    -- Notes
    notes TEXT,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,

    CONSTRAINT fk_pi_document_checklist_case FOREIGN KEY (case_id)
        REFERENCES legal_cases(id) ON DELETE CASCADE,
    CONSTRAINT fk_pi_document_checklist_organization FOREIGN KEY (organization_id)
        REFERENCES organizations(id) ON DELETE CASCADE
);

-- Indexes for pi_document_checklist
CREATE INDEX idx_pi_document_checklist_case_id ON pi_document_checklist(case_id);
CREATE INDEX idx_pi_document_checklist_organization_id ON pi_document_checklist(organization_id);
CREATE INDEX idx_pi_document_checklist_status ON pi_document_checklist(status);
CREATE INDEX idx_pi_document_checklist_document_type ON pi_document_checklist(document_type);

-- ============================================
-- 3. PI Damage Elements Table
-- Structured damage calculations with supporting documentation
-- ============================================
CREATE TABLE IF NOT EXISTS pi_damage_elements (
    id BIGSERIAL PRIMARY KEY,
    case_id BIGINT NOT NULL,
    organization_id BIGINT NOT NULL,

    -- Damage Category
    element_type VARCHAR(50) NOT NULL, -- PAST_MEDICAL, FUTURE_MEDICAL, LOST_WAGES, EARNING_CAPACITY, HOUSEHOLD_SERVICES, PAIN_SUFFERING, MILEAGE, OTHER
    element_name VARCHAR(255) NOT NULL, -- Descriptive name (e.g., "Boston Medical ER", "2024 Lost Wages")

    -- Calculation Details
    calculation_method VARCHAR(100), -- Multiplier, Per Diem, Actual, Projection, etc.
    base_amount DECIMAL(12, 2) DEFAULT 0,
    multiplier DECIMAL(6, 2),
    duration_value DECIMAL(10, 2), -- For per diem or duration-based calcs
    duration_unit VARCHAR(20), -- Days, Weeks, Months, Years
    calculated_amount DECIMAL(12, 2) NOT NULL,

    -- Confidence & Documentation
    confidence_level VARCHAR(20) DEFAULT 'MEDIUM', -- HIGH, MEDIUM, LOW
    confidence_notes TEXT,
    supporting_documents JSONB DEFAULT '[]'::jsonb, -- Array of document IDs or descriptions

    -- Source Information
    source_provider VARCHAR(255), -- For medical expenses
    source_employer VARCHAR(255), -- For wage loss
    source_date DATE,

    -- Notes
    notes TEXT,
    legal_authority TEXT, -- Case law or statutory support

    -- Display Order
    display_order INTEGER DEFAULT 0,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,

    CONSTRAINT fk_pi_damage_elements_case FOREIGN KEY (case_id)
        REFERENCES legal_cases(id) ON DELETE CASCADE,
    CONSTRAINT fk_pi_damage_elements_organization FOREIGN KEY (organization_id)
        REFERENCES organizations(id) ON DELETE CASCADE
);

-- Indexes for pi_damage_elements
CREATE INDEX idx_pi_damage_elements_case_id ON pi_damage_elements(case_id);
CREATE INDEX idx_pi_damage_elements_organization_id ON pi_damage_elements(organization_id);
CREATE INDEX idx_pi_damage_elements_element_type ON pi_damage_elements(element_type);

-- ============================================
-- 4. PI Medical Summaries Table
-- AI-generated medical summary storage
-- ============================================
CREATE TABLE IF NOT EXISTS pi_medical_summaries (
    id BIGSERIAL PRIMARY KEY,
    case_id BIGINT NOT NULL,
    organization_id BIGINT NOT NULL,

    -- Summary Content
    treatment_chronology TEXT, -- Markdown formatted chronology
    provider_summary JSONB DEFAULT '[]'::jsonb, -- Array of provider summaries
    diagnosis_list JSONB DEFAULT '[]'::jsonb, -- Array of diagnoses with ICD codes
    red_flags JSONB DEFAULT '[]'::jsonb, -- Array of identified issues
    missing_records JSONB DEFAULT '[]'::jsonb, -- Array of potentially missing records
    key_highlights TEXT, -- Key findings summary
    prognosis_assessment TEXT, -- MMI, permanent impairment, future treatment

    -- Metrics
    total_providers INTEGER DEFAULT 0,
    total_visits INTEGER DEFAULT 0,
    total_billed DECIMAL(12, 2) DEFAULT 0,
    treatment_duration_days INTEGER DEFAULT 0,
    treatment_gap_days INTEGER DEFAULT 0,

    -- Completeness Score
    completeness_score INTEGER DEFAULT 0, -- 0-100
    completeness_notes TEXT,

    -- Generation Info
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    generated_by_model VARCHAR(100),
    last_record_date DATE, -- Last medical record included in summary
    is_stale BOOLEAN DEFAULT FALSE, -- True if new records added since generation

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_pi_medical_summaries_case FOREIGN KEY (case_id)
        REFERENCES legal_cases(id) ON DELETE CASCADE,
    CONSTRAINT fk_pi_medical_summaries_organization FOREIGN KEY (organization_id)
        REFERENCES organizations(id) ON DELETE CASCADE
);

-- Indexes for pi_medical_summaries
CREATE INDEX idx_pi_medical_summaries_case_id ON pi_medical_summaries(case_id);
CREATE INDEX idx_pi_medical_summaries_organization_id ON pi_medical_summaries(organization_id);

-- ============================================
-- 5. PI Damage Calculations Table (Summary)
-- Overall damage calculation results
-- ============================================
CREATE TABLE IF NOT EXISTS pi_damage_calculations (
    id BIGSERIAL PRIMARY KEY,
    case_id BIGINT NOT NULL,
    organization_id BIGINT NOT NULL,

    -- Damage Totals by Category
    past_medical_total DECIMAL(12, 2) DEFAULT 0,
    future_medical_total DECIMAL(12, 2) DEFAULT 0,
    lost_wages_total DECIMAL(12, 2) DEFAULT 0,
    earning_capacity_total DECIMAL(12, 2) DEFAULT 0,
    household_services_total DECIMAL(12, 2) DEFAULT 0,
    pain_suffering_total DECIMAL(12, 2) DEFAULT 0,
    mileage_total DECIMAL(12, 2) DEFAULT 0,
    other_damages_total DECIMAL(12, 2) DEFAULT 0,

    -- Summary Amounts
    economic_damages_total DECIMAL(12, 2) DEFAULT 0,
    non_economic_damages_total DECIMAL(12, 2) DEFAULT 0,
    gross_damages_total DECIMAL(12, 2) DEFAULT 0,

    -- Adjustments
    comparative_negligence_percent INTEGER DEFAULT 0,
    adjusted_damages_total DECIMAL(12, 2) DEFAULT 0,

    -- Value Range
    low_value DECIMAL(12, 2),
    mid_value DECIMAL(12, 2),
    high_value DECIMAL(12, 2),

    -- AI Comparable Analysis
    comparable_analysis JSONB, -- AI-generated comparison data

    -- Calculation Info
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    calculation_notes TEXT,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_pi_damage_calculations_case FOREIGN KEY (case_id)
        REFERENCES legal_cases(id) ON DELETE CASCADE,
    CONSTRAINT fk_pi_damage_calculations_organization FOREIGN KEY (organization_id)
        REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT uq_pi_damage_calculations_case UNIQUE (case_id)
);

-- Indexes for pi_damage_calculations
CREATE INDEX idx_pi_damage_calculations_case_id ON pi_damage_calculations(case_id);
CREATE INDEX idx_pi_damage_calculations_organization_id ON pi_damage_calculations(organization_id);

-- ============================================
-- Comments
-- ============================================
COMMENT ON TABLE pi_medical_records IS 'Detailed medical record tracking for PI cases with ICD codes and clinical data';
COMMENT ON TABLE pi_document_checklist IS 'Required document tracking and completeness checklist for PI case preparation';
COMMENT ON TABLE pi_damage_elements IS 'Individual damage element calculations with supporting documentation';
COMMENT ON TABLE pi_medical_summaries IS 'AI-generated comprehensive medical summaries for PI cases';
COMMENT ON TABLE pi_damage_calculations IS 'Overall damage calculation summary with case value ranges';
