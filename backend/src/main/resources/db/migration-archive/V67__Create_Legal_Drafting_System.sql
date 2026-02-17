-- Legal Drafting System Tables
-- Created for AI-Powered Legal Document Drafting and Analysis

-- Document Upload and Storage
CREATE TABLE legal_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size BIGINT NOT NULL,
    content_hash VARCHAR(64), -- SHA-256 hash for deduplication
    extracted_text TEXT,
    encrypted_content BYTEA,
    metadata JSONB DEFAULT '{}',
    processing_status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, PROCESSING, COMPLETED, FAILED
    processing_errors TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP, -- For temporary document storage
    is_permanent BOOLEAN DEFAULT false,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Drafting Sessions for Q&A Workflows
CREATE TABLE drafting_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL,
    document_type VARCHAR(100) NOT NULL, -- INTERROGATORIES, OPPOSITION_BRIEF, MOTION_TO_DISMISS, etc.
    jurisdiction VARCHAR(100) NOT NULL, -- FEDERAL, MASSACHUSETTS, etc.
    workflow_type VARCHAR(100) NOT NULL, -- GUIDED_DRAFTING, QUICK_DRAFT, TEMPLATE_BASED
    session_status VARCHAR(50) DEFAULT 'ACTIVE', -- ACTIVE, COMPLETED, CANCELLED, EXPIRED
    workflow_state JSONB DEFAULT '{}', -- Current step, progress, etc.
    context_data JSONB DEFAULT '{}', -- Collected user responses and context
    current_step_index INTEGER DEFAULT 0,
    total_steps INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    expires_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP + INTERVAL '24 hours',
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Document Templates for Reusable Legal Documents
CREATE TABLE document_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    document_type VARCHAR(100) NOT NULL,
    jurisdiction VARCHAR(100) NOT NULL,
    category VARCHAR(100),
    content TEXT NOT NULL,
    variables JSONB DEFAULT '{}', -- Template variable definitions
    is_public BOOLEAN DEFAULT false,
    is_system_template BOOLEAN DEFAULT false, -- System-provided vs user-created
    usage_count INTEGER DEFAULT 0,
    rating DECIMAL(3,2), -- Average user rating
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Template Usage Tracking
CREATE TABLE template_usage (
    id BIGSERIAL PRIMARY KEY,
    template_id UUID NOT NULL,
    user_id INTEGER NOT NULL,
    session_id UUID,
    variables_used JSONB DEFAULT '{}',
    generated_content_length INTEGER,
    success BOOLEAN DEFAULT true,
    feedback_rating INTEGER CHECK (feedback_rating BETWEEN 1 AND 5),
    feedback_comments TEXT,
    used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES document_templates(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (session_id) REFERENCES drafting_sessions(id)
);

-- Citation Cache for Legal Research Validation
CREATE TABLE citation_cache (
    id BIGSERIAL PRIMARY KEY,
    citation VARCHAR(500) NOT NULL UNIQUE,
    citation_type VARCHAR(50), -- CASE, STATUTE, REGULATION, etc.
    jurisdiction VARCHAR(100),
    is_valid BOOLEAN,
    validation_data JSONB DEFAULT '{}', -- Detailed validation results
    currency_status VARCHAR(50), -- CURRENT, OVERRULED, SUPERSEDED, etc.
    last_checked TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source VARCHAR(100), -- COURT_LISTENER, MASSACHUSETTS_LEGAL, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Document Generation History
CREATE TABLE document_generations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL,
    session_id UUID,
    template_id UUID,
    document_type VARCHAR(100) NOT NULL,
    jurisdiction VARCHAR(100) NOT NULL,
    input_context JSONB DEFAULT '{}',
    generated_content TEXT,
    content_length INTEGER,
    generation_method VARCHAR(50), -- AI_GENERATED, TEMPLATE_BASED, HYBRID
    ai_model_used VARCHAR(100),
    processing_time_seconds DECIMAL(10,3),
    quality_score DECIMAL(5,2), -- AI-assessed quality score
    validation_results JSONB DEFAULT '{}',
    user_feedback JSONB DEFAULT '{}',
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (session_id) REFERENCES drafting_sessions(id),
    FOREIGN KEY (template_id) REFERENCES document_templates(id)
);

-- AI Analysis Results
CREATE TABLE ai_document_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID,
    generation_id UUID,
    analysis_type VARCHAR(100) NOT NULL, -- SUMMARIZATION, TIMELINE, ISSUE_SPOTTING, etc.
    input_content TEXT,
    analysis_results JSONB DEFAULT '{}',
    confidence_score DECIMAL(5,2),
    processing_time_seconds DECIMAL(10,3),
    ai_model_used VARCHAR(100),
    analysis_status VARCHAR(50) DEFAULT 'COMPLETED', -- PENDING, COMPLETED, FAILED
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES legal_documents(id),
    FOREIGN KEY (generation_id) REFERENCES document_generations(id)
);

