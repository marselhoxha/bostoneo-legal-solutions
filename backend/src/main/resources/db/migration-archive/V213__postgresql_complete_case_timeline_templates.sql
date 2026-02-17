-- Migration: V213__postgresql_complete_case_timeline_templates.sql
-- Description: Complete case timeline templates for ALL case types
-- Database: PostgreSQL

-- Clear existing templates to rebuild with complete set
DELETE FROM case_timeline_templates;

-- =============================================
-- PERSONAL INJURY TIMELINE TEMPLATES
-- =============================================
INSERT INTO case_timeline_templates (case_type, phase_order, phase_name, phase_description, estimated_duration_days, icon, color, created_at, updated_at)
VALUES
('Personal Injury', 1, 'Initial Consultation', 'Client intake, gather basic facts about the accident, injuries, and potential liability.', 7, 'ri-user-voice-line', '#405189', NOW(), NOW()),
('Personal Injury', 2, 'Investigation', 'Collect evidence including police reports, witness statements, photos, video footage.', 30, 'ri-search-eye-line', '#3577f1', NOW(), NOW()),
('Personal Injury', 3, 'Medical Treatment', 'Client receives ongoing medical treatment. Document all medical expenses and prognosis.', 90, 'ri-heart-pulse-line', '#299cdb', NOW(), NOW()),
('Personal Injury', 4, 'Demand Letter', 'Prepare and send demand letter to insurance company with documented damages.', 14, 'ri-mail-send-line', '#f7b84b', NOW(), NOW()),
('Personal Injury', 5, 'Negotiation', 'Negotiate with insurance adjusters. Review and counter settlement offers.', 45, 'ri-discuss-line', '#f06548', NOW(), NOW()),
('Personal Injury', 6, 'Litigation Filed', 'If settlement not reached, file lawsuit in appropriate court.', 14, 'ri-file-paper-2-line', '#e83e8c', NOW(), NOW()),
('Personal Injury', 7, 'Discovery', 'Exchange interrogatories, requests for production, depositions.', 90, 'ri-folder-search-line', '#6f42c1', NOW(), NOW()),
('Personal Injury', 8, 'Mediation', 'Attempt settlement through mediation.', 30, 'ri-team-line', '#0dcaf0', NOW(), NOW()),
('Personal Injury', 9, 'Trial Preparation', 'Prepare trial exhibits, witness lists, motions in limine.', 30, 'ri-draft-line', '#fd7e14', NOW(), NOW()),
('Personal Injury', 10, 'Trial/Resolution', 'Present case at trial or finalize settlement. Close case.', 14, 'ri-checkbox-circle-line', '#0ab39c', NOW(), NOW());

-- =============================================
-- MEDICAL MALPRACTICE TIMELINE TEMPLATES
-- =============================================
INSERT INTO case_timeline_templates (case_type, phase_order, phase_name, phase_description, estimated_duration_days, icon, color, created_at, updated_at)
VALUES
('Medical Malpractice', 1, 'Initial Consultation', 'Review medical records, understand patient history and alleged negligence.', 14, 'ri-stethoscope-line', '#405189', NOW(), NOW()),
('Medical Malpractice', 2, 'Medical Records Collection', 'Obtain complete medical records from all treating providers.', 30, 'ri-file-list-3-line', '#3577f1', NOW(), NOW()),
('Medical Malpractice', 3, 'Expert Review', 'Have medical expert review records to determine standard of care breach.', 45, 'ri-user-star-line', '#299cdb', NOW(), NOW()),
('Medical Malpractice', 4, 'Certificate of Merit', 'Obtain required certificate of merit from qualified medical expert.', 30, 'ri-award-line', '#f7b84b', NOW(), NOW()),
('Medical Malpractice', 5, 'Complaint Filed', 'File medical malpractice complaint with court.', 14, 'ri-file-paper-2-line', '#f06548', NOW(), NOW()),
('Medical Malpractice', 6, 'Discovery', 'Written discovery, medical record subpoenas, expert depositions.', 120, 'ri-folder-search-line', '#6f42c1', NOW(), NOW()),
('Medical Malpractice', 7, 'Expert Depositions', 'Depose opposing medical experts and defend our experts.', 60, 'ri-video-line', '#0dcaf0', NOW(), NOW()),
('Medical Malpractice', 8, 'Mediation', 'Attempt settlement through mediation with all parties.', 30, 'ri-team-line', '#fd7e14', NOW(), NOW()),
('Medical Malpractice', 9, 'Trial Preparation', 'Prepare medical exhibits, expert testimony, demonstratives.', 45, 'ri-draft-line', '#e83e8c', NOW(), NOW()),
('Medical Malpractice', 10, 'Trial/Resolution', 'Present case at trial or finalize settlement.', 21, 'ri-checkbox-circle-line', '#0ab39c', NOW(), NOW());

