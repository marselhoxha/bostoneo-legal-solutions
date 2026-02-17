-- PostgreSQL Restore Original Data
-- Version: V209
-- Description: Restores ALL original data from seed files with correct PostgreSQL column names

-- ===============================================
-- USERS - Full Law Firm Staff
-- Password for all: 1234 (BCrypt hash)
-- ===============================================
INSERT INTO users (email, password, first_name, last_name, phone, title, enabled, non_locked, using_mfa, organization_id, created_at)
VALUES
-- Attorneys
('m.thompson@bostoneosolutions.com', '$2a$12$g4A0lLmieV53IY9aMd9s/uSfOXdX3eW6b//8ugRI5BSrqbFuo3Sq6', 'Michael', 'Thompson', '(617) 555-0002', 'Senior Partner - Litigation', true, true, false, 1, NOW()),
('j.rodriguez@bostoneosolutions.com', '$2a$12$g4A0lLmieV53IY9aMd9s/uSfOXdX3eW6b//8ugRI5BSrqbFuo3Sq6', 'Jennifer', 'Rodriguez', '(617) 555-0003', 'Senior Partner - Corporate', true, true, false, 1, NOW()),
('d.chen@bostoneosolutions.com', '$2a$12$g4A0lLmieV53IY9aMd9s/uSfOXdX3eW6b//8ugRI5BSrqbFuo3Sq6', 'David', 'Chen', '(617) 555-0004', 'Equity Partner - Real Estate', true, true, false, 1, NOW()),
('s.williams@bostoneosolutions.com', '$2a$12$g4A0lLmieV53IY9aMd9s/uSfOXdX3eW6b//8ugRI5BSrqbFuo3Sq6', 'Sarah', 'Williams', '(617) 555-0005', 'Equity Partner - Family Law', true, true, false, 1, NOW()),
('e.garcia@bostoneosolutions.com', '$2a$12$g4A0lLmieV53IY9aMd9s/uSfOXdX3eW6b//8ugRI5BSrqbFuo3Sq6', 'Emily', 'Garcia', '(617) 555-0006', 'Associate', true, true, false, 1, NOW()),
('j.brown@bostoneosolutions.com', '$2a$12$g4A0lLmieV53IY9aMd9s/uSfOXdX3eW6b//8ugRI5BSrqbFuo3Sq6', 'Jessica', 'Brown', '(617) 555-0007', 'Senior Associate', true, true, false, 1, NOW()),
('a.wilson@bostoneosolutions.com', '$2a$12$g4A0lLmieV53IY9aMd9s/uSfOXdX3eW6b//8ugRI5BSrqbFuo3Sq6', 'Andrew', 'Wilson', '(617) 555-0008', 'Senior Associate', true, true, false, 1, NOW()),
('d.martinez@bostoneosolutions.com', '$2a$12$g4A0lLmieV53IY9aMd9s/uSfOXdX3eW6b//8ugRI5BSrqbFuo3Sq6', 'Daniel', 'Martinez', '(617) 555-0009', 'Associate', true, true, false, 1, NOW()),
-- Paralegals
('m.gonzalez@bostoneosolutions.com', '$2a$12$g4A0lLmieV53IY9aMd9s/uSfOXdX3eW6b//8ugRI5BSrqbFuo3Sq6', 'Maria', 'Gonzalez', '(617) 555-0010', 'Senior Paralegal', true, true, false, 1, NOW()),
('j.white@bostoneosolutions.com', '$2a$12$g4A0lLmieV53IY9aMd9s/uSfOXdX3eW6b//8ugRI5BSrqbFuo3Sq6', 'James', 'White', '(617) 555-0011', 'Paralegal', true, true, false, 1, NOW()),
-- Admin/Support
('n.harris@bostoneosolutions.com', '$2a$12$g4A0lLmieV53IY9aMd9s/uSfOXdX3eW6b//8ugRI5BSrqbFuo3Sq6', 'Nicole', 'Harris', '(617) 555-0012', 'Legal Secretary', true, true, false, 1, NOW()),
('m.moore@bostoneosolutions.com', '$2a$12$g4A0lLmieV53IY9aMd9s/uSfOXdX3eW6b//8ugRI5BSrqbFuo3Sq6', 'Margaret', 'Moore', '(617) 555-0013', 'CFO', true, true, false, 1, NOW()),
('b.johnson@bostoneosolutions.com', '$2a$12$g4A0lLmieV53IY9aMd9s/uSfOXdX3eW6b//8ugRI5BSrqbFuo3Sq6', 'Brian', 'Johnson', '(617) 555-0014', 'Practice Manager', true, true, false, 1, NOW()),
('r.davis@bostoneosolutions.com', '$2a$12$g4A0lLmieV53IY9aMd9s/uSfOXdX3eW6b//8ugRI5BSrqbFuo3Sq6', 'Robert', 'Davis', '(617) 555-0015', 'Of Counsel - Tax Law', true, true, false, 1, NOW()),
('k.taylor@bostoneosolutions.com', '$2a$12$g4A0lLmieV53IY9aMd9s/uSfOXdX3eW6b//8ugRI5BSrqbFuo3Sq6', 'Kevin', 'Taylor', '(617) 555-0016', 'Junior Associate', true, true, false, 1, NOW()),
('a.thomas@bostoneosolutions.com', '$2a$12$g4A0lLmieV53IY9aMd9s/uSfOXdX3eW6b//8ugRI5BSrqbFuo3Sq6', 'Amanda', 'Thomas', '(617) 555-0017', 'Junior Associate', true, true, false, 1, NOW()),
('r.lee@bostoneosolutions.com', '$2a$12$g4A0lLmieV53IY9aMd9s/uSfOXdX3eW6b//8ugRI5BSrqbFuo3Sq6', 'Rachel', 'Lee', '(617) 555-0018', 'Law Clerk', true, true, false, 1, NOW()),
('c.clark@bostoneosolutions.com', '$2a$12$g4A0lLmieV53IY9aMd9s/uSfOXdX3eW6b//8ugRI5BSrqbFuo3Sq6', 'Christopher', 'Clark', '(617) 555-0019', 'Legal Assistant', true, true, false, 1, NOW()),
('e.morgan@bostoneosolutions.com', '$2a$12$g4A0lLmieV53IY9aMd9s/uSfOXdX3eW6b//8ugRI5BSrqbFuo3Sq6', 'Elizabeth', 'Morgan', '(617) 555-0020', 'Managing Partner', true, true, false, 1, NOW()),
('l.anderson@bostoneosolutions.com', '$2a$12$g4A0lLmieV53IY9aMd9s/uSfOXdX3eW6b//8ugRI5BSrqbFuo3Sq6', 'Lisa', 'Anderson', '(617) 555-0021', 'Associate', true, true, false, 1, NOW())
ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password, enabled = true, non_locked = true;