-- Workflow Steps Configuration
CREATE TABLE workflow_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_type VARCHAR(100) NOT NULL,
    jurisdiction VARCHAR(100) NOT NULL,
    workflow_type VARCHAR(100) NOT NULL,
    step_order INTEGER NOT NULL,
    step_id VARCHAR(100) NOT NULL,
    step_title VARCHAR(255) NOT NULL,
    step_description TEXT,
    step_type VARCHAR(100) NOT NULL, -- INFORMATION_GATHERING, DOCUMENT_UPLOAD, etc.
    questions JSONB DEFAULT '[]', -- Question definitions
    validation_rules JSONB DEFAULT '{}',
    is_required BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(document_type, jurisdiction, workflow_type, step_order)
);

-- Create indexes for performance
CREATE INDEX idx_legal_documents_user_id ON legal_documents(user_id);
CREATE INDEX idx_legal_documents_uploaded_at ON legal_documents(uploaded_at);
CREATE INDEX idx_legal_documents_file_type ON legal_documents(file_type);
CREATE INDEX idx_legal_documents_processing_status ON legal_documents(processing_status);

CREATE INDEX idx_drafting_sessions_user_id ON drafting_sessions(user_id);
CREATE INDEX idx_drafting_sessions_status ON drafting_sessions(session_status);
CREATE INDEX idx_drafting_sessions_created_at ON drafting_sessions(created_at);
CREATE INDEX idx_drafting_sessions_document_type ON drafting_sessions(document_type);

CREATE INDEX idx_document_templates_type_jurisdiction ON document_templates(document_type, jurisdiction);
CREATE INDEX idx_document_templates_public ON document_templates(is_public);
CREATE INDEX idx_document_templates_category ON document_templates(category);

CREATE INDEX idx_template_usage_template_id ON template_usage(template_id);
CREATE INDEX idx_template_usage_user_id ON template_usage(user_id);
CREATE INDEX idx_template_usage_used_at ON template_usage(used_at);

CREATE INDEX idx_citation_cache_citation ON citation_cache(citation);
CREATE INDEX idx_citation_cache_jurisdiction ON citation_cache(jurisdiction);
CREATE INDEX idx_citation_cache_last_checked ON citation_cache(last_checked);

CREATE INDEX idx_document_generations_user_id ON document_generations(user_id);
CREATE INDEX idx_document_generations_generated_at ON document_generations(generated_at);
CREATE INDEX idx_document_generations_document_type ON document_generations(document_type);

CREATE INDEX idx_ai_analysis_document_id ON ai_document_analysis(document_id);
CREATE INDEX idx_ai_analysis_type ON ai_document_analysis(analysis_type);
CREATE INDEX idx_ai_analysis_created_at ON ai_document_analysis(created_at);

CREATE INDEX idx_workflow_steps_type_jurisdiction ON workflow_steps(document_type, jurisdiction, workflow_type);

-- Insert default workflow steps for Interrogatories
INSERT INTO workflow_steps (document_type, jurisdiction, workflow_type, step_order, step_id, step_title, step_description, step_type, questions, is_required) VALUES
('INTERROGATORIES', 'FEDERAL', 'GUIDED_DRAFTING', 1, 'party_info', 'Party Information', 'Identify the parties and your role in the case', 'INFORMATION_GATHERING',
'[
  {"questionId": "party_role", "questionText": "Are you representing the plaintiff or defendant?", "questionType": "MULTIPLE_CHOICE", "required": true, "options": ["Plaintiff", "Defendant"]},
  {"questionId": "case_number", "questionText": "Case Number (if known)", "questionType": "TEXT", "required": false},
  {"questionId": "opposing_party", "questionText": "Name of opposing party", "questionType": "TEXT", "required": true}
]', true),

('INTERROGATORIES', 'FEDERAL', 'GUIDED_DRAFTING', 2, 'case_details', 'Case Details', 'Provide information about the legal dispute', 'INFORMATION_GATHERING',
'[
  {"questionId": "case_type", "questionText": "Type of case", "questionType": "MULTIPLE_CHOICE", "required": true, "options": ["Personal Injury", "Contract Dispute", "Employment", "Real Estate", "Other"]},
  {"questionId": "main_issues", "questionText": "Main factual disputes", "questionType": "TEXTAREA", "required": true, "helpText": "Describe the key facts in dispute"}
]', true),