-- =============================================
-- CRIMINAL DEFENSE TIMELINE TEMPLATES
-- =============================================
INSERT INTO case_timeline_templates (case_type, phase_order, phase_name, phase_description, estimated_duration_days, icon, color, created_at, updated_at)
VALUES
('Criminal Defense', 1, 'Arrest/Arraignment', 'Initial court appearance, bail hearing, enter plea.', 3, 'ri-alarm-warning-line', '#f06548', NOW(), NOW()),
('Criminal Defense', 2, 'Case Review', 'Review police reports, charging documents, initial evidence.', 14, 'ri-file-search-line', '#405189', NOW(), NOW()),
('Criminal Defense', 3, 'Discovery', 'Request and review all prosecution evidence.', 30, 'ri-folder-open-line', '#3577f1', NOW(), NOW()),
('Criminal Defense', 4, 'Investigation', 'Conduct independent investigation, interview witnesses.', 45, 'ri-search-line', '#299cdb', NOW(), NOW()),
('Criminal Defense', 5, 'Pretrial Motions', 'File motions to suppress evidence or dismiss charges.', 30, 'ri-draft-line', '#f7b84b', NOW(), NOW()),
('Criminal Defense', 6, 'Plea Negotiations', 'Negotiate with prosecutor for reduced charges or plea agreement.', 30, 'ri-discuss-line', '#6f42c1', NOW(), NOW()),
('Criminal Defense', 7, 'Trial Preparation', 'Prepare defense witnesses, exhibits, jury instructions.', 21, 'ri-book-open-line', '#fd7e14', NOW(), NOW()),
('Criminal Defense', 8, 'Trial', 'Present defense case to judge or jury.', 14, 'ri-scales-3-line', '#e83e8c', NOW(), NOW()),
('Criminal Defense', 9, 'Sentencing/Appeal', 'If convicted, prepare sentencing memorandum or appeal.', 30, 'ri-government-line', '#0dcaf0', NOW(), NOW()),
('Criminal Defense', 10, 'Case Closed', 'Final resolution - acquittal, conviction, or dismissal.', 7, 'ri-checkbox-circle-line', '#0ab39c', NOW(), NOW());

-- =============================================
-- FAMILY LAW TIMELINE TEMPLATES
-- =============================================
INSERT INTO case_timeline_templates (case_type, phase_order, phase_name, phase_description, estimated_duration_days, icon, color, created_at, updated_at)
VALUES
('Family Law', 1, 'Initial Consultation', 'Meet with client to understand family situation and goals.', 7, 'ri-user-heart-line', '#405189', NOW(), NOW()),
('Family Law', 2, 'Case Filing', 'Prepare and file petition for divorce, custody, or support.', 14, 'ri-file-paper-line', '#3577f1', NOW(), NOW()),
('Family Law', 3, 'Temporary Orders', 'Request temporary custody, support, and restraining orders.', 21, 'ri-timer-line', '#f7b84b', NOW(), NOW()),
('Family Law', 4, 'Discovery', 'Exchange financial documents and conduct depositions.', 60, 'ri-folder-search-line', '#299cdb', NOW(), NOW()),
('Family Law', 5, 'Custody Evaluation', 'Participate in guardian ad litem or custody evaluation.', 45, 'ri-parent-line', '#e83e8c', NOW(), NOW()),
('Family Law', 6, 'Asset Valuation', 'Obtain appraisals of real estate, businesses, retirement.', 30, 'ri-money-dollar-circle-line', '#6f42c1', NOW(), NOW()),
('Family Law', 7, 'Mediation', 'Attempt to resolve disputes through mediation.', 30, 'ri-team-line', '#0dcaf0', NOW(), NOW()),
('Family Law', 8, 'Settlement Negotiation', 'Negotiate terms of agreement and parenting plan.', 30, 'ri-discuss-line', '#fd7e14', NOW(), NOW()),
('Family Law', 9, 'Trial', 'If settlement not reached, present case to judge.', 14, 'ri-scales-3-line', '#f06548', NOW(), NOW()),
('Family Law', 10, 'Judgment Entry', 'Finalize and enter divorce decree or court orders.', 14, 'ri-checkbox-circle-line', '#0ab39c', NOW(), NOW());

