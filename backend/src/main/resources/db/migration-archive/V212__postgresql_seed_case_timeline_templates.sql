-- Migration: V212__postgresql_seed_case_timeline_templates.sql
-- Description: Seed case timeline templates for all case types
-- Database: PostgreSQL

-- Clear existing templates (if any) to avoid duplicates
DELETE FROM case_timeline_templates;

-- =============================================
-- PERSONAL INJURY TIMELINE TEMPLATES
-- =============================================
INSERT INTO case_timeline_templates (case_type, phase_order, phase_name, phase_description, estimated_duration_days, icon, color, created_at, updated_at)
VALUES
('Personal Injury', 1, 'Initial Consultation', 'Client intake, gather basic facts about the accident, injuries, and potential liability. Review medical records and insurance information.', 7, 'ri-user-voice-line', '#405189', NOW(), NOW()),
('Personal Injury', 2, 'Investigation', 'Collect evidence including police reports, witness statements, photos, video footage. Identify all potentially liable parties.', 30, 'ri-search-eye-line', '#3577f1', NOW(), NOW()),
('Personal Injury', 3, 'Medical Treatment', 'Client receives ongoing medical treatment. Document all medical expenses, procedures, and prognosis.', 90, 'ri-heart-pulse-line', '#299cdb', NOW(), NOW()),
('Personal Injury', 4, 'Demand Letter', 'Prepare and send demand letter to insurance company with documented damages and settlement demand.', 14, 'ri-mail-send-line', '#f7b84b', NOW(), NOW()),
('Personal Injury', 5, 'Negotiation', 'Negotiate with insurance adjusters. Review and counter settlement offers.', 45, 'ri-discuss-line', '#f06548', NOW(), NOW()),
('Personal Injury', 6, 'Litigation Filed', 'If settlement not reached, file lawsuit in appropriate court. Serve defendants.', 14, 'ri-file-paper-2-line', '#e83e8c', NOW(), NOW()),
('Personal Injury', 7, 'Discovery', 'Exchange interrogatories, requests for production, depositions of parties and witnesses.', 90, 'ri-folder-search-line', '#6f42c1', NOW(), NOW()),
('Personal Injury', 8, 'Mediation', 'Attempt settlement through court-ordered or voluntary mediation.', 30, 'ri-team-line', '#0dcaf0', NOW(), NOW()),
('Personal Injury', 9, 'Trial Preparation', 'Prepare trial exhibits, witness lists, motions in limine, and trial brief.', 30, 'ri-draft-line', '#fd7e14', NOW(), NOW()),
('Personal Injury', 10, 'Trial/Resolution', 'Present case at trial or finalize settlement agreement. Close case.', 14, 'ri-checkbox-circle-line', '#0ab39c', NOW(), NOW());

-- =============================================
-- CRIMINAL DEFENSE TIMELINE TEMPLATES
-- =============================================
INSERT INTO case_timeline_templates (case_type, phase_order, phase_name, phase_description, estimated_duration_days, icon, color, created_at, updated_at)
VALUES
('Criminal Defense', 1, 'Arrest/Arraignment', 'Client arrested or summoned. Initial court appearance, bail hearing, enter plea.', 3, 'ri-alarm-warning-line', '#f06548', NOW(), NOW()),
('Criminal Defense', 2, 'Case Review', 'Review police reports, charging documents, and initial evidence. Identify defense strategy.', 14, 'ri-file-search-line', '#405189', NOW(), NOW()),
('Criminal Defense', 3, 'Discovery', 'Request and review all prosecution evidence including reports, witness statements, video/audio.', 30, 'ri-folder-open-line', '#3577f1', NOW(), NOW()),
('Criminal Defense', 4, 'Investigation', 'Conduct independent investigation, interview witnesses, gather alibi evidence, hire experts.', 45, 'ri-search-line', '#299cdb', NOW(), NOW()),
('Criminal Defense', 5, 'Pretrial Motions', 'File motions to suppress evidence, dismiss charges, or challenge procedures.', 30, 'ri-draft-line', '#f7b84b', NOW(), NOW()),
('Criminal Defense', 6, 'Plea Negotiations', 'Negotiate with prosecutor for reduced charges or favorable plea agreement.', 30, 'ri-discuss-line', '#6f42c1', NOW(), NOW()),
('Criminal Defense', 7, 'Trial Preparation', 'Prepare defense witnesses, exhibits, jury instructions, opening/closing arguments.', 21, 'ri-book-open-line', '#fd7e14', NOW(), NOW()),
('Criminal Defense', 8, 'Trial', 'Present defense case to judge or jury. Cross-examine prosecution witnesses.', 14, 'ri-scales-3-line', '#e83e8c', NOW(), NOW()),
('Criminal Defense', 9, 'Sentencing/Appeal', 'If convicted, prepare sentencing memorandum. Consider and file appeal if appropriate.', 30, 'ri-government-line', '#0dcaf0', NOW(), NOW()),
('Criminal Defense', 10, 'Case Closed', 'Final resolution - acquittal, conviction, dismissal, or plea. Close file.', 7, 'ri-checkbox-circle-line', '#0ab39c', NOW(), NOW());

