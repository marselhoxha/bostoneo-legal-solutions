-- V221: Add Personal Injury (PI) Case Fields
-- These fields support PI-specific case management features to compete with EvenUp

-- Add PI-specific columns to legal_cases table
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS injury_date DATE;
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS injury_type VARCHAR(100);
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS injury_description TEXT;
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS accident_location VARCHAR(255);
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS liability_assessment VARCHAR(50);
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS comparative_negligence_percent INTEGER DEFAULT 0;

-- Medical Provider Information (JSONB array)
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS medical_providers JSONB DEFAULT '[]'::jsonb;

-- Financial Damages
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS medical_expenses_total DECIMAL(15,2) DEFAULT 0;
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS lost_wages DECIMAL(15,2) DEFAULT 0;
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS future_medical_estimate DECIMAL(15,2) DEFAULT 0;
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS pain_suffering_multiplier DECIMAL(3,1) DEFAULT 2.0;

-- Settlement Information
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS settlement_demand_amount DECIMAL(15,2);
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS settlement_offer_amount DECIMAL(15,2);
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS settlement_final_amount DECIMAL(15,2);
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS settlement_date DATE;

-- Insurance Information
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS insurance_company VARCHAR(255);
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS insurance_policy_number VARCHAR(100);
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS insurance_policy_limit DECIMAL(15,2);
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS insurance_adjuster_name VARCHAR(255);
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS insurance_adjuster_contact VARCHAR(255);

-- Defendant Information
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS defendant_name VARCHAR(255);
ALTER TABLE legal_cases ADD COLUMN IF NOT EXISTS defendant_address TEXT;

-- Add comments for documentation
COMMENT ON COLUMN legal_cases.injury_date IS 'Date of the accident/injury';
COMMENT ON COLUMN legal_cases.injury_type IS 'Type of injury: soft_tissue, tbi, spinal, fracture, burn, amputation, wrongful_death, other';
COMMENT ON COLUMN legal_cases.liability_assessment IS 'Liability status: CLEAR, COMPARATIVE, DISPUTED';
COMMENT ON COLUMN legal_cases.medical_providers IS 'JSON array of medical provider objects with name, specialty, treatment_dates, bills';
COMMENT ON COLUMN legal_cases.pain_suffering_multiplier IS 'Multiplier for non-economic damages (1.5-5.0 based on injury severity)';

-- Create index for common PI case queries
CREATE INDEX IF NOT EXISTS idx_legal_cases_injury_date ON legal_cases(injury_date) WHERE injury_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_legal_cases_injury_type ON legal_cases(injury_type) WHERE injury_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_legal_cases_settlement_date ON legal_cases(settlement_date) WHERE settlement_date IS NOT NULL;

-- Insert PI Demand Letter template into ai_legal_templates
INSERT INTO ai_legal_templates (
    name,
    description,
    category,
    practice_area,
    jurisdiction,
    template_content,
    variable_mappings,
    ai_prompt_structure,
    created_at,
    updated_at,
    organization_id
) VALUES (
    'Personal Injury Demand Letter',
    'AI-powered demand letter generator for personal injury cases with damages calculation and persuasive narrative',
    'CORRESPONDENCE',
    'PERSONAL_INJURY',
    'Massachusetts',
    E'[LAW FIRM LETTERHEAD]\n\n{{currentDate}}\n\nVIA CERTIFIED MAIL\nRETURN RECEIPT REQUESTED\n\n{{insuranceCompany}}\nAttn: {{adjusterName}}\n{{adjusterAddress}}\n\nRe: Claimant: {{clientName}}\n    Your Insured: {{defendantName}}\n    Date of Loss: {{accidentDate}}\n    Claim Number: {{claimNumber}}\n    Policy Limits: {{policyLimit}}\n\nDear {{adjusterName}}:\n\nPlease be advised that this firm represents {{clientName}} in connection with personal injuries sustained in an accident that occurred on {{accidentDate}} at {{accidentLocation}}.\n\nLIABILITY\n\n{{liabilityNarrative}}\n\nINJURIES AND TREATMENT\n\n{{injuryNarrative}}\n\nMEDICAL EXPENSES\n\n{{medicalExpensesBreakdown}}\n\nTotal Medical Expenses: ${{medicalExpensesTotal}}\n\nLOST WAGES\n\n{{lostWagesNarrative}}\n\nTotal Lost Wages: ${{lostWages}}\n\nFUTURE MEDICAL EXPENSES\n\n{{futureMedicalNarrative}}\n\nEstimated Future Medical Expenses: ${{futureMedicalEstimate}}\n\nPAIN AND SUFFERING\n\n{{painSufferingNarrative}}\n\nDAMAGES SUMMARY\n\nMedical Expenses:        ${{medicalExpensesTotal}}\nLost Wages:              ${{lostWages}}\nFuture Medical:          ${{futureMedicalEstimate}}\nPain and Suffering:      ${{painSufferingAmount}}\n\nTOTAL DEMAND:            ${{totalDemand}}\n\nBased on the foregoing, we hereby demand the sum of ${{totalDemand}} in full settlement of all claims arising from this incident. This demand will remain open for thirty (30) days from the date of this letter, after which time we reserve the right to pursue litigation.\n\nPlease contact our office to discuss settlement of this claim.\n\nVery truly yours,\n\n{{attorneyName}}\n{{lawFirmName}}\n{{lawFirmAddress}}\n{{lawFirmPhone}}',
    '[{"name":"clientName","label":"Client Name","type":"text","required":true},{"name":"defendantName","label":"Defendant Name","type":"text","required":true},{"name":"insuranceCompany","label":"Insurance Company","type":"text","required":true},{"name":"adjusterName","label":"Adjuster Name","type":"text","required":false},{"name":"claimNumber","label":"Claim Number","type":"text","required":false},{"name":"accidentDate","label":"Accident Date","type":"date","required":true},{"name":"accidentLocation","label":"Accident Location","type":"text","required":true},{"name":"policyLimit","label":"Policy Limit","type":"currency","required":false},{"name":"medicalExpensesTotal","label":"Total Medical Expenses","type":"currency","required":true},{"name":"lostWages","label":"Lost Wages","type":"currency","required":true},{"name":"futureMedicalEstimate","label":"Future Medical Estimate","type":"currency","required":false},{"name":"painSufferingMultiplier","label":"Pain & Suffering Multiplier","type":"number","required":true,"default":2.5}]',
    '{"systemPrompt":"You are an experienced personal injury attorney drafting a demand letter. Write compelling, professional narratives for each section based on the provided case details. Focus on liability, injury severity, treatment necessity, and impact on daily life. Use persuasive language appropriate for insurance adjusters.","sections":[{"name":"liabilityNarrative","prompt":"Write a clear liability narrative establishing defendant fault based on: {{liabilityDetails}}"},{"name":"injuryNarrative","prompt":"Describe the injuries and treatment based on: {{injuryDescription}}. Emphasize the severity and impact on daily life."},{"name":"painSufferingNarrative","prompt":"Write a compelling pain and suffering narrative based on injury type: {{injuryType}} and injury details: {{injuryDescription}}. Include impact on work, family, and quality of life."}]}',
    NOW(),
    NOW(),
    1
) ON CONFLICT DO NOTHING;
