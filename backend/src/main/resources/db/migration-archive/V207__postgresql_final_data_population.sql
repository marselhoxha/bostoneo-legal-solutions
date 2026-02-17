-- PostgreSQL Final Data Population
-- Version: V207
-- Description: Populates remaining critical business tables

-- ===============================================
-- AI DOCUMENT ANALYSIS (for action_items dependency)
-- ===============================================
INSERT INTO ai_document_analysis (
    file_item_id, analysis_type, status, confidence_score,
    result_summary, organization_id, requested_by, created_at, updated_at
)
SELECT
    fi.id,
    'CONTRACT_REVIEW',
    'COMPLETED',
    0.92,
    '{"clauses_reviewed": 15, "issues_found": 2}',
    1, 1, NOW(), NOW()
FROM file_items fi
WHERE fi.organization_id = 1
LIMIT 5
ON CONFLICT DO NOTHING;

-- ===============================================
-- ACTION ITEMS (linked to analysis)
-- ===============================================
INSERT INTO action_items (
    analysis_id, description, deadline, priority, status,
    related_section, organization_id, created_date, updated_date
)
SELECT
    ada.id,
    'Review and address identified contract issues',
    CURRENT_DATE + INTERVAL '7 days',
    'HIGH',
    'PENDING',
    'Contract Terms',
    1, NOW(), NOW()
FROM ai_document_analysis ada
WHERE ada.organization_id = 1
LIMIT 5
ON CONFLICT DO NOTHING;

-- ===============================================
-- AI USAGE METRICS
-- ===============================================
INSERT INTO ai_usage_metrics (
    user_id, feature_name, usage_count, tokens_used, cost,
    period_start, period_end, organization_id, created_at, updated_at
)
SELECT
    u.id,
    'DOCUMENT_ANALYSIS',
    10 + (u.id * 2),
    1000 + (u.id * 500),
    5.00 + (u.id * 2.50),
    DATE_TRUNC('month', CURRENT_DATE),
    DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day',
    1, NOW(), NOW()
FROM users u
WHERE u.organization_id = 1
ON CONFLICT DO NOTHING;

-- ===============================================
-- INVOICE ITEMS
-- ===============================================
INSERT INTO invoice_items (
    invoice_id, description, quantity, unit_price, amount,
    item_type, organization_id, created_at
)
SELECT
    i.id,
    'Legal Services - ' || i.invoice_number,
    1.00,
    i.total_amount,
    i.total_amount,
    'SERVICE',
    1, NOW()
FROM invoices i
WHERE i.organization_id = 1
LIMIT 5
ON CONFLICT DO NOTHING;

-- ===============================================
-- INVOICE TEMPLATE ITEMS
-- ===============================================
INSERT INTO invoice_template_items (
    template_id, description, default_quantity, default_rate,
    item_type, display_order, organization_id, created_at
)
SELECT
    it.id,
    'Standard Legal Services',
    1.00,
    350.00,
    'SERVICE',
    1,
    1, NOW()
FROM invoice_templates it
WHERE it.organization_id = 1
ON CONFLICT DO NOTHING;

-- ===============================================
-- AI CONVERSATION MESSAGES (link to sessions)
-- ===============================================
INSERT INTO ai_conversation_messages (
    session_id, role, content, tokens_used,
    organization_id, created_at
)
SELECT
    acs.id,
    'user',
    'Please analyze the following contract clause for potential issues.',
    120,
    1, NOW()
FROM ai_conversation_sessions acs
WHERE acs.organization_id = 1
LIMIT 3
ON CONFLICT DO NOTHING;

INSERT INTO ai_conversation_messages (
    session_id, role, content, tokens_used,
    organization_id, created_at
)
SELECT
    acs.id,
    'assistant',
    'I have analyzed the contract clause. Here are the key findings: 1) The indemnification language is overly broad. 2) The limitation of liability may not be enforceable under Massachusetts law.',
    450,
    1, NOW()
FROM ai_conversation_sessions acs
WHERE acs.organization_id = 1
LIMIT 3
ON CONFLICT DO NOTHING;

-- ===============================================
-- AI ANALYSIS MESSAGES
-- ===============================================
INSERT INTO ai_analysis_messages (
    analysis_id, role, content, tokens_used,
    organization_id, created_at
)
SELECT
    ada.id,
    'system',
    'Analyzing document for contract review...',
    50,
    1, NOW()
FROM ai_document_analysis ada
WHERE ada.organization_id = 1
LIMIT 3
ON CONFLICT DO NOTHING;

INSERT INTO ai_analysis_messages (
    analysis_id, role, content, tokens_used,
    organization_id, created_at
)
SELECT
    ada.id,
    'assistant',
    'Document analysis complete. Found 2 potential issues requiring review.',
    150,
    1, NOW()
FROM ai_document_analysis ada
WHERE ada.organization_id = 1
LIMIT 3
ON CONFLICT DO NOTHING;

