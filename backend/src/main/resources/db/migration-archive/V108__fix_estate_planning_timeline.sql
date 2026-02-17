-- Fix Estate Planning Timeline - Remove internal workflow phases
-- Replace with client-meaningful milestones

-- Delete existing Estate phases
DELETE FROM case_timeline_templates WHERE case_type = 'Estate';

-- Insert corrected Estate Planning timeline
INSERT INTO case_timeline_templates (case_type, phase_order, phase_name, phase_description, estimated_duration_days, icon, color) VALUES

('Estate', 1, 'Initial Consultation', 'Meet with attorney to discuss your estate planning goals, family situation, and assets', 7, 'ri-discuss-line', '#405189'),

('Estate', 2, 'Information Gathering', 'Collect detailed information about assets, beneficiaries, and specific wishes for your estate plan', 14, 'ri-file-list-3-line', '#3577f1'),

('Estate', 3, 'Document Preparation', 'Attorney drafts your will, trust, powers of attorney, and other estate planning documents', 21, 'ri-draft-line', '#299cdb'),

('Estate', 4, 'Review Meeting', 'Meet with attorney to review draft documents and discuss any questions or changes needed', 7, 'ri-eye-line', '#f7b84b'),

('Estate', 5, 'Document Execution', 'Formal signing and notarization of all estate planning documents', 3, 'ri-quill-pen-line', '#405189'),

('Estate', 6, 'Trust Funding', 'Transfer assets into trust and update beneficiary designations as needed', 30, 'ri-bank-line', '#3577f1'),

('Estate', 7, 'Plan Delivered', 'Receive final copies of all documents with storage and next steps guidance', 7, 'ri-checkbox-circle-line', '#0ab39c');

-- Also reset any cases that were initialized with old Estate phases
UPDATE legal_cases SET timeline_initialized = 0, current_timeline_phase = 1
WHERE type LIKE '%ESTATE%' AND type NOT LIKE '%REAL%' AND timeline_initialized = 1;

DELETE FROM case_timeline_progress
WHERE case_id IN (SELECT id FROM legal_cases WHERE type LIKE '%ESTATE%' AND type NOT LIKE '%REAL%');