-- =============================================
-- IMMIGRATION TIMELINE TEMPLATES
-- =============================================
INSERT INTO case_timeline_templates (case_type, phase_order, phase_name, phase_description, estimated_duration_days, icon, color, created_at, updated_at)
VALUES
('Immigration', 1, 'Initial Assessment', 'Evaluate eligibility for visa, green card, or citizenship.', 14, 'ri-passport-line', '#405189', NOW(), NOW()),
('Immigration', 2, 'Document Collection', 'Gather required documents: passport, certificates, records.', 30, 'ri-folder-3-line', '#3577f1', NOW(), NOW()),
('Immigration', 3, 'Form Preparation', 'Complete required USCIS forms with supporting documentation.', 21, 'ri-draft-line', '#299cdb', NOW(), NOW()),
('Immigration', 4, 'Petition Filing', 'File petition with USCIS along with fees and evidence.', 7, 'ri-upload-cloud-line', '#f7b84b', NOW(), NOW()),
('Immigration', 5, 'Receipt Notice', 'Receive case receipt number and track status.', 30, 'ri-mail-check-line', '#6f42c1', NOW(), NOW()),
('Immigration', 6, 'Biometrics', 'Attend biometrics appointment for fingerprinting.', 45, 'ri-fingerprint-line', '#0dcaf0', NOW(), NOW()),
('Immigration', 7, 'RFE Response', 'Respond to any Request for Evidence from USCIS.', 60, 'ri-questionnaire-line', '#fd7e14', NOW(), NOW()),
('Immigration', 8, 'Interview Prep', 'Prepare client for immigration interview.', 14, 'ri-question-answer-line', '#e83e8c', NOW(), NOW()),
('Immigration', 9, 'Interview', 'Attend USCIS interview with client.', 1, 'ri-user-voice-line', '#f06548', NOW(), NOW()),
('Immigration', 10, 'Approval/Decision', 'Receive case decision. Close case.', 30, 'ri-checkbox-circle-line', '#0ab39c', NOW(), NOW());

-- =============================================
-- REAL ESTATE TIMELINE TEMPLATES
-- =============================================
INSERT INTO case_timeline_templates (case_type, phase_order, phase_name, phase_description, estimated_duration_days, icon, color, created_at, updated_at)
VALUES
('Real Estate', 1, 'Contract Review', 'Review purchase/sale agreement and contingencies.', 7, 'ri-file-text-line', '#405189', NOW(), NOW()),
('Real Estate', 2, 'Title Search', 'Order and review title search for liens or defects.', 14, 'ri-search-line', '#3577f1', NOW(), NOW()),
('Real Estate', 3, 'Inspection Period', 'Coordinate property inspection, negotiate repairs.', 14, 'ri-home-gear-line', '#299cdb', NOW(), NOW()),
('Real Estate', 4, 'Financing', 'Coordinate with lender on mortgage approval.', 30, 'ri-bank-line', '#f7b84b', NOW(), NOW()),
('Real Estate', 5, 'Survey Review', 'Review property survey for boundary issues.', 14, 'ri-map-pin-line', '#6f42c1', NOW(), NOW()),
('Real Estate', 6, 'Title Insurance', 'Order title insurance policy.', 7, 'ri-shield-check-line', '#0dcaf0', NOW(), NOW()),
('Real Estate', 7, 'Document Preparation', 'Prepare deed, settlement statement, closing documents.', 7, 'ri-draft-line', '#fd7e14', NOW(), NOW()),
('Real Estate', 8, 'Final Walkthrough', 'Coordinate final property walkthrough.', 3, 'ri-walk-line', '#e83e8c', NOW(), NOW()),
('Real Estate', 9, 'Closing', 'Attend closing, oversee signing, disburse funds.', 1, 'ri-key-2-line', '#f06548', NOW(), NOW()),
('Real Estate', 10, 'Post-Closing', 'Record deed, disburse final funds. Close file.', 7, 'ri-checkbox-circle-line', '#0ab39c', NOW(), NOW());