-- =============================================
-- FAMILY LAW TIMELINE TEMPLATES
-- =============================================
INSERT INTO case_timeline_templates (case_type, phase_order, phase_name, phase_description, estimated_duration_days, icon, color, created_at, updated_at)
VALUES
('Family Law', 1, 'Initial Consultation', 'Meet with client to understand family situation, goals, and gather relevant documents.', 7, 'ri-user-heart-line', '#405189', NOW(), NOW()),
('Family Law', 2, 'Case Filing', 'Prepare and file petition for divorce, custody, support, or other family matter.', 14, 'ri-file-paper-line', '#3577f1', NOW(), NOW()),
('Family Law', 3, 'Temporary Orders', 'Request temporary custody, support, and restraining orders as needed.', 21, 'ri-timer-line', '#f7b84b', NOW(), NOW()),
('Family Law', 4, 'Discovery', 'Exchange financial documents, interrogatories, and conduct depositions.', 60, 'ri-folder-search-line', '#299cdb', NOW(), NOW()),
('Family Law', 5, 'Custody Evaluation', 'If contested custody, participate in guardian ad litem or custody evaluation process.', 45, 'ri-parent-line', '#e83e8c', NOW(), NOW()),
('Family Law', 6, 'Asset Valuation', 'Obtain appraisals of real estate, businesses, retirement accounts, and other assets.', 30, 'ri-money-dollar-circle-line', '#6f42c1', NOW(), NOW()),
('Family Law', 7, 'Mediation', 'Attempt to resolve disputes through mediation before trial.', 30, 'ri-team-line', '#0dcaf0', NOW(), NOW()),
('Family Law', 8, 'Settlement Negotiation', 'Negotiate terms of divorce agreement, parenting plan, and support.', 30, 'ri-discuss-line', '#fd7e14', NOW(), NOW()),
('Family Law', 9, 'Trial', 'If settlement not reached, present case to judge for determination.', 14, 'ri-scales-3-line', '#f06548', NOW(), NOW()),
('Family Law', 10, 'Judgment Entry', 'Finalize and enter divorce decree or other court orders. Close case.', 14, 'ri-checkbox-circle-line', '#0ab39c', NOW(), NOW());