-- ===============================================
-- USER ROLES - Assign roles to new users
-- ===============================================
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r WHERE u.email IN ('m.thompson@bostoneosolutions.com', 'j.rodriguez@bostoneosolutions.com', 'd.chen@bostoneosolutions.com', 's.williams@bostoneosolutions.com', 'e.garcia@bostoneosolutions.com', 'j.brown@bostoneosolutions.com', 'a.wilson@bostoneosolutions.com', 'd.martinez@bostoneosolutions.com', 'r.davis@bostoneosolutions.com', 'k.taylor@bostoneosolutions.com', 'a.thomas@bostoneosolutions.com', 'l.anderson@bostoneosolutions.com', 'e.morgan@bostoneosolutions.com') AND r.name = 'ATTORNEY'
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r WHERE u.email IN ('m.gonzalez@bostoneosolutions.com', 'j.white@bostoneosolutions.com', 'r.lee@bostoneosolutions.com') AND r.name = 'PARALEGAL'
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r WHERE u.email IN ('n.harris@bostoneosolutions.com', 'c.clark@bostoneosolutions.com') AND r.name = 'SECRETARY'
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r WHERE u.email IN ('m.moore@bostoneosolutions.com', 'b.johnson@bostoneosolutions.com') AND r.name = 'FINANCE'
ON CONFLICT DO NOTHING;