-- =============================================
-- ESTATE/PROBATE TIMELINE TEMPLATES
-- =============================================
INSERT INTO case_timeline_templates (case_type, phase_order, phase_name, phase_description, estimated_duration_days, icon, color, created_at, updated_at)
VALUES
('Estate', 1, 'Initial Meeting', 'Meet with executor, review will, identify assets.', 14, 'ri-user-settings-line', '#405189', NOW(), NOW()),
('Estate', 2, 'Probate Filing', 'File petition for probate, appointment of executor.', 14, 'ri-file-paper-2-line', '#3577f1', NOW(), NOW()),
('Estate', 3, 'Notice to Creditors', 'Publish and send notice to creditors.', 14, 'ri-newspaper-line', '#299cdb', NOW(), NOW()),
('Estate', 4, 'Asset Inventory', 'Prepare inventory of all estate assets.', 45, 'ri-list-check-2', '#f7b84b', NOW(), NOW()),
('Estate', 5, 'Creditor Claims', 'Review and pay or dispute creditor claims.', 90, 'ri-money-dollar-box-line', '#6f42c1', NOW(), NOW()),
('Estate', 6, 'Tax Filings', 'Prepare and file estate tax returns.', 60, 'ri-calculator-line', '#0dcaf0', NOW(), NOW()),
('Estate', 7, 'Asset Sales', 'If necessary, sell estate property.', 45, 'ri-auction-line', '#fd7e14', NOW(), NOW()),
('Estate', 8, 'Distribution Plan', 'Prepare accounting and proposed distribution.', 14, 'ri-pie-chart-line', '#e83e8c', NOW(), NOW()),
('Estate', 9, 'Final Distribution', 'Distribute assets to beneficiaries.', 30, 'ri-hand-coin-line', '#f06548', NOW(), NOW()),
('Estate', 10, 'Estate Closing', 'File final accounting, close estate.', 30, 'ri-checkbox-circle-line', '#0ab39c', NOW(), NOW());

-- =============================================
-- EMPLOYMENT LAW TIMELINE TEMPLATES
-- =============================================
INSERT INTO case_timeline_templates (case_type, phase_order, phase_name, phase_description, estimated_duration_days, icon, color, created_at, updated_at)
VALUES
('Employment', 1, 'Initial Consultation', 'Review employment situation, contracts, and potential claims.', 7, 'ri-briefcase-4-line', '#405189', NOW(), NOW()),
('Employment', 2, 'Document Collection', 'Gather employment records, emails, performance reviews.', 21, 'ri-folder-3-line', '#3577f1', NOW(), NOW()),
('Employment', 3, 'Agency Filing', 'File charge with EEOC, MCAD, or other agency if required.', 14, 'ri-government-line', '#299cdb', NOW(), NOW()),
('Employment', 4, 'Agency Investigation', 'Cooperate with agency investigation and mediation.', 90, 'ri-search-line', '#f7b84b', NOW(), NOW()),
('Employment', 5, 'Right to Sue', 'Obtain right to sue letter from agency.', 30, 'ri-mail-check-line', '#6f42c1', NOW(), NOW()),
('Employment', 6, 'Complaint Filed', 'File lawsuit in state or federal court.', 14, 'ri-file-paper-2-line', '#f06548', NOW(), NOW()),
('Employment', 7, 'Discovery', 'Written discovery, depositions, expert discovery.', 90, 'ri-folder-search-line', '#0dcaf0', NOW(), NOW()),
('Employment', 8, 'Mediation', 'Attempt settlement through mediation.', 30, 'ri-team-line', '#fd7e14', NOW(), NOW()),
('Employment', 9, 'Trial Preparation', 'Prepare for trial, finalize exhibits and witnesses.', 30, 'ri-draft-line', '#e83e8c', NOW(), NOW()),
('Employment', 10, 'Trial/Resolution', 'Present case at trial or finalize settlement.', 14, 'ri-checkbox-circle-line', '#0ab39c', NOW(), NOW());