-- =============================================
-- IMMIGRATION TIMELINE TEMPLATES
-- =============================================
INSERT INTO case_timeline_templates (case_type, phase_order, phase_name, phase_description, estimated_duration_days, icon, color, created_at, updated_at)
VALUES
('Immigration', 1, 'Initial Assessment', 'Evaluate client eligibility for visa, green card, citizenship, or other immigration benefit.', 14, 'ri-passport-line', '#405189', NOW(), NOW()),
('Immigration', 2, 'Document Collection', 'Gather required documents: passport, birth certificates, marriage certificates, employment records.', 30, 'ri-folder-3-line', '#3577f1', NOW(), NOW()),
('Immigration', 3, 'Form Preparation', 'Complete required USCIS forms with accurate information and supporting documentation.', 21, 'ri-draft-line', '#299cdb', NOW(), NOW()),
('Immigration', 4, 'Petition Filing', 'File petition with USCIS along with fees and supporting evidence.', 7, 'ri-upload-cloud-line', '#f7b84b', NOW(), NOW()),
('Immigration', 5, 'Receipt Notice', 'Receive case receipt number and track case status online.', 30, 'ri-mail-check-line', '#6f42c1', NOW(), NOW()),
('Immigration', 6, 'Biometrics', 'Attend biometrics appointment for fingerprinting and photos.', 45, 'ri-fingerprint-line', '#0dcaf0', NOW(), NOW()),
('Immigration', 7, 'RFE Response', 'Respond to any Request for Evidence from USCIS with additional documentation.', 60, 'ri-questionnaire-line', '#fd7e14', NOW(), NOW()),
('Immigration', 8, 'Interview Prep', 'Prepare client for immigration interview with mock questions and document review.', 14, 'ri-question-answer-line', '#e83e8c', NOW(), NOW()),
('Immigration', 9, 'Interview', 'Attend USCIS interview with client. Present case to immigration officer.', 1, 'ri-user-voice-line', '#f06548', NOW(), NOW()),
('Immigration', 10, 'Approval/Decision', 'Receive case decision. If approved, receive visa/green card. Close case.', 30, 'ri-checkbox-circle-line', '#0ab39c', NOW(), NOW());

-- =============================================
-- REAL ESTATE TIMELINE TEMPLATES
-- =============================================
INSERT INTO case_timeline_templates (case_type, phase_order, phase_name, phase_description, estimated_duration_days, icon, color, created_at, updated_at)
VALUES
('Real Estate', 1, 'Contract Review', 'Review purchase/sale agreement, identify contingencies and negotiation points.', 7, 'ri-file-text-line', '#405189', NOW(), NOW()),
('Real Estate', 2, 'Title Search', 'Order and review title search to identify liens, encumbrances, or defects.', 14, 'ri-search-line', '#3577f1', NOW(), NOW()),
('Real Estate', 3, 'Inspection Period', 'Coordinate property inspection, review reports, negotiate repairs.', 14, 'ri-home-gear-line', '#299cdb', NOW(), NOW()),
('Real Estate', 4, 'Financing', 'Coordinate with lender on mortgage approval, review loan documents.', 30, 'ri-bank-line', '#f7b84b', NOW(), NOW()),
('Real Estate', 5, 'Survey Review', 'Review property survey, identify boundary issues or encroachments.', 14, 'ri-map-pin-line', '#6f42c1', NOW(), NOW()),
('Real Estate', 6, 'Title Insurance', 'Order title insurance policy, review exceptions and endorsements.', 7, 'ri-shield-check-line', '#0dcaf0', NOW(), NOW()),
('Real Estate', 7, 'Document Preparation', 'Prepare deed, settlement statement, transfer tax forms, and closing documents.', 7, 'ri-draft-line', '#fd7e14', NOW(), NOW()),
('Real Estate', 8, 'Final Walkthrough', 'Coordinate final property walkthrough before closing.', 3, 'ri-walk-line', '#e83e8c', NOW(), NOW()),
('Real Estate', 9, 'Closing', 'Attend closing, oversee document signing, disburse funds.', 1, 'ri-key-2-line', '#f06548', NOW(), NOW()),
('Real Estate', 10, 'Post-Closing', 'Record deed, disburse final funds, send closing package. Close file.', 7, 'ri-checkbox-circle-line', '#0ab39c', NOW(), NOW());