-- ===============================================
-- CLIENTS - Sample Clients
-- ===============================================
INSERT INTO clients (name, email, phone, address, type, status, organization_id, created_at)
VALUES
('John Smith', 'john.smith@email.com', '(617) 555-1001', '123 Main St, Boston, MA 02108', 'INDIVIDUAL', 'ACTIVE', 1, NOW()),
('Tech Solutions Inc', 'contact@techsolutions.com', '(617) 555-1002', '456 Business Ave, Boston, MA 02116', 'BUSINESS', 'ACTIVE', 1, NOW()),
('Sarah Johnson', 'sarah.j@email.com', '(617) 555-1003', '789 Oak Lane, Cambridge, MA 02139', 'INDIVIDUAL', 'ACTIVE', 1, NOW()),
('Boston Real Estate LLC', 'info@bostonrealestate.com', '(617) 555-1004', '321 Commercial Blvd, Boston, MA 02110', 'BUSINESS', 'ACTIVE', 1, NOW()),
('Michael Williams', 'mwilliams@email.com', '(617) 555-1005', '555 Beacon St, Boston, MA 02215', 'INDIVIDUAL', 'ACTIVE', 1, NOW()),
('Global Trading LLC', 'contact@globaltrading.com', '(617) 555-1006', '100 Trade Center, Boston, MA 02210', 'BUSINESS', 'ACTIVE', 1, NOW()),
('Maria Rodriguez', 'maria.r@email.com', '(617) 555-1007', '222 Harbor View, Boston, MA 02128', 'INDIVIDUAL', 'ACTIVE', 1, NOW()),
('Innovation Corp', 'legal@innovationcorp.com', '(617) 555-1008', '50 Innovation Way, Cambridge, MA 02142', 'BUSINESS', 'ACTIVE', 1, NOW()),
('James Anderson', 'j.anderson@email.com', '(617) 555-1009', '333 Park Ave, Brookline, MA 02445', 'INDIVIDUAL', 'ACTIVE', 1, NOW()),
('Healthcare Partners LLC', 'admin@healthcarepartners.com', '(617) 555-1010', '400 Medical Center Dr, Boston, MA 02215', 'BUSINESS', 'ACTIVE', 1, NOW())
ON CONFLICT DO NOTHING;