-- ===============================================
-- DOCUMENT COLLECTIONS (add more)
-- ===============================================
INSERT INTO document_collections (
    name, description, case_id, user_id, is_archived,
    color, icon, organization_id, created_at, updated_at
)
SELECT
    'Case Documents - ' || lc.title,
    'Main document collection for case files',
    lc.id,
    1,
    FALSE,
    '#3B82F6',
    'folder',
    1, NOW(), NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1
LIMIT 5
ON CONFLICT DO NOTHING;

-- ===============================================
-- COLLECTION DOCUMENTS
-- ===============================================
INSERT INTO collection_documents (
    collection_id, file_item_id, added_by, notes,
    organization_id, added_at
)
SELECT
    dc.id,
    fi.id,
    1,
    'Added to collection',
    1, NOW()
FROM document_collections dc
CROSS JOIN file_items fi
WHERE dc.organization_id = 1 AND fi.organization_id = 1
LIMIT 10
ON CONFLICT DO NOTHING;

-- ===============================================
-- DOCUMENT VERSIONS
-- ===============================================
INSERT INTO document_versions (
    file_item_id, version_number, file_path, file_size, change_notes,
    created_by, organization_id, created_at
)
SELECT
    fi.id,
    1,
    fi.file_path,
    fi.size,
    'Initial version',
    1,
    1, NOW()
FROM file_items fi
WHERE fi.organization_id = 1
ON CONFLICT DO NOTHING;

-- ===============================================
-- FILE COMMENTS
-- ===============================================
INSERT INTO file_comments (
    file_id, user_id, comment, organization_id, created_at
)
SELECT
    fi.id,
    1,
    'Please review this document and provide feedback.',
    1, NOW()
FROM file_items fi
WHERE fi.organization_id = 1
LIMIT 5
ON CONFLICT DO NOTHING;

-- ===============================================
-- FILE ACCESS LOGS
-- ===============================================
INSERT INTO file_access_logs (
    file_id, user_id, access_type, ip_address,
    organization_id, accessed_at
)
SELECT
    fi.id,
    1,
    'VIEW',
    '192.168.1.100',
    1, NOW()
FROM file_items fi
WHERE fi.organization_id = 1
LIMIT 10
ON CONFLICT DO NOTHING;

-- ===============================================
-- INVOICE WORKFLOW EXECUTIONS
-- ===============================================
INSERT INTO invoice_workflow_executions (
    workflow_rule_id, invoice_id, status, result_message,
    organization_id, executed_at, created_at
)
SELECT
    iwr.id,
    i.id,
    'SUCCESS',
    'Workflow executed successfully',
    1, NOW(), NOW()
FROM invoice_workflow_rules iwr
CROSS JOIN invoices i
WHERE iwr.organization_id = 1 AND i.organization_id = 1
LIMIT 5
ON CONFLICT DO NOTHING;

-- ===============================================
-- CASE WORKFLOW EXECUTIONS
-- ===============================================
INSERT INTO case_workflow_executions (
    template_id, case_id, status, started_at, current_step,
    organization_id, started_by, created_at, updated_at
)
SELECT
    cwt.id,
    lc.id,
    'IN_PROGRESS',
    NOW() - INTERVAL '7 days',
    1,
    1, 1, NOW(), NOW()
FROM case_workflow_templates cwt
CROSS JOIN legal_cases lc
WHERE cwt.organization_id = 1 AND lc.organization_id = 1
LIMIT 5
ON CONFLICT DO NOTHING;