-- =============================================
-- BANKRUPTCY TIMELINE TEMPLATES
-- =============================================
INSERT INTO case_timeline_templates (case_type, phase_order, phase_name, phase_description, estimated_duration_days, icon, color, created_at, updated_at)
VALUES
('Bankruptcy', 1, 'Initial Consultation', 'Review financial situation, debts, assets, and options.', 7, 'ri-money-dollar-circle-line', '#405189', NOW(), NOW()),
('Bankruptcy', 2, 'Credit Counseling', 'Complete required pre-filing credit counseling.', 14, 'ri-user-star-line', '#3577f1', NOW(), NOW()),
('Bankruptcy', 3, 'Document Collection', 'Gather financial documents, tax returns, pay stubs.', 30, 'ri-folder-3-line', '#299cdb', NOW(), NOW()),
('Bankruptcy', 4, 'Petition Preparation', 'Prepare bankruptcy petition and schedules.', 14, 'ri-draft-line', '#f7b84b', NOW(), NOW()),
('Bankruptcy', 5, 'Filing', 'File bankruptcy petition with court.', 1, 'ri-upload-cloud-line', '#f06548', NOW(), NOW()),
('Bankruptcy', 6, 'Automatic Stay', 'Automatic stay in effect, notify creditors.', 7, 'ri-shield-check-line', '#6f42c1', NOW(), NOW()),
('Bankruptcy', 7, '341 Meeting', 'Attend meeting of creditors with trustee.', 45, 'ri-team-line', '#0dcaf0', NOW(), NOW()),
('Bankruptcy', 8, 'Debtor Education', 'Complete required financial management course.', 30, 'ri-book-open-line', '#fd7e14', NOW(), NOW()),
('Bankruptcy', 9, 'Plan Confirmation', 'For Chapter 13, obtain plan confirmation.', 60, 'ri-checkbox-multiple-line', '#e83e8c', NOW(), NOW()),
('Bankruptcy', 10, 'Discharge', 'Receive bankruptcy discharge. Close case.', 30, 'ri-checkbox-circle-line', '#0ab39c', NOW(), NOW());

-- =============================================
-- TAX LAW TIMELINE TEMPLATES
-- =============================================
INSERT INTO case_timeline_templates (case_type, phase_order, phase_name, phase_description, estimated_duration_days, icon, color, created_at, updated_at)
VALUES
('Tax', 1, 'Initial Consultation', 'Review tax situation, notices, and potential issues.', 7, 'ri-calculator-line', '#405189', NOW(), NOW()),
('Tax', 2, 'Document Collection', 'Gather tax returns, IRS notices, financial records.', 21, 'ri-folder-3-line', '#3577f1', NOW(), NOW()),
('Tax', 3, 'IRS Transcript Review', 'Obtain and review IRS account transcripts.', 14, 'ri-file-search-line', '#299cdb', NOW(), NOW()),
('Tax', 4, 'Representation Authorization', 'File Form 2848 Power of Attorney with IRS.', 7, 'ri-shield-user-line', '#f7b84b', NOW(), NOW()),
('Tax', 5, 'IRS Contact', 'Initial contact with IRS, request collections hold.', 14, 'ri-phone-line', '#6f42c1', NOW(), NOW()),
('Tax', 6, 'Resolution Options', 'Evaluate options: OIC, installment, CNC, penalty abatement.', 30, 'ri-mind-map', '#0dcaf0', NOW(), NOW()),
('Tax', 7, 'Application Preparation', 'Prepare and submit resolution application.', 30, 'ri-draft-line', '#fd7e14', NOW(), NOW()),
('Tax', 8, 'IRS Review', 'IRS reviews application, respond to requests.', 90, 'ri-search-line', '#e83e8c', NOW(), NOW()),
('Tax', 9, 'Negotiation', 'Negotiate terms with IRS or appeal if denied.', 45, 'ri-discuss-line', '#f06548', NOW(), NOW()),
('Tax', 10, 'Resolution', 'Finalize agreement or complete payment plan. Close case.', 30, 'ri-checkbox-circle-line', '#0ab39c', NOW(), NOW());