-- ===============================================
-- LEGAL CASES - Sample Cases (using correct column: type not case_type)
-- ===============================================
INSERT INTO legal_cases (case_number, title, description, type, status, priority, client_name, client_email, client_phone, client_address, organization_id, created_at)
VALUES
('CASE-2025-001', 'Smith v. ABC Corporation', 'Personal injury case resulting from workplace accident', 'Personal Injury', 'ACTIVE', 'HIGH', 'John Smith', 'john.smith@email.com', '(617) 555-1001', '123 Main St, Boston, MA', 1, NOW() - INTERVAL '30 days'),
('CASE-2025-002', 'Tech Solutions Contract Review', 'Review and negotiation of software licensing agreement', 'Business Law', 'ACTIVE', 'MEDIUM', 'Tech Solutions Inc', 'contact@techsolutions.com', '(617) 555-1002', '456 Business Ave, Boston, MA', 1, NOW() - INTERVAL '25 days'),
('CASE-2025-003', 'Johnson Estate Planning', 'Comprehensive estate planning including will and trust', 'Estate Planning', 'ACTIVE', 'MEDIUM', 'Sarah Johnson', 'sarah.j@email.com', '(617) 555-1003', '789 Oak Lane, Cambridge, MA', 1, NOW() - INTERVAL '20 days'),
('CASE-2025-004', 'Real Estate Transaction - Commercial', 'Commercial property acquisition and due diligence', 'Real Estate', 'ACTIVE', 'HIGH', 'Boston Real Estate LLC', 'info@bostonrealestate.com', '(617) 555-1004', '321 Commercial Blvd, Boston, MA', 1, NOW() - INTERVAL '15 days'),
('CASE-2025-005', 'Williams Immigration Case', 'H-1B visa application and employment authorization', 'Immigration', 'ACTIVE', 'HIGH', 'Michael Williams', 'mwilliams@email.com', '(617) 555-1005', '555 Beacon St, Boston, MA', 1, NOW() - INTERVAL '10 days'),
('CASE-2025-006', 'Global Trading Contract Dispute', 'Breach of contract dispute between business partners', 'Business Law', 'ACTIVE', 'HIGH', 'Global Trading LLC', 'contact@globaltrading.com', '(617) 555-1006', '100 Trade Center, Boston, MA', 1, NOW() - INTERVAL '45 days'),
('CASE-2025-007', 'Rodriguez Divorce Proceedings', 'Divorce proceedings with asset division', 'Family Law', 'ACTIVE', 'MEDIUM', 'Maria Rodriguez', 'maria.r@email.com', '(617) 555-1007', '222 Harbor View, Boston, MA', 1, NOW() - INTERVAL '35 days'),
('CASE-2025-008', 'Innovation Corp IP Protection', 'Patent application and intellectual property strategy', 'Intellectual Property', 'ACTIVE', 'HIGH', 'Innovation Corp', 'legal@innovationcorp.com', '(617) 555-1008', '50 Innovation Way, Cambridge, MA', 1, NOW() - INTERVAL '40 days'),
('CASE-2025-009', 'Anderson Personal Injury', 'Motor vehicle accident personal injury claim', 'Personal Injury', 'ACTIVE', 'HIGH', 'James Anderson', 'j.anderson@email.com', '(617) 555-1009', '333 Park Ave, Brookline, MA', 1, NOW() - INTERVAL '8 days'),
('CASE-2025-010', 'Healthcare Partners Compliance', 'Healthcare regulatory compliance review', 'Healthcare Law', 'ACTIVE', 'MEDIUM', 'Healthcare Partners LLC', 'admin@healthcarepartners.com', '(617) 555-1010', '400 Medical Center Dr, Boston, MA', 1, NOW() - INTERVAL '12 days'),
('CASE-2025-011', 'Employment Discrimination Case', 'Workplace discrimination and wrongful termination', 'Employment Law', 'ACTIVE', 'HIGH', 'John Smith', 'john.smith@email.com', '(617) 555-1001', '123 Main St, Boston, MA', 1, NOW() - INTERVAL '50 days'),
('CASE-2025-012', 'Criminal Defense - DUI', 'DUI defense representation', 'Criminal Defense', 'ACTIVE', 'URGENT', 'Michael Williams', 'mwilliams@email.com', '(617) 555-1005', '555 Beacon St, Boston, MA', 1, NOW() - INTERVAL '5 days')
ON CONFLICT (case_number) DO NOTHING;

-- ===============================================
-- AI CONVERSATION SESSIONS - AI Workspace Data
-- ===============================================
INSERT INTO ai_conversation_sessions (
    session_name, case_id, user_id, is_active, task_type, research_mode,
    organization_id, created_at, updated_at
)
SELECT
    'Legal Research - ' || lc.title,
    lc.id,
    1,
    TRUE,
    'LEGAL_QUESTION',
    'AUTO',
    1, NOW() - INTERVAL '5 days', NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1
LIMIT 5
ON CONFLICT DO NOTHING;

INSERT INTO ai_conversation_sessions (
    session_name, case_id, user_id, is_active, task_type, research_mode,
    organization_id, created_at, updated_at
)
SELECT
    'Document Draft - ' || lc.title,
    lc.id,
    1,
    TRUE,
    'GENERATE_DRAFT',
    'THOROUGH',
    1, NOW() - INTERVAL '3 days', NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1
LIMIT 3
ON CONFLICT DO NOTHING;

INSERT INTO ai_conversation_sessions (
    session_name, case_id, user_id, is_active, task_type, research_mode,
    organization_id, created_at, updated_at
) VALUES
('Contract Analysis Session', NULL, 1, TRUE, 'ANALYZE_DOCUMENT', 'THOROUGH', 1, NOW() - INTERVAL '7 days', NOW()),
('Immigration Law Research', NULL, 1, TRUE, 'LEGAL_QUESTION', 'AUTO', 1, NOW() - INTERVAL '10 days', NOW()),
('Personal Injury Precedents', NULL, 1, FALSE, 'LEGAL_QUESTION', 'FAST', 1, NOW() - INTERVAL '14 days', NOW() - INTERVAL '12 days'),
('Family Law Guidelines', NULL, 1, TRUE, 'LEGAL_QUESTION', 'AUTO', 1, NOW() - INTERVAL '2 days', NOW()),
('Criminal Defense Strategy', NULL, 1, TRUE, 'SUMMARIZE_CASE', 'THOROUGH', 1, NOW() - INTERVAL '1 day', NOW())
ON CONFLICT DO NOTHING;