-- ===============================================
-- RESEARCH SESSIONS (more)
-- ===============================================
INSERT INTO research_session (
    session_id, session_name, description, is_active,
    total_searches, total_documents_viewed,
    organization_id, user_id, created_at, updated_at, last_accessed
) VALUES
('session_research_001', 'Contract Law Research', 'Research on Massachusetts contract law', TRUE, 5, 10, 1, 1, NOW(), NOW(), NOW()),
('session_research_002', 'Immigration Case Precedents', 'Research for immigration cases', TRUE, 3, 8, 1, 1, NOW(), NOW(), NOW()),
('session_research_003', 'Family Law Guidelines', 'Research on Massachusetts family law', FALSE, 7, 15, 1, 1, NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days')
ON CONFLICT DO NOTHING;

-- ===============================================
-- INTAKE SUBMISSIONS (more)
-- ===============================================
INSERT INTO intake_submissions (
    form_id, submission_data, status, ip_address,
    priority_score, organization_id, created_at, updated_at
)
SELECT
    if.id,
    '{"name": "New Lead ' || if.id || '", "email": "lead' || if.id || '@example.com", "matter": "General inquiry"}',
    'REVIEWED',
    '192.168.1.' || (100 + if.id),
    50 + (if.id * 5),
    1, NOW() - INTERVAL '3 days', NOW()
FROM intake_forms if
WHERE if.organization_id = 1
LIMIT 3
ON CONFLICT DO NOTHING;

-- ===============================================
-- TRUST ACCOUNT TRANSACTIONS (more)
-- ===============================================
INSERT INTO trust_account_transactions (
    trust_account_id, transaction_type, amount, description,
    reference_number, client_id, legal_case_id, balance_after,
    transaction_date, is_cleared, organization_id, created_by, created_at, updated_at
) VALUES
(1, 'DEPOSIT', 10000.00, 'Retainer deposit for case', 'TRX-2024-001', 2, 3, 10000.00, CURRENT_DATE - INTERVAL '30 days', TRUE, 1, 1, NOW(), NOW()),
(1, 'WITHDRAWAL', 2500.00, 'Payment to court for filing fees', 'TRX-2024-002', 2, 3, 7500.00, CURRENT_DATE - INTERVAL '20 days', TRUE, 1, 1, NOW(), NOW()),
(1, 'DEPOSIT', 5000.00, 'Additional retainer', 'TRX-2024-003', 3, 4, 12500.00, CURRENT_DATE - INTERVAL '10 days', TRUE, 1, 1, NOW(), NOW()),
(2, 'DEPOSIT', 15000.00, 'Settlement proceeds', 'TRX-2024-004', 4, 5, 15000.00, CURRENT_DATE - INTERVAL '5 days', FALSE, 1, 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ===============================================
-- PAYMENT TRANSACTIONS (more)
-- ===============================================
INSERT INTO payment_transactions (
    invoice_id, amount, transaction_type, transaction_status,
    reference_number, processing_date, completion_date,
    organization_id, created_by, created_at, updated_at
)
SELECT
    i.id,
    i.total_amount,
    'ACH',
    'COMPLETED',
    'ACH-' || i.id || '-2024',
    CURRENT_DATE - INTERVAL '5 days',
    CURRENT_DATE - INTERVAL '3 days',
    1, 1, NOW(), NOW()
FROM invoices i
WHERE i.organization_id = 1 AND i.status = 'PAID'
LIMIT 3
ON CONFLICT DO NOTHING;

-- ===============================================
-- SIGNATURE REQUESTS (more)
-- ===============================================
INSERT INTO signature_requests (
    title, signer_email, signer_name, status, expires_at,
    case_id, client_id, message, organization_id, created_by, created_at, updated_at
) VALUES
('Engagement Letter Signature', 'client1@example.com', 'John Client', 'SENT', NOW() + INTERVAL '14 days', 3, 2, 'Please review and sign the engagement letter.', 1, 1, NOW(), NOW()),
('Settlement Agreement', 'client2@example.com', 'Jane Client', 'VIEWED', NOW() + INTERVAL '7 days', 4, 3, 'Please sign the settlement agreement.', 1, 1, NOW(), NOW()),
('Retainer Agreement', 'client3@example.com', 'Bob Client', 'COMPLETED', NOW() + INTERVAL '30 days', 5, 4, 'Thank you for signing.', 1, 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ===============================================
-- CASE BUDGETS (if needed)
-- ===============================================
INSERT INTO case_budgets (
    case_id, budget_amount, spent_amount, budget_type, status,
    start_date, end_date, organization_id, created_by, created_at, updated_at
)
SELECT
    lc.id,
    25000.00,
    5000.00 + (lc.id * 1000),
    'TOTAL',
    'ACTIVE',
    lc.created_at::DATE,
    lc.created_at::DATE + INTERVAL '1 year',
    1, 1, NOW(), NOW()
FROM legal_cases lc
WHERE lc.organization_id = 1
LIMIT 5
ON CONFLICT DO NOTHING;

-- ===============================================
-- DOCUMENT TEMPLATES (more)
-- ===============================================
INSERT INTO document_templates (
    name, description, category, template_content, practice_area,
    jurisdiction, is_active, is_public, organization_id, created_by, created_at, updated_at
) VALUES
('Retainer Agreement', 'Standard retainer agreement template', 1, 'RETAINER AGREEMENT\n\nThis Agreement is entered into...', 'General', 'Massachusetts', TRUE, FALSE, 1, 1, NOW(), NOW()),
('Client Intake Form', 'New client intake questionnaire', 2, 'CLIENT INTAKE FORM\n\nPlease complete all sections...', 'General', 'Massachusetts', TRUE, FALSE, 1, 1, NOW(), NOW()),
('Case Summary Memo', 'Internal case summary memorandum', 3, 'CASE SUMMARY MEMORANDUM\n\nRE: [CLIENT_NAME] v. [OPPOSING_PARTY]', 'Civil Litigation', 'Massachusetts', TRUE, FALSE, 1, 1, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Print summary
DO $$
DECLARE
    total INT;
    populated INT;
    empty INT;
BEGIN
    SELECT COUNT(*) INTO total FROM pg_stat_user_tables WHERE schemaname = 'public';
    SELECT COUNT(*) INTO populated FROM pg_stat_user_tables WHERE schemaname = 'public' AND n_live_tup > 0;
    SELECT COUNT(*) INTO empty FROM pg_stat_user_tables WHERE schemaname = 'public' AND n_live_tup = 0;

    RAISE NOTICE '=== Final Data Population Summary ===';
    RAISE NOTICE 'Total tables: %', total;
    RAISE NOTICE 'Tables with data: %', populated;
    RAISE NOTICE 'Empty tables: %', empty;
END $$;