-- =============================================
-- INTELLECTUAL PROPERTY TIMELINE TEMPLATES
-- =============================================
INSERT INTO case_timeline_templates (case_type, phase_order, phase_name, phase_description, estimated_duration_days, icon, color, created_at, updated_at)
VALUES
('Intellectual Property', 1, 'Initial Consultation', 'Review IP assets, potential infringement, or registration needs.', 7, 'ri-lightbulb-line', '#405189', NOW(), NOW()),
('Intellectual Property', 2, 'IP Search', 'Conduct trademark, patent, or copyright search.', 21, 'ri-search-line', '#3577f1', NOW(), NOW()),
('Intellectual Property', 3, 'Application Preparation', 'Prepare trademark, patent, or copyright application.', 30, 'ri-draft-line', '#299cdb', NOW(), NOW()),
('Intellectual Property', 4, 'Filing', 'File application with USPTO or Copyright Office.', 7, 'ri-upload-cloud-line', '#f7b84b', NOW(), NOW()),
('Intellectual Property', 5, 'Examination', 'Respond to office actions during examination.', 90, 'ri-questionnaire-line', '#6f42c1', NOW(), NOW()),
('Intellectual Property', 6, 'Publication/Registration', 'Mark published for opposition or registration issued.', 60, 'ri-award-line', '#0dcaf0', NOW(), NOW()),
('Intellectual Property', 7, 'Enforcement', 'If infringement, send cease and desist letters.', 30, 'ri-mail-send-line', '#fd7e14', NOW(), NOW()),
('Intellectual Property', 8, 'Litigation', 'If needed, file infringement lawsuit.', 60, 'ri-scales-3-line', '#e83e8c', NOW(), NOW()),
('Intellectual Property', 9, 'Discovery/Trial', 'Conduct discovery, prepare for trial.', 120, 'ri-folder-search-line', '#f06548', NOW(), NOW()),
('Intellectual Property', 10, 'Resolution', 'Settlement, judgment, or registration complete.', 30, 'ri-checkbox-circle-line', '#0ab39c', NOW(), NOW());

-- =============================================
-- CLASS ACTION TIMELINE TEMPLATES
-- =============================================
INSERT INTO case_timeline_templates (case_type, phase_order, phase_name, phase_description, estimated_duration_days, icon, color, created_at, updated_at)
VALUES
('Class Action', 1, 'Case Evaluation', 'Evaluate potential class claims and named plaintiffs.', 30, 'ri-group-line', '#405189', NOW(), NOW()),
('Class Action', 2, 'Complaint Filing', 'File class action complaint in court.', 14, 'ri-file-paper-2-line', '#3577f1', NOW(), NOW()),
('Class Action', 3, 'Initial Discovery', 'Conduct discovery related to class certification.', 90, 'ri-folder-search-line', '#299cdb', NOW(), NOW()),
('Class Action', 4, 'Class Certification Motion', 'File motion for class certification.', 30, 'ri-draft-line', '#f7b84b', NOW(), NOW()),
('Class Action', 5, 'Certification Hearing', 'Attend hearing on class certification.', 14, 'ri-scales-3-line', '#6f42c1', NOW(), NOW()),
('Class Action', 6, 'Class Notice', 'Send notice to class members, handle opt-outs.', 60, 'ri-mail-send-line', '#0dcaf0', NOW(), NOW()),
('Class Action', 7, 'Merits Discovery', 'Conduct full discovery on merits.', 180, 'ri-search-line', '#fd7e14', NOW(), NOW()),
('Class Action', 8, 'Settlement Negotiations', 'Negotiate class-wide settlement.', 90, 'ri-discuss-line', '#e83e8c', NOW(), NOW()),
('Class Action', 9, 'Settlement Approval', 'Seek court approval of settlement.', 60, 'ri-checkbox-multiple-line', '#f06548', NOW(), NOW()),
('Class Action', 10, 'Distribution/Resolution', 'Distribute settlement funds or try case.', 90, 'ri-checkbox-circle-line', '#0ab39c', NOW(), NOW());

-- =============================================
-- CONTRACT LAW TIMELINE TEMPLATES
-- =============================================
INSERT INTO case_timeline_templates (case_type, phase_order, phase_name, phase_description, estimated_duration_days, icon, color, created_at, updated_at)
VALUES
('Contract', 1, 'Initial Consultation', 'Review contract, identify breach or dispute issues.', 7, 'ri-file-text-line', '#405189', NOW(), NOW()),
('Contract', 2, 'Document Review', 'Analyze contract terms, amendments, correspondence.', 14, 'ri-file-search-line', '#3577f1', NOW(), NOW()),
('Contract', 3, 'Demand Letter', 'Send demand letter for performance or damages.', 14, 'ri-mail-send-line', '#299cdb', NOW(), NOW()),
('Contract', 4, 'Negotiation', 'Attempt to negotiate resolution without litigation.', 30, 'ri-discuss-line', '#f7b84b', NOW(), NOW()),
('Contract', 5, 'Complaint Filing', 'If needed, file breach of contract lawsuit.', 14, 'ri-file-paper-2-line', '#f06548', NOW(), NOW()),
('Contract', 6, 'Discovery', 'Exchange documents, interrogatories, depositions.', 90, 'ri-folder-search-line', '#6f42c1', NOW(), NOW()),
('Contract', 7, 'Expert Reports', 'Obtain expert reports on damages if needed.', 45, 'ri-user-star-line', '#0dcaf0', NOW(), NOW()),
('Contract', 8, 'Mediation', 'Attempt settlement through mediation.', 30, 'ri-team-line', '#fd7e14', NOW(), NOW()),
('Contract', 9, 'Trial Preparation', 'Prepare exhibits, witnesses, and trial brief.', 30, 'ri-draft-line', '#e83e8c', NOW(), NOW()),
('Contract', 10, 'Trial/Resolution', 'Present case at trial or finalize settlement.', 14, 'ri-checkbox-circle-line', '#0ab39c', NOW(), NOW());

