-- Case Timeline Tables for Visual Case Progress Tracking
-- This enables the visual case timeline feature in the client portal

-- Table to define timeline phase templates per case type
CREATE TABLE case_timeline_templates (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    case_type VARCHAR(100) NOT NULL,
    phase_order INT NOT NULL,
    phase_name VARCHAR(100) NOT NULL,
    phase_description TEXT,
    estimated_duration_days INT DEFAULT NULL,
    icon VARCHAR(50) DEFAULT 'ri-checkbox-circle-line',
    color VARCHAR(20) DEFAULT '#405189',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_case_type_phase (case_type, phase_order)
);

-- Table to track actual case timeline progress
CREATE TABLE case_timeline_progress (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    case_id BIGINT UNSIGNED NOT NULL,
    phase_name VARCHAR(100) NOT NULL,
    phase_order INT NOT NULL,
    status ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED') DEFAULT 'PENDING',
    started_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    notes TEXT,
    updated_by BIGINT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES legal_cases(id) ON DELETE CASCADE,
    UNIQUE KEY unique_case_phase (case_id, phase_order)
);

-- Add current timeline phase to legal_cases table
ALTER TABLE legal_cases
ADD COLUMN current_timeline_phase INT DEFAULT 1,
ADD COLUMN timeline_initialized BOOLEAN DEFAULT FALSE;

-- Insert default timeline templates for common case types

-- Personal Injury Timeline
INSERT INTO case_timeline_templates (case_type, phase_order, phase_name, phase_description, estimated_duration_days, icon, color) VALUES
('Personal Injury', 1, 'Case Filed', 'Initial case filing and documentation submitted to the court', 7, 'ri-file-text-line', '#405189'),
('Personal Injury', 2, 'Investigation', 'Gathering evidence, police reports, medical records, and witness statements', 30, 'ri-search-line', '#3577f1'),
('Personal Injury', 3, 'Medical Treatment', 'Ongoing medical care and documentation of injuries and treatment', 90, 'ri-heart-pulse-line', '#0ab39c'),
('Personal Injury', 4, 'Demand Letter', 'Formal demand sent to insurance company with settlement amount', 14, 'ri-mail-send-line', '#f7b84b'),
('Personal Injury', 5, 'Negotiation', 'Settlement negotiations with opposing party or insurance', 45, 'ri-discuss-line', '#299cdb'),
('Personal Injury', 6, 'Discovery', 'Exchange of information, interrogatories, and document requests', 60, 'ri-folder-search-line', '#405189'),
('Personal Injury', 7, 'Depositions', 'Sworn testimony from parties and witnesses', 30, 'ri-user-voice-line', '#3577f1'),
('Personal Injury', 8, 'Mediation', 'Formal mediation session with neutral mediator', 1, 'ri-scales-3-line', '#f06548'),
('Personal Injury', 9, 'Trial Preparation', 'Final preparation for trial including witness prep and exhibits', 30, 'ri-draft-line', '#f7b84b'),
('Personal Injury', 10, 'Trial/Resolution', 'Court trial or final settlement reached', 14, 'ri-gavel-line', '#0ab39c');

-- Criminal Defense Timeline
INSERT INTO case_timeline_templates (case_type, phase_order, phase_name, phase_description, estimated_duration_days, icon, color) VALUES
('Criminal Defense', 1, 'Arrest/Charges', 'Initial arrest and formal charges filed', 1, 'ri-alarm-warning-line', '#f06548'),
('Criminal Defense', 2, 'Arraignment', 'Initial court appearance, plea entered, bail set', 7, 'ri-scales-3-line', '#405189'),
('Criminal Defense', 3, 'Discovery', 'Review of prosecution evidence and police reports', 30, 'ri-folder-search-line', '#3577f1'),
('Criminal Defense', 4, 'Investigation', 'Defense investigation, witness interviews, evidence gathering', 45, 'ri-search-line', '#299cdb'),
('Criminal Defense', 5, 'Pre-Trial Motions', 'Filing motions to suppress evidence, dismiss charges, etc.', 30, 'ri-file-list-3-line', '#f7b84b'),
('Criminal Defense', 6, 'Plea Negotiations', 'Discussions with prosecution for potential plea agreement', 30, 'ri-discuss-line', '#0ab39c'),
('Criminal Defense', 7, 'Trial Preparation', 'Witness preparation, exhibit organization, strategy finalization', 21, 'ri-draft-line', '#405189'),
('Criminal Defense', 8, 'Trial', 'Court trial with jury or bench trial', 14, 'ri-gavel-line', '#f06548'),
('Criminal Defense', 9, 'Verdict/Sentencing', 'Jury verdict and sentencing if applicable', 7, 'ri-checkbox-circle-line', '#0ab39c');

-- Family Law Timeline
INSERT INTO case_timeline_templates (case_type, phase_order, phase_name, phase_description, estimated_duration_days, icon, color) VALUES
('Family Law', 1, 'Petition Filed', 'Initial divorce/custody petition filed with court', 7, 'ri-file-text-line', '#405189'),
('Family Law', 2, 'Service of Process', 'Spouse served with legal documents', 14, 'ri-mail-line', '#3577f1'),
('Family Law', 3, 'Response Period', 'Waiting period for spouse to respond to petition', 30, 'ri-time-line', '#f7b84b'),
('Family Law', 4, 'Temporary Orders', 'Court hearing for temporary custody, support, and property orders', 14, 'ri-scales-3-line', '#299cdb'),
('Family Law', 5, 'Discovery', 'Exchange of financial documents and information', 60, 'ri-folder-search-line', '#405189'),
('Family Law', 6, 'Negotiation', 'Settlement discussions between parties', 45, 'ri-discuss-line', '#0ab39c'),
('Family Law', 7, 'Mediation', 'Formal mediation to resolve disputes', 1, 'ri-team-line', '#f06548'),
('Family Law', 8, 'Trial Preparation', 'Preparation for contested hearing if needed', 30, 'ri-draft-line', '#f7b84b'),
('Family Law', 9, 'Final Hearing', 'Court hearing for final divorce/custody decree', 7, 'ri-gavel-line', '#405189'),
('Family Law', 10, 'Decree Entered', 'Final judgment entered and case closed', 7, 'ri-checkbox-circle-line', '#0ab39c');

