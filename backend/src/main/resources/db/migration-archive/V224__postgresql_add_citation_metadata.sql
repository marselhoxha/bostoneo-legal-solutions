-- V224: Add citation metadata to pi_medical_records for smart citations feature
-- This allows linking extracted data back to specific locations in source documents

ALTER TABLE public.pi_medical_records
ADD COLUMN IF NOT EXISTS citation_metadata JSONB DEFAULT NULL;

-- Add comment to explain the structure
COMMENT ON COLUMN public.pi_medical_records.citation_metadata IS
'Stores citation metadata for each extracted field. Structure:
{
  "treatmentDate": {"page": 1, "excerpt": "Date of service: 01/15/2024", "charOffset": 234},
  "providerName": {"page": 1, "excerpt": "Dr. John Smith, MD", "charOffset": 156},
  "recordType": {"page": 1, "excerpt": "Emergency Department Visit", "charOffset": 89},
  "keyFindings": {"page": 2, "excerpt": "Patient presents with...", "charOffset": 1024},
  "diagnoses": [{"icd_code": "M54.5", "page": 3, "excerpt": "Diagnosis: Low back pain"}],
  "procedures": [{"cpt_code": "99283", "page": 4, "excerpt": "Level 3 ED visit"}]
}';

-- Add index for records that have citation metadata (for re-scan queries)
CREATE INDEX IF NOT EXISTS idx_pi_medical_records_has_citations
ON public.pi_medical_records ((citation_metadata IS NOT NULL));