-- =============================================
-- CORPORATE LAW TIMELINE TEMPLATES
-- =============================================
INSERT INTO case_timeline_templates (case_type, phase_order, phase_name, phase_description, estimated_duration_days, icon, color, created_at, updated_at)
VALUES
('Corporate', 1, 'Initial Consultation', 'Understand business goals and corporate structure needs.', 7, 'ri-building-line', '#405189', NOW(), NOW()),
('Corporate', 2, 'Entity Selection', 'Advise on entity type: LLC, Corp, Partnership.', 7, 'ri-mind-map', '#3577f1', NOW(), NOW()),
('Corporate', 3, 'Formation Documents', 'Prepare articles, bylaws, operating agreement.', 14, 'ri-draft-line', '#299cdb', NOW(), NOW()),
('Corporate', 4, 'State Filing', 'File formation documents with state.', 14, 'ri-upload-cloud-line', '#f7b84b', NOW(), NOW()),
('Corporate', 5, 'EIN & Compliance', 'Obtain EIN, set up compliance calendar.', 14, 'ri-government-line', '#6f42c1', NOW(), NOW()),
('Corporate', 6, 'Shareholder Agreements', 'Draft shareholder or membership agreements.', 21, 'ri-team-line', '#0dcaf0', NOW(), NOW()),
('Corporate', 7, 'Board Resolutions', 'Prepare initial board resolutions and minutes.', 7, 'ri-clipboard-line', '#fd7e14', NOW(), NOW()),
('Corporate', 8, 'Stock/Membership Issuance', 'Issue stock certificates or membership interests.', 7, 'ri-stock-line', '#e83e8c', NOW(), NOW()),
('Corporate', 9, 'Regulatory Compliance', 'Ensure industry-specific regulatory compliance.', 30, 'ri-shield-check-line', '#f06548', NOW(), NOW()),
('Corporate', 10, 'Ongoing Maintenance', 'Set up annual meeting and filing reminders.', 14, 'ri-checkbox-circle-line', '#0ab39c', NOW(), NOW());

-- =============================================
-- CIVIL LITIGATION TIMELINE TEMPLATES
-- =============================================
INSERT INTO case_timeline_templates (case_type, phase_order, phase_name, phase_description, estimated_duration_days, icon, color, created_at, updated_at)
VALUES
('Civil', 1, 'Case Assessment', 'Review facts, documents, and potential claims.', 14, 'ri-scales-3-line', '#405189', NOW(), NOW()),
('Civil', 2, 'Demand/Response', 'Send demand letter or respond to claims.', 30, 'ri-mail-line', '#3577f1', NOW(), NOW()),
('Civil', 3, 'Pleadings', 'File complaint or answer.', 21, 'ri-file-paper-line', '#299cdb', NOW(), NOW()),
('Civil', 4, 'Written Discovery', 'Prepare and respond to interrogatories and requests.', 60, 'ri-questionnaire-line', '#f7b84b', NOW(), NOW()),
('Civil', 5, 'Depositions', 'Conduct and defend depositions.', 45, 'ri-video-line', '#6f42c1', NOW(), NOW()),
('Civil', 6, 'Expert Discovery', 'Identify and prepare expert witnesses.', 45, 'ri-user-star-line', '#0dcaf0', NOW(), NOW()),
('Civil', 7, 'Dispositive Motions', 'File or respond to summary judgment motions.', 45, 'ri-draft-line', '#fd7e14', NOW(), NOW()),
('Civil', 8, 'Settlement Conference', 'Participate in settlement discussions.', 14, 'ri-discuss-line', '#e83e8c', NOW(), NOW()),
('Civil', 9, 'Trial', 'Present case at trial.', 14, 'ri-government-line', '#f06548', NOW(), NOW()),
('Civil', 10, 'Resolution', 'Final judgment, settlement, or appeal.', 30, 'ri-checkbox-circle-line', '#0ab39c', NOW(), NOW());

