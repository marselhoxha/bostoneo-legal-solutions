-- =============================================
-- V157: Add organization_id to AI Case Entities
-- Security Critical: Enable tenant isolation for AI case data
-- =============================================

-- 1. AI Criminal Cases
ALTER TABLE ai_criminal_cases ADD COLUMN IF NOT EXISTS organization_id BIGINT;
ALTER TABLE ai_criminal_cases ADD CONSTRAINT fk_ai_criminal_cases_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_ai_criminal_cases_organization_id ON ai_criminal_cases(organization_id);

-- 2. AI Criminal Motions
ALTER TABLE ai_criminal_motions ADD COLUMN IF NOT EXISTS organization_id BIGINT;
ALTER TABLE ai_criminal_motions ADD CONSTRAINT fk_ai_criminal_motions_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_ai_criminal_motions_organization_id ON ai_criminal_motions(organization_id);

-- 3. AI Family Law Cases
ALTER TABLE ai_family_law_cases ADD COLUMN IF NOT EXISTS organization_id BIGINT;
ALTER TABLE ai_family_law_cases ADD CONSTRAINT fk_ai_family_law_cases_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_ai_family_law_cases_organization_id ON ai_family_law_cases(organization_id);

-- 4. AI Family Law Calculations
ALTER TABLE ai_family_law_calculations ADD COLUMN IF NOT EXISTS organization_id BIGINT;
ALTER TABLE ai_family_law_calculations ADD CONSTRAINT fk_ai_family_law_calculations_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_ai_family_law_calculations_organization_id ON ai_family_law_calculations(organization_id);

-- 5. AI Immigration Cases
ALTER TABLE ai_immigration_cases ADD COLUMN IF NOT EXISTS organization_id BIGINT;
ALTER TABLE ai_immigration_cases ADD CONSTRAINT fk_ai_immigration_cases_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_ai_immigration_cases_organization_id ON ai_immigration_cases(organization_id);

-- 6. AI Immigration Documents
ALTER TABLE ai_immigration_documents ADD COLUMN IF NOT EXISTS organization_id BIGINT;
ALTER TABLE ai_immigration_documents ADD CONSTRAINT fk_ai_immigration_documents_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_ai_immigration_documents_organization_id ON ai_immigration_documents(organization_id);

-- 7. AI Immigration Forms
ALTER TABLE ai_immigration_forms ADD COLUMN IF NOT EXISTS organization_id BIGINT;
ALTER TABLE ai_immigration_forms ADD CONSTRAINT fk_ai_immigration_forms_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_ai_immigration_forms_organization_id ON ai_immigration_forms(organization_id);

-- 8. AI Patent Applications
ALTER TABLE ai_patent_applications ADD COLUMN IF NOT EXISTS organization_id BIGINT;
ALTER TABLE ai_patent_applications ADD CONSTRAINT fk_ai_patent_applications_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_ai_patent_applications_organization_id ON ai_patent_applications(organization_id);

-- 9. AI Patent Prior Art
ALTER TABLE ai_patent_prior_art ADD COLUMN IF NOT EXISTS organization_id BIGINT;
ALTER TABLE ai_patent_prior_art ADD CONSTRAINT fk_ai_patent_prior_art_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_ai_patent_prior_art_organization_id ON ai_patent_prior_art(organization_id);

-- 10. AI Patent Searches
ALTER TABLE ai_patent_searches ADD COLUMN IF NOT EXISTS organization_id BIGINT;
ALTER TABLE ai_patent_searches ADD CONSTRAINT fk_ai_patent_searches_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_ai_patent_searches_organization_id ON ai_patent_searches(organization_id);

-- 11. AI Real Estate Documents
ALTER TABLE ai_real_estate_documents ADD COLUMN IF NOT EXISTS organization_id BIGINT;
ALTER TABLE ai_real_estate_documents ADD CONSTRAINT fk_ai_real_estate_documents_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_ai_real_estate_documents_organization_id ON ai_real_estate_documents(organization_id);

-- 12. AI Real Estate Transactions
ALTER TABLE ai_real_estate_transactions ADD COLUMN IF NOT EXISTS organization_id BIGINT;
ALTER TABLE ai_real_estate_transactions ADD CONSTRAINT fk_ai_real_estate_transactions_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_ai_real_estate_transactions_organization_id ON ai_real_estate_transactions(organization_id);

-- 13. AI Closing Documents
ALTER TABLE ai_closing_documents ADD COLUMN IF NOT EXISTS organization_id BIGINT;
ALTER TABLE ai_closing_documents ADD CONSTRAINT fk_ai_closing_documents_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_ai_closing_documents_organization_id ON ai_closing_documents(organization_id);

-- 14. AI Editing Sessions
ALTER TABLE ai_editing_sessions ADD COLUMN IF NOT EXISTS organization_id BIGINT;
ALTER TABLE ai_editing_sessions ADD CONSTRAINT fk_ai_editing_sessions_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_ai_editing_sessions_organization_id ON ai_editing_sessions(organization_id);

-- 15. AI Edit Suggestions
ALTER TABLE ai_edit_suggestions ADD COLUMN IF NOT EXISTS organization_id BIGINT;
ALTER TABLE ai_edit_suggestions ADD CONSTRAINT fk_ai_edit_suggestions_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_ai_edit_suggestions_organization_id ON ai_edit_suggestions(organization_id);

-- Comment: Reference data tables (ai_ma_court_rules, ai_ma_statutes, ai_ma_sentencing_guidelines)
-- remain system-wide as they contain Massachusetts law reference data shared across all organizations.
