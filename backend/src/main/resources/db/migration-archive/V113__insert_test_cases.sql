-- Insert test cases for workflow testing
-- These cases provide realistic scenarios for each workflow type

-- Case 1: Employment Litigation - For Complaint Response & Discovery Response workflows
INSERT INTO legal_cases (
    case_number, title, client_name, client_email, client_phone, client_address,
    status, priority, type, description,
    court_name, courtroom, judge_name,
    filing_date, next_hearing, trial_date,
    hourly_rate, total_hours, total_amount, payment_status,
    created_at
) VALUES (
    'CASE-2024-001',
    'Smith v. TechCorp Industries, Inc.',
    'Robert Smith',
    'robert.smith@email.com',
    '(617) 555-0123',
    '123 Main Street, Boston, MA 02108',
    'ACTIVE',
    'HIGH',
    'Employment Litigation',
    'Wrongful termination and breach of employment contract action. Plaintiff Robert Smith, former Senior Software Engineer, alleges he was terminated without cause in violation of his employment agreement after reporting safety violations to management. Claims include breach of contract, wrongful termination in violation of public policy, and emotional distress. Defendant TechCorp Industries denies allegations and claims termination was for legitimate performance reasons.',
    'Suffolk County Superior Court',
    'Courtroom 906',
    'Hon. Margaret Chen',
    '2024-09-15',
    '2025-01-15',
    '2025-06-20',
    350.00,
    45.5,
    15925.00,
    'PENDING',
    NOW()
);

-- Case 2: M&A Transaction - For Due Diligence & Contract Review workflows
INSERT INTO legal_cases (
    case_number, title, client_name, client_email, client_phone, client_address,
    status, priority, type, description,
    court_name, courtroom, judge_name,
    filing_date, next_hearing, trial_date,
    hourly_rate, total_hours, total_amount, payment_status,
    created_at
) VALUES (
    'CASE-2024-002',
    'Acme Corporation Acquisition of DataFlow Systems',
    'Acme Corporation',
    'legal@acmecorp.com',
    '(212) 555-0456',
    '500 Park Avenue, New York, NY 10022',
    'ACTIVE',
    'HIGH',
    'Mergers & Acquisitions',
    'Representation of Acme Corporation in its proposed acquisition of DataFlow Systems, Inc., a data analytics company. Transaction value approximately $45 million. Scope includes due diligence review, negotiation of definitive agreements, regulatory compliance, and closing. Key issues include IP ownership verification, employee retention agreements, and customer contract assignments.',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    450.00,
    120.0,
    54000.00,
    'PENDING',
    NOW()
);

-- Case 3: Civil Rights Litigation - For Motion Opposition workflow
INSERT INTO legal_cases (
    case_number, title, client_name, client_email, client_phone, client_address,
    status, priority, type, description,
    court_name, courtroom, judge_name,
    filing_date, next_hearing, trial_date,
    hourly_rate, total_hours, total_amount, payment_status,
    created_at
) VALUES (
    'CASE-2024-003',
    'Johnson v. City of Springfield',
    'Marcus Johnson',
    'marcus.johnson@email.com',
    '(413) 555-0789',
    '456 Oak Avenue, Springfield, MA 01103',
    'ACTIVE',
    'MEDIUM',
    'Civil Rights',
    'Section 1983 civil rights action against City of Springfield and Officer James Wilson. Plaintiff Marcus Johnson alleges excessive force during traffic stop on March 15, 2024. Claims include Fourth Amendment violation, assault and battery, and intentional infliction of emotional distress. Defendant City has filed Motion for Summary Judgment arguing qualified immunity. Response deadline approaching.',
    'U.S. District Court, District of Massachusetts',
    'Courtroom 5',
    'Hon. David Patterson',
    '2024-06-01',
    '2025-02-10',
    '2025-09-15',
    375.00,
    68.0,
    25500.00,
    'PENDING',
    NOW()
);