-- =============================================
-- ESTATE/PROBATE TIMELINE TEMPLATES
-- =============================================
INSERT INTO case_timeline_templates (case_type, phase_order, phase_name, phase_description, estimated_duration_days, icon, color, created_at, updated_at)
VALUES
('Estate', 1, 'Initial Meeting', 'Meet with executor/administrator, review will, identify assets and beneficiaries.', 14, 'ri-user-settings-line', '#405189', NOW(), NOW()),
('Estate', 2, 'Probate Filing', 'File petition for probate, appointment of executor/administrator.', 14, 'ri-file-paper-2-line', '#3577f1', NOW(), NOW()),
('Estate', 3, 'Notice to Creditors', 'Publish notice to creditors, notify known creditors of estate.', 14, 'ri-newspaper-line', '#299cdb', NOW(), NOW()),
('Estate', 4, 'Asset Inventory', 'Prepare inventory of all estate assets with valuations.', 45, 'ri-list-check-2', '#f7b84b', NOW(), NOW()),
('Estate', 5, 'Creditor Claims', 'Review and pay or dispute creditor claims against estate.', 90, 'ri-money-dollar-box-line', '#6f42c1', NOW(), NOW()),
('Estate', 6, 'Tax Filings', 'Prepare and file estate tax returns, obtain tax clearances.', 60, 'ri-calculator-line', '#0dcaf0', NOW(), NOW()),
('Estate', 7, 'Asset Sales', 'If necessary, sell estate property to pay debts or distribute.', 45, 'ri-auction-line', '#fd7e14', NOW(), NOW()),
('Estate', 8, 'Distribution Plan', 'Prepare accounting and proposed distribution to beneficiaries.', 14, 'ri-pie-chart-line', '#e83e8c', NOW(), NOW()),
('Estate', 9, 'Final Distribution', 'Distribute assets to beneficiaries, obtain receipts.', 30, 'ri-hand-coin-line', '#f06548', NOW(), NOW()),
('Estate', 10, 'Estate Closing', 'File final accounting, obtain court approval, close estate.', 30, 'ri-checkbox-circle-line', '#0ab39c', NOW(), NOW());

-- =============================================
-- BUSINESS/GENERAL LITIGATION TIMELINE TEMPLATES
-- =============================================
INSERT INTO case_timeline_templates (case_type, phase_order, phase_name, phase_description, estimated_duration_days, icon, color, created_at, updated_at)
VALUES
('Business', 1, 'Case Assessment', 'Review facts, documents, and potential claims or defenses. Assess case value.', 14, 'ri-briefcase-line', '#405189', NOW(), NOW()),
('Business', 2, 'Demand/Response', 'Send demand letter or respond to claims. Attempt early resolution.', 30, 'ri-mail-line', '#3577f1', NOW(), NOW()),
('Business', 3, 'Pleadings', 'File complaint or answer. Prepare initial court filings.', 21, 'ri-file-paper-line', '#299cdb', NOW(), NOW()),
('Business', 4, 'Written Discovery', 'Prepare and respond to interrogatories and document requests.', 60, 'ri-questionnaire-line', '#f7b84b', NOW(), NOW()),
('Business', 5, 'Depositions', 'Conduct and defend depositions of parties and key witnesses.', 45, 'ri-video-line', '#6f42c1', NOW(), NOW()),
('Business', 6, 'Expert Discovery', 'Identify, retain, and prepare expert witnesses. Review opposing experts.', 45, 'ri-user-star-line', '#0dcaf0', NOW(), NOW()),
('Business', 7, 'Dispositive Motions', 'File or respond to motions for summary judgment.', 45, 'ri-draft-line', '#fd7e14', NOW(), NOW()),
('Business', 8, 'Settlement Conference', 'Participate in court-ordered or voluntary settlement discussions.', 14, 'ri-discuss-line', '#e83e8c', NOW(), NOW()),
('Business', 9, 'Trial', 'Present case at trial before judge or jury.', 14, 'ri-scales-3-line', '#f06548', NOW(), NOW()),
('Business', 10, 'Resolution', 'Final judgment, settlement agreement, or appeal. Close matter.', 30, 'ri-checkbox-circle-line', '#0ab39c', NOW(), NOW());

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Case timeline templates seeded successfully: % rows inserted',
    (SELECT COUNT(*) FROM case_timeline_templates);
END $$;