-- =============================================
-- ENVIRONMENTAL LAW TIMELINE TEMPLATES
-- =============================================
INSERT INTO case_timeline_templates (case_type, phase_order, phase_name, phase_description, estimated_duration_days, icon, color, created_at, updated_at)
VALUES
('Environmental', 1, 'Initial Assessment', 'Review environmental issue, permits, and regulations.', 14, 'ri-plant-line', '#405189', NOW(), NOW()),
('Environmental', 2, 'Site Investigation', 'Conduct or review environmental site assessment.', 45, 'ri-search-line', '#3577f1', NOW(), NOW()),
('Environmental', 3, 'Regulatory Review', 'Identify applicable EPA, state, local regulations.', 21, 'ri-government-line', '#299cdb', NOW(), NOW()),
('Environmental', 4, 'Agency Communication', 'Communicate with regulatory agencies.', 30, 'ri-mail-line', '#f7b84b', NOW(), NOW()),
('Environmental', 5, 'Remediation Plan', 'Develop or review remediation/compliance plan.', 45, 'ri-draft-line', '#6f42c1', NOW(), NOW()),
('Environmental', 6, 'Permit Applications', 'Prepare and file necessary permit applications.', 60, 'ri-file-paper-2-line', '#0dcaf0', NOW(), NOW()),
('Environmental', 7, 'Compliance Implementation', 'Implement required compliance measures.', 90, 'ri-tools-line', '#fd7e14', NOW(), NOW()),
('Environmental', 8, 'Monitoring', 'Conduct required environmental monitoring.', 60, 'ri-bar-chart-line', '#e83e8c', NOW(), NOW()),
('Environmental', 9, 'Agency Approval', 'Obtain agency approval or closure letter.', 60, 'ri-checkbox-multiple-line', '#f06548', NOW(), NOW()),
('Environmental', 10, 'Case Closure', 'Complete compliance, close matter.', 14, 'ri-checkbox-circle-line', '#0ab39c', NOW(), NOW());

-- =============================================
-- BUSINESS/GENERAL LITIGATION TIMELINE TEMPLATES
-- =============================================
INSERT INTO case_timeline_templates (case_type, phase_order, phase_name, phase_description, estimated_duration_days, icon, color, created_at, updated_at)
VALUES
('Business', 1, 'Case Assessment', 'Review facts, documents, and potential claims.', 14, 'ri-briefcase-line', '#405189', NOW(), NOW()),
('Business', 2, 'Demand/Response', 'Send demand letter or respond to claims.', 30, 'ri-mail-line', '#3577f1', NOW(), NOW()),
('Business', 3, 'Pleadings', 'File complaint or answer.', 21, 'ri-file-paper-line', '#299cdb', NOW(), NOW()),
('Business', 4, 'Written Discovery', 'Prepare and respond to interrogatories.', 60, 'ri-questionnaire-line', '#f7b84b', NOW(), NOW()),
('Business', 5, 'Depositions', 'Conduct and defend depositions.', 45, 'ri-video-line', '#6f42c1', NOW(), NOW()),
('Business', 6, 'Expert Discovery', 'Identify and prepare expert witnesses.', 45, 'ri-user-star-line', '#0dcaf0', NOW(), NOW()),
('Business', 7, 'Dispositive Motions', 'File or respond to summary judgment motions.', 45, 'ri-draft-line', '#fd7e14', NOW(), NOW()),
('Business', 8, 'Settlement Conference', 'Participate in settlement discussions.', 14, 'ri-discuss-line', '#e83e8c', NOW(), NOW()),
('Business', 9, 'Trial', 'Present case at trial.', 14, 'ri-scales-3-line', '#f06548', NOW(), NOW()),
('Business', 10, 'Resolution', 'Final judgment, settlement, or appeal.', 30, 'ri-checkbox-circle-line', '#0ab39c', NOW(), NOW());

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Complete case timeline templates seeded: % rows', (SELECT COUNT(*) FROM case_timeline_templates);
END $$;