-- Immigration Timeline
INSERT INTO case_timeline_templates (case_type, phase_order, phase_name, phase_description, estimated_duration_days, icon, color) VALUES
('Immigration', 1, 'Application Filed', 'Immigration application submitted to USCIS', 7, 'ri-file-text-line', '#405189'),
('Immigration', 2, 'Receipt Notice', 'USCIS acknowledges receipt of application', 30, 'ri-mail-check-line', '#3577f1'),
('Immigration', 3, 'Biometrics', 'Fingerprinting and photo appointment', 45, 'ri-fingerprint-line', '#299cdb'),
('Immigration', 4, 'Background Check', 'Security and background verification', 90, 'ri-shield-check-line', '#f7b84b'),
('Immigration', 5, 'Interview Scheduled', 'Interview appointment notice received', 120, 'ri-calendar-check-line', '#405189'),
('Immigration', 6, 'Interview', 'In-person interview with USCIS officer', 1, 'ri-user-voice-line', '#f06548'),
('Immigration', 7, 'Decision', 'Application approved, denied, or additional evidence requested', 30, 'ri-checkbox-circle-line', '#0ab39c');

-- Business/Corporate Timeline
INSERT INTO case_timeline_templates (case_type, phase_order, phase_name, phase_description, estimated_duration_days, icon, color) VALUES
('Business', 1, 'Case Assessment', 'Initial review and legal strategy development', 14, 'ri-search-eye-line', '#405189'),
('Business', 2, 'Document Review', 'Review of contracts, agreements, and business documents', 21, 'ri-file-search-line', '#3577f1'),
('Business', 3, 'Demand/Response', 'Formal demand letter or response to opposing party', 14, 'ri-mail-send-line', '#f7b84b'),
('Business', 4, 'Negotiation', 'Business negotiations and settlement discussions', 45, 'ri-discuss-line', '#299cdb'),
('Business', 5, 'Litigation Filed', 'Formal lawsuit filed if settlement not reached', 7, 'ri-file-text-line', '#f06548'),
('Business', 6, 'Discovery', 'Document production and interrogatories', 90, 'ri-folder-search-line', '#405189'),
('Business', 7, 'Depositions', 'Witness and party depositions', 30, 'ri-user-voice-line', '#3577f1'),
('Business', 8, 'Mediation/Arbitration', 'Alternative dispute resolution', 7, 'ri-scales-3-line', '#0ab39c'),
('Business', 9, 'Trial/Resolution', 'Court trial or final settlement', 30, 'ri-gavel-line', '#0ab39c');

-- Estate Planning Timeline
INSERT INTO case_timeline_templates (case_type, phase_order, phase_name, phase_description, estimated_duration_days, icon, color) VALUES
('Estate', 1, 'Initial Consultation', 'Review of assets, family situation, and goals', 7, 'ri-discuss-line', '#405189'),
('Estate', 2, 'Document Drafting', 'Preparation of will, trust, and related documents', 21, 'ri-draft-line', '#3577f1'),
('Estate', 3, 'Client Review', 'Client reviews draft documents', 14, 'ri-eye-line', '#f7b84b'),
('Estate', 4, 'Revisions', 'Incorporate client feedback and changes', 7, 'ri-edit-line', '#299cdb'),
('Estate', 5, 'Execution', 'Formal signing and notarization of documents', 1, 'ri-quill-pen-line', '#0ab39c'),
('Estate', 6, 'Funding', 'Transfer assets to trust if applicable', 30, 'ri-bank-line', '#405189'),
('Estate', 7, 'Completed', 'Estate plan finalized and delivered to client', 7, 'ri-checkbox-circle-line', '#0ab39c');

-- Real Estate Timeline
INSERT INTO case_timeline_templates (case_type, phase_order, phase_name, phase_description, estimated_duration_days, icon, color) VALUES
('Real Estate', 1, 'Contract Review', 'Review of purchase/sale agreement', 7, 'ri-file-search-line', '#405189'),
('Real Estate', 2, 'Due Diligence', 'Title search, inspections, and contingency review', 21, 'ri-search-line', '#3577f1'),
('Real Estate', 3, 'Financing', 'Loan approval and mortgage documentation', 30, 'ri-bank-line', '#f7b84b'),
('Real Estate', 4, 'Title Review', 'Review of title commitment and resolve issues', 14, 'ri-file-shield-line', '#299cdb'),
('Real Estate', 5, 'Closing Preparation', 'Prepare closing documents and final walkthrough', 7, 'ri-draft-line', '#405189'),
('Real Estate', 6, 'Closing', 'Sign documents and transfer ownership', 1, 'ri-quill-pen-line', '#0ab39c'),
('Real Estate', 7, 'Recording', 'Deed recorded and transaction completed', 7, 'ri-checkbox-circle-line', '#0ab39c');

-- Create indexes for performance
CREATE INDEX idx_timeline_progress_case ON case_timeline_progress(case_id);
CREATE INDEX idx_timeline_templates_case_type ON case_timeline_templates(case_type);