-- ===============================================
-- AI CONVERSATION MESSAGES - Chat History
-- ===============================================
INSERT INTO ai_conversation_messages (
    session_id, role, content, tokens_used, organization_id, created_at
)
SELECT
    acs.id,
    'user',
    'What are the key elements required to prove breach of contract in Massachusetts?',
    50,
    1,
    acs.created_at + INTERVAL '1 minute'
FROM ai_conversation_sessions acs
WHERE acs.organization_id = 1 AND acs.task_type = 'LEGAL_QUESTION'
LIMIT 3
ON CONFLICT DO NOTHING;

INSERT INTO ai_conversation_messages (
    session_id, role, content, tokens_used, organization_id, created_at
)
SELECT
    acs.id,
    'assistant',
    'Under Massachusetts law, to prove breach of contract, a plaintiff must establish: (1) existence of a valid and binding contract, (2) the plaintiff performed or was ready to perform, (3) the defendant breached the contract, and (4) the plaintiff suffered damages as a result. The contract must have mutual assent, consideration, and definite terms.',
    350,
    1,
    acs.created_at + INTERVAL '2 minutes'
FROM ai_conversation_sessions acs
WHERE acs.organization_id = 1 AND acs.task_type = 'LEGAL_QUESTION'
LIMIT 3
ON CONFLICT DO NOTHING;

INSERT INTO ai_conversation_messages (
    session_id, role, content, tokens_used, organization_id, created_at
)
SELECT
    acs.id,
    'user',
    'Can you help me draft a demand letter for this case?',
    30,
    1,
    acs.created_at + INTERVAL '5 minutes'
FROM ai_conversation_sessions acs
WHERE acs.organization_id = 1 AND acs.task_type = 'GENERATE_DRAFT'
LIMIT 2
ON CONFLICT DO NOTHING;

INSERT INTO ai_conversation_messages (
    session_id, role, content, tokens_used, organization_id, created_at
)
SELECT
    acs.id,
    'assistant',
    'I''ll help you draft a demand letter. Based on the case details, here''s a professional demand letter template:\n\n[LAW FIRM LETTERHEAD]\n\n[DATE]\n\nVIA CERTIFIED MAIL\n\n[DEFENDANT NAME AND ADDRESS]\n\nRe: Demand for Payment - [CLIENT NAME]\n\nDear [DEFENDANT]:\n\nThis firm represents [CLIENT NAME] regarding [BRIEF DESCRIPTION OF MATTER]...',
    450,
    1,
    acs.created_at + INTERVAL '6 minutes'
FROM ai_conversation_sessions acs
WHERE acs.organization_id = 1 AND acs.task_type = 'GENERATE_DRAFT'
LIMIT 2
ON CONFLICT DO NOTHING;

-- ===============================================
-- AI WORKSPACE DOCUMENTS
-- ===============================================
INSERT INTO ai_workspace_documents (
    title, content, document_type, status, case_id, user_id,
    organization_id, created_at, updated_at
)
SELECT
    'Legal Memo - ' || lc.title,
    'LEGAL MEMORANDUM\n\nTO: File\nFROM: Attorney\nRE: ' || lc.title || '\nDATE: ' || TO_CHAR(NOW(), 'Month DD, YYYY') || '\n\nISSUE:\nWhether...\n\nBRIEF ANSWER:\nYes/No...\n\nFACTS:\n...\n\nANALYSIS:\n...\n\nCONCLUSION:\n...',
    'MEMO',
    'DRAFT',
    lc.id,
    1,
    1, NOW() - INTERVAL '3 days', NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1
LIMIT 5
ON CONFLICT DO NOTHING;

