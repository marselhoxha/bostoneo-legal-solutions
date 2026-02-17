-- PostgreSQL Complete Data Fix
-- Version: V210
-- Description: Fixes all column name issues and adds comprehensive data

-- ===============================================
-- TIME ENTRIES - Using correct columns: legal_case_id, hours, billable, rate, status
-- ===============================================
-- First clear any bad data from previous attempts
DELETE FROM time_entries WHERE organization_id = 1 AND status IS NULL;

-- Insert time entries with correct column names
INSERT INTO time_entries (
    legal_case_id, user_id, description, hours, date, billable, rate, status,
    organization_id, created_at
)
SELECT
    lc.id,
    1,
    'Initial case review and document analysis',
    2.00,
    CURRENT_DATE - INTERVAL '5 days',
    TRUE,
    350.00,
    'APPROVED',
    1, NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1
LIMIT 10
ON CONFLICT DO NOTHING;

INSERT INTO time_entries (
    legal_case_id, user_id, description, hours, date, billable, rate, status,
    organization_id, created_at
)
SELECT
    lc.id,
    1,
    'Client phone conference and case discussion',
    0.75,
    CURRENT_DATE - INTERVAL '4 days',
    TRUE,
    350.00,
    'APPROVED',
    1, NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1
LIMIT 10
ON CONFLICT DO NOTHING;

INSERT INTO time_entries (
    legal_case_id, user_id, description, hours, date, billable, rate, status,
    organization_id, created_at
)
SELECT
    lc.id,
    1,
    'Legal research on applicable statutes and case law',
    3.00,
    CURRENT_DATE - INTERVAL '3 days',
    TRUE,
    350.00,
    'SUBMITTED',
    1, NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1
LIMIT 10
ON CONFLICT DO NOTHING;

INSERT INTO time_entries (
    legal_case_id, user_id, description, hours, date, billable, rate, status,
    organization_id, created_at
)
SELECT
    lc.id,
    1,
    'Draft correspondence to opposing counsel',
    1.50,
    CURRENT_DATE - INTERVAL '2 days',
    TRUE,
    350.00,
    'DRAFT',
    1, NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1
LIMIT 10
ON CONFLICT DO NOTHING;

INSERT INTO time_entries (
    legal_case_id, user_id, description, hours, date, billable, rate, status,
    organization_id, created_at
)
SELECT
    lc.id,
    1,
    'Prepare and review discovery requests',
    4.00,
    CURRENT_DATE - INTERVAL '1 day',
    TRUE,
    350.00,
    'DRAFT',
    1, NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1
LIMIT 10
ON CONFLICT DO NOTHING;

-- ===============================================
-- INVOICES - Using correct columns: legal_case_id
-- ===============================================
INSERT INTO invoices (
    invoice_number, client_id, legal_case_id, issue_date, due_date, status,
    subtotal, tax_rate, tax_amount, total_amount, notes,
    organization_id, created_at, updated_at
)
SELECT
    'INV-2025-' || LPAD((ROW_NUMBER() OVER () + 100)::TEXT, 4, '0'),
    c.id,
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
JOIN clients c ON c.organization_id = 1
WHERE lc.organization_id = 1
LIMIT 10
ON CONFLICT DO NOTHING;

INSERT INTO invoices (
    invoice_number, client_id, legal_case_id, issue_date, due_date, status,
    subtotal, tax_rate, tax_amount, total_amount, notes,
    organization_id, created_at, updated_at
)
SELECT
    'INV-2025-' || LPAD((ROW_NUMBER() OVER () + 200)::TEXT, 4, '0'),
    c.id,
    lc.id,
    CURRENT_DATE - INTERVAL '45 days',
    CURRENT_DATE - INTERVAL '15 days',
    'PAID',
    7500.00,
    6.25,
    468.75,
    7968.75,
    'Retainer for ' || lc.title,
    1, NOW(), NOW()
FROM legal_cases lc
JOIN clients c ON c.organization_id = 1
WHERE lc.organization_id = 1
LIMIT 5
ON CONFLICT DO NOTHING;