('INTERROGATORIES', 'FEDERAL', 'GUIDED_DRAFTING', 3, 'document_upload', 'Document Upload', 'Upload relevant documents (optional)', 'DOCUMENT_UPLOAD',
'[
  {"questionId": "uploaded_docs", "questionText": "Upload relevant documents", "questionType": "FILE_UPLOAD", "required": false, "helpText": "Complaint, discovery requests, etc."}
]', false),

('INTERROGATORIES', 'FEDERAL', 'GUIDED_DRAFTING', 4, 'review_generate', 'Review & Generate', 'Review information and generate interrogatories', 'CONTENT_GENERATION', '[]', true);

-- Insert default templates
INSERT INTO document_templates (id, name, description, document_type, jurisdiction, category, content, variables, is_public, is_system_template, created_by) VALUES
(gen_random_uuid(), 'Federal Interrogatories Template', 'Standard interrogatories template for federal court', 'INTERROGATORIES', 'FEDERAL', 'Discovery',
'INTERROGATORIES TO {{party_type}}

TO: {{opposing_party_name}}
FROM: {{client_name}}

CASE: {{case_name}}
CASE NO: {{case_number}}

DEFINITIONS

1. "You" or "your" refers to {{opposing_party_name}} and any agents, representatives, or employees.

INSTRUCTIONS

These interrogatories are served pursuant to Rule 33 of the Federal Rules of Civil Procedure.

INTERROGATORIES

1. State your full name, current address, and all addresses where you have resided during the past five years.

2. {{custom_interrogatory_1}}

3. {{custom_interrogatory_2}}

Respectfully submitted,

{{attorney_name}}
{{attorney_title}}
{{law_firm_name}}',
'{
  "party_type": {"type": "SELECT", "required": true, "options": ["PLAINTIFF", "DEFENDANT"]},
  "opposing_party_name": {"type": "TEXT", "required": true},
  "client_name": {"type": "TEXT", "required": true},
  "case_name": {"type": "TEXT", "required": true},
  "case_number": {"type": "TEXT", "required": true},
  "custom_interrogatory_1": {"type": "TEXTAREA", "required": false},
  "custom_interrogatory_2": {"type": "TEXTAREA", "required": false},
  "attorney_name": {"type": "TEXT", "required": true},
  "attorney_title": {"type": "TEXT", "required": true},
  "law_firm_name": {"type": "TEXT", "required": true}
}', true, true, 1);

-- Add permissions for the new system
INSERT INTO permissions (name, description, category) VALUES
('LEGAL_DRAFTING_CREATE', 'Create legal documents using AI drafting system', 'LEGAL_DRAFTING'),
('LEGAL_DRAFTING_VIEW', 'View legal drafting sessions and documents', 'LEGAL_DRAFTING'),
('LEGAL_DRAFTING_MANAGE', 'Manage legal drafting templates and workflows', 'LEGAL_DRAFTING'),
('TEMPLATE_CREATE', 'Create custom document templates', 'TEMPLATES'),
('TEMPLATE_MANAGE', 'Manage and modify document templates', 'TEMPLATES'),
('DOCUMENT_UPLOAD', 'Upload documents for analysis and drafting context', 'DOCUMENTS'),
('AI_ANALYSIS_VIEW', 'View AI document analysis results', 'AI_ANALYSIS');

-- Assign permissions to Admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Admin'
AND p.name IN ('LEGAL_DRAFTING_CREATE', 'LEGAL_DRAFTING_VIEW', 'LEGAL_DRAFTING_MANAGE', 'TEMPLATE_CREATE', 'TEMPLATE_MANAGE', 'DOCUMENT_UPLOAD', 'AI_ANALYSIS_VIEW');

-- Assign basic permissions to Attorney role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Attorney'
AND p.name IN ('LEGAL_DRAFTING_CREATE', 'LEGAL_DRAFTING_VIEW', 'TEMPLATE_CREATE', 'DOCUMENT_UPLOAD', 'AI_ANALYSIS_VIEW');

-- Add table comments
COMMENT ON TABLE legal_documents IS 'Stores uploaded legal documents for analysis and drafting context';
COMMENT ON TABLE drafting_sessions IS 'Tracks interactive Q&A workflow sessions for document generation';
COMMENT ON TABLE document_templates IS 'Reusable templates for legal document generation';
COMMENT ON TABLE template_usage IS 'Tracks template usage and user feedback for analytics';
COMMENT ON TABLE citation_cache IS 'Caches legal citation validation results';
COMMENT ON TABLE document_generations IS 'History of AI-generated legal documents';
COMMENT ON TABLE ai_document_analysis IS 'Results of AI analysis on legal documents';
COMMENT ON TABLE workflow_steps IS 'Configuration for document drafting workflows';