INSERT INTO ai_workspace_documents (
    title, content, document_type, status, case_id, user_id,
    organization_id, created_at, updated_at
)
SELECT
    'Demand Letter - ' || lc.title,
    '[FIRM LETTERHEAD]\n\n' || TO_CHAR(NOW(), 'Month DD, YYYY') || '\n\nVIA CERTIFIED MAIL\n\n[RECIPIENT]\n\nRe: Demand for [MATTER]\n\nDear Sir/Madam:\n\nThis firm represents ' || lc.client_name || ' in the above-referenced matter...',
    'LETTER',
    'FINAL',
    lc.id,
    1,
    1, NOW() - INTERVAL '5 days', NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1 AND lc.type = 'Personal Injury'
LIMIT 2
ON CONFLICT DO NOTHING;

INSERT INTO ai_workspace_documents (
    title, content, document_type, status, user_id,
    organization_id, created_at, updated_at
) VALUES
('Motion to Dismiss Template', 'COMMONWEALTH OF MASSACHUSETTS\n\n[COURT NAME]\n\nCIVIL ACTION NO. [CASE NUMBER]\n\n[PLAINTIFF],\n    Plaintiff\n\nv.\n\n[DEFENDANT],\n    Defendant\n\nMOTION TO DISMISS\n\nNow comes the Defendant, by and through undersigned counsel, and hereby moves this Honorable Court to dismiss the Complaint filed herein pursuant to Mass. R. Civ. P. 12(b)(6)...', 'MOTION', 'TEMPLATE', 1, 1, NOW(), NOW()),
('Discovery Request Template', 'COMMONWEALTH OF MASSACHUSETTS\n\n[COURT NAME]\n\nCIVIL ACTION NO. [CASE NUMBER]\n\nINTERROGATORIES TO [PARTY]\n\nPursuant to Mass. R. Civ. P. 33, the undersigned requests that the [Party] answer the following interrogatories under oath...', 'DISCOVERY', 'TEMPLATE', 1, 1, NOW(), NOW()),
('Settlement Agreement Template', 'SETTLEMENT AGREEMENT AND MUTUAL RELEASE\n\nThis Settlement Agreement and Mutual Release ("Agreement") is entered into as of [DATE], by and between:\n\n[PARTY 1] ("First Party")\n\nand\n\n[PARTY 2] ("Second Party")\n\nRECITALS:\nWHEREAS, the parties are engaged in a dispute regarding...\n\nNOW, THEREFORE, in consideration of the mutual promises...', 'CONTRACT', 'TEMPLATE', 1, 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ===============================================
-- CASE TASKS - More Comprehensive Tasks
-- ===============================================
INSERT INTO case_tasks (
    case_id, title, description, task_type, priority, status,
    assigned_to, assigned_by, due_date, estimated_hours,
    organization_id, created_at, updated_at
)
SELECT
    lc.id,
    'Initial Case Review',
    'Review all case documents and prepare initial assessment',
    'REVIEW',
    'HIGH',
    'IN_PROGRESS',
    1, 1,
    NOW() + INTERVAL '3 days',
    4.0,
    1, NOW(), NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1 AND lc.status = 'ACTIVE'
LIMIT 5
ON CONFLICT DO NOTHING;

INSERT INTO case_tasks (
    case_id, title, description, task_type, priority, status,
    assigned_to, assigned_by, due_date, estimated_hours,
    organization_id, created_at, updated_at
)
SELECT
    lc.id,
    'Client Interview',
    'Schedule and conduct detailed client interview',
    'CLIENT_MEETING',
    'HIGH',
    'TODO',
    1, 1,
    NOW() + INTERVAL '5 days',
    2.0,
    1, NOW(), NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1 AND lc.status = 'ACTIVE'
LIMIT 5
ON CONFLICT DO NOTHING;

INSERT INTO case_tasks (
    case_id, title, description, task_type, priority, status,
    assigned_to, assigned_by, due_date, estimated_hours,
    organization_id, created_at, updated_at
)
SELECT
    lc.id,
    'Draft Initial Pleading',
    'Prepare and draft initial court filing',
    'DOCUMENT_PREP',
    'MEDIUM',
    'TODO',
    1, 1,
    NOW() + INTERVAL '7 days',
    6.0,
    1, NOW(), NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1 AND lc.status = 'ACTIVE'
LIMIT 5
ON CONFLICT DO NOTHING;

INSERT INTO case_tasks (
    case_id, title, description, task_type, priority, status,
    assigned_to, assigned_by, due_date, estimated_hours,
    organization_id, created_at, updated_at
)
SELECT
    lc.id,
    'Legal Research',
    'Research relevant case law and statutes',
    'RESEARCH',
    'MEDIUM',
    'IN_PROGRESS',
    1, 1,
    NOW() + INTERVAL '10 days',
    8.0,
    1, NOW(), NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1 AND lc.status = 'ACTIVE'
LIMIT 5
ON CONFLICT DO NOTHING;

-- ===============================================
-- TIME ENTRIES - More Comprehensive
-- ===============================================
INSERT INTO time_entries (
    case_id, user_id, description, duration, date, is_billable,
    billing_rate, organization_id, created_at
)
SELECT
    lc.id,
    1,
    'Initial case review and document analysis',
    120,
    CURRENT_DATE - INTERVAL '5 days',
    TRUE,
    350.00,
    1, NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1
LIMIT 5
ON CONFLICT DO NOTHING;

INSERT INTO time_entries (
    case_id, user_id, description, duration, date, is_billable,
    billing_rate, organization_id, created_at
)
SELECT
    lc.id,
    1,
    'Client phone conference',
    45,
    CURRENT_DATE - INTERVAL '3 days',
    TRUE,
    350.00,
    1, NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1
LIMIT 5
ON CONFLICT DO NOTHING;

INSERT INTO time_entries (
    case_id, user_id, description, duration, date, is_billable,
    billing_rate, organization_id, created_at
)
SELECT
    lc.id,
    1,
    'Legal research on applicable statutes',
    180,
    CURRENT_DATE - INTERVAL '2 days',
    TRUE,
    350.00,
    1, NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1
LIMIT 5
ON CONFLICT DO NOTHING;

INSERT INTO time_entries (
    case_id, user_id, description, duration, date, is_billable,
    billing_rate, organization_id, created_at
)
SELECT
    lc.id,
    1,
    'Draft demand letter',
    90,
    CURRENT_DATE - INTERVAL '1 day',
    TRUE,
    350.00,
    1, NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1
LIMIT 5
ON CONFLICT DO NOTHING;

-- ===============================================
-- INVOICES - More Sample Invoices
-- ===============================================
INSERT INTO invoices (
    invoice_number, client_id, case_id, issue_date, due_date, status,
    subtotal, tax_rate, tax_amount, total_amount, notes,
    organization_id, created_at, updated_at
)
SELECT
    'INV-2025-' || LPAD(ROW_NUMBER() OVER ()::TEXT, 3, '0'),
    lc.client_id,
    lc.id,
    CURRENT_DATE - INTERVAL '15 days',
    CURRENT_DATE + INTERVAL '15 days',
    'PENDING',
    5000.00,
    6.25,
    312.50,
    5312.50,
    'Legal services for ' || lc.title,
    1, NOW(), NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1 AND lc.client_id IS NOT NULL
LIMIT 5
ON CONFLICT DO NOTHING;

-- Print summary
DO $$
DECLARE
    user_count INT;
    client_count INT;
    case_count INT;
    session_count INT;
    message_count INT;
    doc_count INT;
BEGIN
    SELECT COUNT(*) INTO user_count FROM users WHERE organization_id = 1;
    SELECT COUNT(*) INTO client_count FROM clients WHERE organization_id = 1;
    SELECT COUNT(*) INTO case_count FROM legal_cases WHERE organization_id = 1;
    SELECT COUNT(*) INTO session_count FROM ai_conversation_sessions WHERE organization_id = 1;
    SELECT COUNT(*) INTO message_count FROM ai_conversation_messages WHERE organization_id = 1;
    SELECT COUNT(*) INTO doc_count FROM ai_workspace_documents WHERE organization_id = 1;

    RAISE NOTICE '=== Data Restoration Summary ===';
    RAISE NOTICE '  Users: %', user_count;
    RAISE NOTICE '  Clients: %', client_count;
    RAISE NOTICE '  Legal Cases: %', case_count;
    RAISE NOTICE '  AI Sessions: %', session_count;
    RAISE NOTICE '  AI Messages: %', message_count;
    RAISE NOTICE '  AI Workspace Docs: %', doc_count;
END $$;
