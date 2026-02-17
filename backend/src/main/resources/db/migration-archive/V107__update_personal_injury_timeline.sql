-- Update Personal Injury Timeline with accurate attorney workflow phases
-- These phases reflect the actual process a personal injury attorney follows

-- First, delete the existing Personal Injury phases
DELETE FROM case_timeline_templates WHERE case_type = 'Personal Injury';

-- Insert accurate Personal Injury timeline phases
INSERT INTO case_timeline_templates (case_type, phase_order, phase_name, phase_description, estimated_duration_days, icon, color) VALUES

-- Pre-Litigation Phase
('Personal Injury', 1, 'Initial Consultation', 'Meet with client, evaluate the case, review accident details, and sign retainer agreement', 3, 'ri-discuss-line', '#405189'),

('Personal Injury', 2, 'Investigation', 'Gather police reports, accident scene photos, witness statements, and insurance information', 14, 'ri-search-line', '#3577f1'),

('Personal Injury', 3, 'Medical Treatment', 'Client receives ongoing medical care while attorney collects medical records and bills', 90, 'ri-heart-pulse-line', '#0ab39c'),

('Personal Injury', 4, 'Maximum Medical Improvement', 'Client reaches MMI - the point where their condition has stabilized and further recovery is not expected', 30, 'ri-stethoscope-line', '#299cdb'),

('Personal Injury', 5, 'Demand Package', 'Compile all evidence, medical records, bills, lost wages, and send formal demand letter to insurance company', 14, 'ri-mail-send-line', '#f7b84b'),

-- Negotiation Phase
('Personal Injury', 6, 'Insurance Negotiation', 'Back-and-forth settlement negotiations with insurance adjuster to reach fair compensation', 45, 'ri-discuss-line', '#405189'),

-- Litigation Phase (if no settlement reached)
('Personal Injury', 7, 'File Lawsuit', 'If settlement negotiations fail, file formal complaint in court to initiate litigation', 7, 'ri-file-paper-2-line', '#f06548'),

('Personal Injury', 8, 'Discovery', 'Exchange of information between parties including interrogatories, document requests, and expert disclosures', 90, 'ri-folder-search-line', '#3577f1'),

('Personal Injury', 9, 'Depositions', 'Sworn testimony taken from parties, witnesses, and expert witnesses', 30, 'ri-user-voice-line', '#299cdb'),

('Personal Injury', 10, 'Mediation', 'Attempt to settle case with help of neutral mediator before going to trial', 7, 'ri-scales-3-line', '#f7b84b'),

('Personal Injury', 11, 'Trial Preparation', 'Prepare exhibits, witness lists, motions in limine, and trial strategy', 30, 'ri-draft-line', '#405189'),

('Personal Injury', 12, 'Trial', 'Present case before judge or jury for final determination', 14, 'ri-gavel-line', '#f06548'),

-- Resolution Phase
('Personal Injury', 13, 'Settlement & Disbursement', 'Finalize settlement, negotiate and pay medical liens, and disburse funds to client', 14, 'ri-money-dollar-circle-line', '#0ab39c');
