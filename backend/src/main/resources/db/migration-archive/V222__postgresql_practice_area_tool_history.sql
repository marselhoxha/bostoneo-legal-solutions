-- Practice Area Tool History Table
-- Stores calculation results, generated documents, and AI analyses from practice area tools
-- Supports history browsing and linking to cases

CREATE TABLE practice_area_tool_history (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    practice_area VARCHAR(50) NOT NULL,
    tool_type VARCHAR(50) NOT NULL,
    title VARCHAR(255),
    input_data JSONB NOT NULL,
    output_data JSONB,
    ai_analysis TEXT,
    case_id BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT fk_tool_history_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT fk_tool_history_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_tool_history_case
        FOREIGN KEY (case_id) REFERENCES legal_cases(id) ON DELETE SET NULL
);

-- Index for listing history by organization and practice area
CREATE INDEX idx_tool_history_org_area ON practice_area_tool_history(organization_id, practice_area, created_at DESC);

-- Index for user's recent history
CREATE INDEX idx_tool_history_user ON practice_area_tool_history(user_id, created_at DESC);

-- Index for case-linked history items
CREATE INDEX idx_tool_history_case ON practice_area_tool_history(case_id) WHERE case_id IS NOT NULL;

-- Index for filtering by tool type within a practice area
CREATE INDEX idx_tool_history_tool_type ON practice_area_tool_history(organization_id, practice_area, tool_type);

COMMENT ON TABLE practice_area_tool_history IS 'Stores history of practice area tool usage including calculations, generated documents, and AI analyses';
COMMENT ON COLUMN practice_area_tool_history.practice_area IS 'Practice area identifier: personal-injury, family-law, criminal-defense, immigration, real-estate, intellectual-property';
COMMENT ON COLUMN practice_area_tool_history.tool_type IS 'Tool identifier within practice area: case-value, demand-letter, medical-tracker, settlement, etc.';
COMMENT ON COLUMN practice_area_tool_history.input_data IS 'JSON object containing the form data submitted to the tool';
COMMENT ON COLUMN practice_area_tool_history.output_data IS 'JSON object containing calculation results or generated content';
COMMENT ON COLUMN practice_area_tool_history.ai_analysis IS 'AI-generated analysis text if applicable';