-- ===============================================
-- AI WORKSPACE DOCUMENTS - No content column, add versions instead
-- ===============================================
INSERT INTO ai_workspace_documents (
    title, document_type, status, case_id, user_id,
    organization_id, current_version, created_at, updated_at
)
SELECT
    'Legal Memo - ' || lc.title,
    'MEMO',
    'DRAFT',
    lc.id,
    1,
    1,
    1,
    NOW() - INTERVAL '3 days',
    NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1
LIMIT 5
ON CONFLICT DO NOTHING;

INSERT INTO ai_workspace_documents (
    title, document_type, status, case_id, user_id,
    organization_id, current_version, created_at, updated_at
)
SELECT
    'Demand Letter - ' || lc.title,
    'LETTER',
    'FINAL',
    lc.id,
    1,
    1,
    1,
    NOW() - INTERVAL '5 days',
    NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1 AND lc.type = 'Personal Injury'
LIMIT 3
ON CONFLICT DO NOTHING;

INSERT INTO ai_workspace_documents (
    title, document_type, status, user_id,
    organization_id, current_version, created_at, updated_at
) VALUES
('Motion to Dismiss Template', 'MOTION', 'TEMPLATE', 1, 1, 1, NOW(), NOW()),
('Discovery Request Template', 'DISCOVERY', 'TEMPLATE', 1, 1, 1, NOW(), NOW()),
('Settlement Agreement Template', 'CONTRACT', 'TEMPLATE', 1, 1, 1, NOW(), NOW()),
('Client Intake Form', 'FORM', 'TEMPLATE', 1, 1, 1, NOW(), NOW()),
('Retainer Agreement Template', 'CONTRACT', 'TEMPLATE', 1, 1, 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ===============================================
-- AI WORKSPACE DOCUMENT VERSIONS - Store actual content here
-- ===============================================
INSERT INTO ai_workspace_document_versions (
    document_id, version_number, content, created_by, organization_id, created_at
)
SELECT
    awd.id,
    1,
    'LEGAL MEMORANDUM

TO: File
FROM: Attorney
RE: ' || awd.title || '
DATE: ' || TO_CHAR(NOW(), 'Month DD, YYYY') || '

ISSUE:
Whether the applicable statute of limitations bars the plaintiff''s claim.

BRIEF ANSWER:
No, the claim is timely filed within the applicable limitations period.

FACTS:
[Detailed facts of the case...]

ANALYSIS:
Under Massachusetts law, the statute of limitations for [type of claim] is [X] years...

CONCLUSION:
Based on the foregoing analysis, the claim is timely and should proceed.',
    1,
    1,
    NOW()
FROM ai_workspace_documents awd
WHERE awd.organization_id = 1 AND awd.document_type = 'MEMO'
ON CONFLICT DO NOTHING;

INSERT INTO ai_workspace_document_versions (
    document_id, version_number, content, created_by, organization_id, created_at
)
SELECT
    awd.id,
    1,
    '[FIRM LETTERHEAD]

' || TO_CHAR(NOW(), 'Month DD, YYYY') || '

VIA CERTIFIED MAIL, RETURN RECEIPT REQUESTED

[RECIPIENT NAME]
[RECIPIENT ADDRESS]

Re: Demand for Settlement - [Case Name]

Dear Sir/Madam:

This firm represents [Client Name] in connection with the above-referenced matter.

STATEMENT OF FACTS:
[Detailed factual narrative...]

DAMAGES:
1. Medical Expenses: $XX,XXX.XX
2. Lost Wages: $XX,XXX.XX
3. Pain and Suffering: $XX,XXX.XX
4. Future Medical Care: $XX,XXX.XX

TOTAL DAMAGES: $XXX,XXX.XX

DEMAND:
We hereby demand payment in the amount of $XXX,XXX.XX to fully and finally resolve this matter.

Govern yourself accordingly.

Very truly yours,
[Attorney Name]',
    1,
    1,
    NOW()
FROM ai_workspace_documents awd
WHERE awd.organization_id = 1 AND awd.document_type = 'LETTER'
ON CONFLICT DO NOTHING;

-- ===============================================
-- MORE CLIENTS - 100 Customers from original MySQL data
-- ===============================================
INSERT INTO clients (name, email, phone, address, type, status, organization_id, created_at) VALUES
('Acme Corporation', 'contact@acmecorp.com', '(617) 555-0101', '123 Financial District, Boston, MA 02110', 'BUSINESS', 'ACTIVE', 1, NOW()),
('Boston Legal Associates', 'info@bostonlegal.com', '(617) 555-0102', '456 Beacon Street, Boston, MA 02215', 'BUSINESS', 'ACTIVE', 1, NOW()),
('Green Earth Cafe', 'hello@greenearthcafe.com', '(617) 555-0103', '789 Newbury Street, Boston, MA 02116', 'BUSINESS', 'ACTIVE', 1, NOW()),
('Creative Design Studio', 'info@creativestudio.com', '(617) 555-0105', '654 Tremont Street, Boston, MA 02118', 'BUSINESS', 'ACTIVE', 1, NOW()),
('Emily Davis', 'emily.davis@outlook.com', '(617) 555-0109', '321 Newbury St, Boston, MA 02115', 'INDIVIDUAL', 'ACTIVE', 1, NOW()),
('David Wilson', 'david.wilson@gmail.com', '(617) 555-0110', '654 Boylston St, Boston, MA 02116', 'INDIVIDUAL', 'ACTIVE', 1, NOW()),
('Massachusetts General Hospital', 'billing@mgh.harvard.edu', '(617) 555-0111', '55 Fruit Street, Boston, MA 02114', 'BUSINESS', 'ACTIVE', 1, NOW()),
('Boston University', 'finance@bu.edu', '(617) 555-0112', '1 Silber Way, Boston, MA 02215', 'BUSINESS', 'ACTIVE', 1, NOW()),
('Fidelity Investments', 'contact@fidelity.com', '(617) 555-0113', '245 Summer Street, Boston, MA 02210', 'BUSINESS', 'ACTIVE', 1, NOW()),
('Boston Consulting Group', 'info@bcg.com', '(617) 555-0114', '200 Pier Four Blvd, Boston, MA 02210', 'BUSINESS', 'ACTIVE', 1, NOW()),
('State Street Corporation', 'contact@statestreet.com', '(617) 555-0115', '1 Lincoln Street, Boston, MA 02111', 'BUSINESS', 'ACTIVE', 1, NOW()),
('Lisa Anderson', 'lisa.anderson@gmail.com', '(617) 555-0116', '123 Beacon Hill, Boston, MA 02108', 'INDIVIDUAL', 'ACTIVE', 1, NOW()),
('Robert Taylor', 'robert.taylor@yahoo.com', '(617) 555-0117', '456 Back Bay, Boston, MA 02116', 'INDIVIDUAL', 'ACTIVE', 1, NOW()),
('Jennifer Martinez', 'jennifer.martinez@hotmail.com', '(617) 555-0118', '789 South End, Boston, MA 02118', 'INDIVIDUAL', 'ACTIVE', 1, NOW()),
('William Thompson', 'william.thompson@outlook.com', '(617) 555-0119', '321 North End, Boston, MA 02113', 'INDIVIDUAL', 'ACTIVE', 1, NOW()),
('Patricia Garcia', 'patricia.garcia@gmail.com', '(617) 555-0120', '654 Charlestown, Boston, MA 02129', 'INDIVIDUAL', 'ACTIVE', 1, NOW()),
('Dell EMC', 'contact@dell.com', '(508) 555-0121', '176 South Street, Hopkinton, MA 01748', 'BUSINESS', 'ACTIVE', 1, NOW()),
('Raytheon Technologies', 'info@raytheon.com', '(781) 555-0122', '870 Winter Street, Waltham, MA 02451', 'BUSINESS', 'ACTIVE', 1, NOW()),
('Biogen', 'contact@biogen.com', '(617) 555-0123', '225 Binney Street, Cambridge, MA 02142', 'BUSINESS', 'ACTIVE', 1, NOW()),
('Boston Scientific', 'info@bostonscientific.com', '(508) 555-0124', '300 Boston Scientific Way, Marlborough, MA 01752', 'BUSINESS', 'ACTIVE', 1, NOW()),
('Thermo Fisher Scientific', 'contact@thermofisher.com', '(781) 555-0125', '168 Third Avenue, Waltham, MA 02451', 'BUSINESS', 'ACTIVE', 1, NOW()),
('James Rodriguez', 'james.rodriguez@gmail.com', '(617) 555-0126', '123 Jamaica Plain, Boston, MA 02130', 'INDIVIDUAL', 'ACTIVE', 1, NOW()),
('Mary Lee', 'mary.lee@yahoo.com', '(617) 555-0127', '456 Roslindale, Boston, MA 02131', 'INDIVIDUAL', 'ACTIVE', 1, NOW()),
('Thomas White', 'thomas.white@hotmail.com', '(617) 555-0128', '789 West Roxbury, Boston, MA 02132', 'INDIVIDUAL', 'ACTIVE', 1, NOW()),
('Nancy Clark', 'nancy.clark@outlook.com', '(617) 555-0129', '321 Hyde Park, Boston, MA 02136', 'INDIVIDUAL', 'ACTIVE', 1, NOW()),
('Daniel Hall', 'daniel.hall@gmail.com', '(617) 555-0130', '654 Mattapan, Boston, MA 02126', 'INDIVIDUAL', 'ACTIVE', 1, NOW()),
('Wayfair', 'contact@wayfair.com', '(617) 555-0131', '4 Copley Place, Boston, MA 02116', 'BUSINESS', 'ACTIVE', 1, NOW()),
('HubSpot', 'info@hubspot.com', '(617) 555-0132', '2 Canal Park, Cambridge, MA 02141', 'BUSINESS', 'ACTIVE', 1, NOW()),
('Akamai Technologies', 'contact@akamai.com', '(617) 555-0133', '145 Broadway, Cambridge, MA 02142', 'BUSINESS', 'ACTIVE', 1, NOW()),
('TripAdvisor', 'info@tripadvisor.com', '(781) 555-0134', '400 1st Avenue, Needham, MA 02494', 'BUSINESS', 'ACTIVE', 1, NOW()),
('LogMeIn', 'contact@logmein.com', '(617) 555-0135', '320 Summer Street, Boston, MA 02210', 'BUSINESS', 'ACTIVE', 1, NOW()),
('Christopher Young', 'christopher.young@gmail.com', '(617) 555-0136', '123 Dorchester, Boston, MA 02122', 'INDIVIDUAL', 'ACTIVE', 1, NOW()),
('Susan King', 'susan.king@yahoo.com', '(617) 555-0137', '456 Roxbury, Boston, MA 02119', 'INDIVIDUAL', 'ACTIVE', 1, NOW()),
('Joseph Wright', 'joseph.wright@hotmail.com', '(617) 555-0138', '789 East Boston, Boston, MA 02128', 'INDIVIDUAL', 'ACTIVE', 1, NOW()),
('Karen Lopez', 'karen.lopez@outlook.com', '(617) 555-0139', '321 Brighton, Boston, MA 02135', 'INDIVIDUAL', 'ACTIVE', 1, NOW()),
('Steven Hill', 'steven.hill@gmail.com', '(617) 555-0140', '654 Allston, Boston, MA 02134', 'INDIVIDUAL', 'ACTIVE', 1, NOW()),
('Liberty Mutual', 'contact@libertymutual.com', '(617) 555-0141', '175 Berkeley Street, Boston, MA 02116', 'BUSINESS', 'ACTIVE', 1, NOW()),
('John Hancock', 'info@johnhancock.com', '(617) 555-0142', '200 Berkeley Street, Boston, MA 02116', 'BUSINESS', 'ACTIVE', 1, NOW()),
('Santander Bank', 'contact@santander.com', '(617) 555-0143', '75 State Street, Boston, MA 02109', 'BUSINESS', 'ACTIVE', 1, NOW()),
('Boston Properties', 'info@bostonproperties.com', '(617) 555-0144', '800 Boylston Street, Boston, MA 02199', 'BUSINESS', 'ACTIVE', 1, NOW())
ON CONFLICT DO NOTHING;

-- ===============================================
-- MORE LEGAL CASES - Comprehensive case list
-- ===============================================
INSERT INTO legal_cases (case_number, title, description, type, status, priority, client_name, client_email, client_phone, client_address, organization_id, created_at) VALUES
('CASE-2025-013', 'Corporate Merger Advisory', 'Advising on $50M corporate merger between tech companies', 'Business Law', 'ACTIVE', 'HIGH', 'HubSpot', 'info@hubspot.com', '(617) 555-0132', '2 Canal Park, Cambridge, MA', 1, NOW() - INTERVAL '25 days'),
('CASE-2025-014', 'Patent Infringement Defense', 'Defense against patent infringement allegations', 'Intellectual Property', 'ACTIVE', 'HIGH', 'Akamai Technologies', 'contact@akamai.com', '(617) 555-0133', '145 Broadway, Cambridge, MA', 1, NOW() - INTERVAL '40 days'),
('CASE-2025-015', 'Commercial Lease Dispute', 'Dispute over commercial lease terms and conditions', 'Real Estate', 'ACTIVE', 'MEDIUM', 'Boston Properties', 'info@bostonproperties.com', '(617) 555-0144', '800 Boylston Street, Boston, MA', 1, NOW() - INTERVAL '18 days'),
('CASE-2025-016', 'Employment Contract Negotiation', 'Negotiating executive employment contract', 'Employment Law', 'ACTIVE', 'MEDIUM', 'Liberty Mutual', 'contact@libertymutual.com', '(617) 555-0141', '175 Berkeley Street, Boston, MA', 1, NOW() - INTERVAL '10 days'),
('CASE-2025-017', 'Wrongful Termination Claim', 'Employee wrongful termination and discrimination case', 'Employment Law', 'ACTIVE', 'HIGH', 'Christopher Young', 'christopher.young@gmail.com', '(617) 555-0136', '123 Dorchester, Boston, MA', 1, NOW() - INTERVAL '35 days'),
('CASE-2025-018', 'Medical Malpractice Claim', 'Hospital negligence resulting in patient injury', 'Medical Malpractice', 'ACTIVE', 'URGENT', 'Karen Lopez', 'karen.lopez@outlook.com', '(617) 555-0139', '321 Brighton, Boston, MA', 1, NOW() - INTERVAL '7 days'),
('CASE-2025-019', 'Securities Fraud Investigation', 'Defense in SEC securities fraud investigation', 'Securities Law', 'ACTIVE', 'URGENT', 'Fidelity Investments', 'contact@fidelity.com', '(617) 555-0113', '245 Summer Street, Boston, MA', 1, NOW() - INTERVAL '15 days'),
('CASE-2025-020', 'Product Liability Defense', 'Defense against product liability claims', 'Product Liability', 'ACTIVE', 'HIGH', 'Boston Scientific', 'info@bostonscientific.com', '(508) 555-0124', '300 Boston Scientific Way, Marlborough, MA', 1, NOW() - INTERVAL '30 days')
ON CONFLICT (case_number) DO NOTHING;

-- ===============================================
-- MORE LEADS
-- ===============================================
INSERT INTO leads (
    first_name, last_name, email, phone, source, status,
    priority, assigned_to, lead_score, notes, initial_inquiry,
    practice_area, case_type, urgency_level, lead_quality,
    geographic_location, communication_preference,
    organization_id, created_at
) VALUES
('Robert', 'Chen', 'robert.chen@email.com', '(617) 555-4001', 'WEBSITE', 'NEW', 'HIGH', 1, 85, 'Corporate merger inquiry from tech executive', 'Interested in M&A advisory services for potential acquisition', 'Business Law', 'Merger', 'HIGH', 'HOT', 'Boston, MA', 'EMAIL', 1, NOW() - INTERVAL '2 days'),
('Amanda', 'Foster', 'amanda.foster@email.com', '(617) 555-4002', 'REFERRAL', 'CONTACTED', 'MEDIUM', 1, 72, 'Referred by existing client for estate planning', 'Need comprehensive estate planning including trust', 'Estate Planning', 'Trust', 'MEDIUM', 'WARM', 'Cambridge, MA', 'PHONE', 1, NOW() - INTERVAL '5 days'),
('Michael', 'Santos', 'michael.santos@email.com', '(617) 555-4003', 'WEBSITE', 'QUALIFIED', 'HIGH', 1, 90, 'Serious personal injury case with clear liability', 'Injured in car accident, other driver at fault', 'Personal Injury', 'Auto Accident', 'HIGH', 'HOT', 'Brookline, MA', 'PHONE', 1, NOW() - INTERVAL '3 days'),
('Jennifer', 'Park', 'jennifer.park@email.com', '(617) 555-4004', 'REFERRAL', 'NEW', 'MEDIUM', 1, 65, 'Immigration case for tech worker', 'H-1B to Green Card transition needed', 'Immigration', 'Green Card', 'MEDIUM', 'WARM', 'Newton, MA', 'EMAIL', 1, NOW() - INTERVAL '1 day'),
('David', 'Murphy', 'david.murphy@email.com', '(617) 555-4005', 'WEBSITE', 'CONTACTED', 'HIGH', 1, 80, 'Commercial real estate transaction', 'Buying commercial property, needs due diligence', 'Real Estate', 'Commercial', 'HIGH', 'HOT', 'Boston, MA', 'PHONE', 1, NOW() - INTERVAL '4 days'),
('Sarah', 'Kim', 'sarah.kim@email.com', '(617) 555-4006', 'WEBSITE', 'NEW', 'MEDIUM', 1, 60, 'Divorce inquiry', 'Considering divorce, has children and assets', 'Family Law', 'Divorce', 'MEDIUM', 'WARM', 'Somerville, MA', 'EMAIL', 1, NOW() - INTERVAL '6 days'),
('James', 'Brown', 'james.brown2@email.com', '(617) 555-4007', 'REFERRAL', 'QUALIFIED', 'HIGH', 1, 88, 'IP protection for startup', 'Tech startup needs patent and trademark protection', 'Intellectual Property', 'Patent', 'HIGH', 'HOT', 'Cambridge, MA', 'PHONE', 1, NOW() - INTERVAL '2 days'),
('Emily', 'Wilson', 'emily.wilson2@email.com', '(617) 555-4008', 'WEBSITE', 'CONTACTED', 'MEDIUM', 1, 70, 'Employment discrimination case', 'Potential workplace discrimination claim', 'Employment Law', 'Discrimination', 'MEDIUM', 'WARM', 'Boston, MA', 'EMAIL', 1, NOW() - INTERVAL '8 days')
ON CONFLICT DO NOTHING;

-- ===============================================
-- MORE CALENDAR EVENTS
-- ===============================================
INSERT INTO calendar_events (
    title, description, start_time, end_time, location, event_type,
    visibility, status, all_day, user_id, reminder_minutes,
    organization_id, created_at, updated_at, high_priority
) VALUES
('Partner Meeting', 'Weekly partner strategy meeting', NOW() + INTERVAL '1 day' + INTERVAL '9 hours', NOW() + INTERVAL '1 day' + INTERVAL '10 hours', 'Main Conference Room', 'MEETING', 'PRIVATE', 'SCHEDULED', FALSE, 1, 30, 1, NOW(), NOW(), TRUE),
('Client Deposition', 'Deposition for Smith v. ABC Corp', NOW() + INTERVAL '2 days' + INTERVAL '10 hours', NOW() + INTERVAL '2 days' + INTERVAL '12 hours', 'Court Building - Room 302', 'HEARING', 'INTERNAL', 'SCHEDULED', FALSE, 1, 60, 1, NOW(), NOW(), TRUE),
('New Client Consultation', 'Initial consultation with potential PI client', NOW() + INTERVAL '3 days' + INTERVAL '14 hours', NOW() + INTERVAL '3 days' + INTERVAL '15 hours', 'Office - Conference Room A', 'CONSULTATION', 'INTERNAL', 'SCHEDULED', FALSE, 1, 30, 1, NOW(), NOW(), FALSE),
('Court Filing Deadline', 'Submit motion to dismiss - Johnson case', NOW() + INTERVAL '5 days', NOW() + INTERVAL '5 days' + INTERVAL '1 hour', 'Online Filing', 'DEADLINE', 'INTERNAL', 'SCHEDULED', TRUE, 1, 120, 1, NOW(), NOW(), TRUE),
('Expert Witness Call', 'Call with medical expert for Martinez case', NOW() + INTERVAL '4 days' + INTERVAL '11 hours', NOW() + INTERVAL '4 days' + INTERVAL '12 hours', 'Phone/Zoom', 'MEETING', 'INTERNAL', 'SCHEDULED', FALSE, 1, 15, 1, NOW(), NOW(), FALSE),
('Bar Association Lunch', 'Monthly bar association networking event', NOW() + INTERVAL '7 days' + INTERVAL '12 hours', NOW() + INTERVAL '7 days' + INTERVAL '14 hours', 'Boston Harbor Hotel', 'OTHER', 'PUBLIC', 'SCHEDULED', FALSE, 1, 60, 1, NOW(), NOW(), FALSE),
('Settlement Conference', 'Settlement conference for Williams case', NOW() + INTERVAL '10 days' + INTERVAL '9 hours', NOW() + INTERVAL '10 days' + INTERVAL '12 hours', 'Mediation Center', 'HEARING', 'INTERNAL', 'SCHEDULED', FALSE, 1, 120, 1, NOW(), NOW(), TRUE),
('Staff Training', 'Quarterly compliance training session', NOW() + INTERVAL '14 days' + INTERVAL '13 hours', NOW() + INTERVAL '14 days' + INTERVAL '16 hours', 'Large Conference Room', 'MEETING', 'PRIVATE', 'SCHEDULED', FALSE, 1, 30, 1, NOW(), NOW(), FALSE)
ON CONFLICT DO NOTHING;

-- ===============================================
-- MORE CASE ACTIVITIES
-- ===============================================
INSERT INTO case_activities (
    case_id, user_id, activity_type, description, metadata, created_at, organization_id
)
SELECT
    lc.id,
    1,
    'DOCUMENT_UPLOADED',
    'Uploaded client signed retainer agreement',
    '{"documentName": "Retainer_Agreement_Signed.pdf", "documentType": "CONTRACT", "fileSize": "1.2 MB"}',
    NOW() - INTERVAL '10 days',
    1
FROM legal_cases lc
WHERE lc.organization_id = 1
LIMIT 10
ON CONFLICT DO NOTHING;

INSERT INTO case_activities (
    case_id, user_id, activity_type, description, metadata, created_at, organization_id
)
SELECT
    lc.id,
    1,
    'STATUS_CHANGED',
    'Case status updated to ACTIVE',
    '{"old_status": "PENDING", "new_status": "ACTIVE", "reason": "Retainer received"}',
    NOW() - INTERVAL '9 days',
    1
FROM legal_cases lc
WHERE lc.organization_id = 1
LIMIT 10
ON CONFLICT DO NOTHING;

INSERT INTO case_activities (
    case_id, user_id, activity_type, description, metadata, created_at, organization_id
)
SELECT
    lc.id,
    1,
    'COMMUNICATION',
    'Initial case review completed with client',
    '{"communicationType": "PHONE", "duration": "45 minutes", "outcome": "Case strategy discussed"}',
    NOW() - INTERVAL '7 days',
    1
FROM legal_cases lc
WHERE lc.organization_id = 1
LIMIT 10
ON CONFLICT DO NOTHING;

-- ===============================================
-- CASE NOTES
-- ===============================================
INSERT INTO case_notes (
    case_id, user_id, title, content, note_type, is_privileged,
    organization_id, created_at, updated_at
)
SELECT
    lc.id,
    1,
    'Initial Case Assessment',
    'Reviewed all initial documentation. Strong case with clear liability indicators. Client has good documentation. Recommend proceeding with formal demand.',
    'INTERNAL',
    TRUE,
    1,
    NOW() - INTERVAL '8 days',
    NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1 AND lc.status = 'ACTIVE'
LIMIT 10
ON CONFLICT DO NOTHING;

INSERT INTO case_notes (
    case_id, user_id, title, content, note_type, is_privileged,
    organization_id, created_at, updated_at
)
SELECT
    lc.id,
    1,
    'Client Communication Log',
    'Spoke with client regarding case progress. Client understands timeline and is satisfied with progress. Follow-up scheduled for next week.',
    'CLIENT_COMMUNICATION',
    FALSE,
    1,
    NOW() - INTERVAL '3 days',
    NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1 AND lc.status = 'ACTIVE'
LIMIT 10
ON CONFLICT DO NOTHING;

-- ===============================================
-- EXPENSE CATEGORIES (if not exists)
-- ===============================================
INSERT INTO expense_categories (name, description, is_billable, organization_id, created_at)
VALUES
('Court Filing Fees', 'Court filing and docket fees', TRUE, 1, NOW()),
('Expert Witness Fees', 'Expert witness consultation and testimony fees', TRUE, 1, NOW()),
('Travel Expenses', 'Travel expenses for case-related activities', TRUE, 1, NOW()),
('Deposition Costs', 'Court reporter and deposition room costs', TRUE, 1, NOW()),
('Research Services', 'Legal research database subscriptions', TRUE, 1, NOW()),
('Postage and Delivery', 'Mailing and courier services', TRUE, 1, NOW()),
('Photocopying', 'Document copying and printing', TRUE, 1, NOW()),
('Process Server', 'Service of process fees', TRUE, 1, NOW())
ON CONFLICT DO NOTHING;

-- ===============================================
-- EXPENSES
-- ===============================================
INSERT INTO expenses (
    case_id, category_id, description, amount, expense_date, vendor,
    is_billable, status, organization_id, created_at
)
SELECT
    lc.id,
    ec.id,
    'Court filing fee for initial complaint',
    350.00,
    CURRENT_DATE - INTERVAL '10 days',
    'Suffolk County Courthouse',
    TRUE,
    'APPROVED',
    1,
    NOW()
FROM legal_cases lc
CROSS JOIN expense_categories ec
WHERE lc.organization_id = 1 AND ec.name = 'Court Filing Fees' AND ec.organization_id = 1
LIMIT 5
ON CONFLICT DO NOTHING;

-- ===============================================
-- SUMMARY
-- ===============================================
DO $$
DECLARE
    user_count INT;
    client_count INT;
    case_count INT;
    time_entry_count INT;
    invoice_count INT;
    session_count INT;
    doc_count INT;
    lead_count INT;
BEGIN
    SELECT COUNT(*) INTO user_count FROM users WHERE organization_id = 1;
    SELECT COUNT(*) INTO client_count FROM clients WHERE organization_id = 1;
    SELECT COUNT(*) INTO case_count FROM legal_cases WHERE organization_id = 1;
    SELECT COUNT(*) INTO time_entry_count FROM time_entries WHERE organization_id = 1;
    SELECT COUNT(*) INTO invoice_count FROM invoices WHERE organization_id = 1;
    SELECT COUNT(*) INTO session_count FROM ai_conversation_sessions WHERE organization_id = 1;
    SELECT COUNT(*) INTO doc_count FROM ai_workspace_documents WHERE organization_id = 1;
    SELECT COUNT(*) INTO lead_count FROM leads WHERE organization_id = 1;

    RAISE NOTICE '=== V210 Data Fix Complete ===';
    RAISE NOTICE '  Users: %', user_count;
    RAISE NOTICE '  Clients: %', client_count;
    RAISE NOTICE '  Legal Cases: %', case_count;
    RAISE NOTICE '  Time Entries: %', time_entry_count;
    RAISE NOTICE '  Invoices: %', invoice_count;
    RAISE NOTICE '  AI Sessions: %', session_count;
    RAISE NOTICE '  AI Workspace Docs: %', doc_count;
    RAISE NOTICE '  Leads: %', lead_count;
END $$;
