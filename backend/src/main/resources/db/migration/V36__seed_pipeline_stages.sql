-- Fix: stage_order unique constraint should be per-organization, not global
ALTER TABLE pipeline_stages DROP CONSTRAINT IF EXISTS ukt7u0bnpy90tfhkmymntk9o7nt;
CREATE UNIQUE INDEX IF NOT EXISTS uk_pipeline_stages_org_order ON pipeline_stages(organization_id, stage_order);

-- Seed default pipeline stages for all organizations that don't have them yet
INSERT INTO pipeline_stages (name, description, stage_order, color, icon, is_active, is_initial, is_final, is_system, estimated_days, organization_id, created_at, updated_at)
SELECT s.name, s.description, s.stage_order, s.color, s.icon, true, s.is_initial, s.is_final, false, s.estimated_days, o.id, NOW(), NOW()
FROM organizations o
CROSS JOIN (VALUES
    ('New Lead',               'Newly submitted lead, pending initial review',     1, '#6c757d', 'ri-user-add-line',    true,  false, 0),
    ('Contacted',              'Initial contact made with the lead',               2, '#3577f1', 'ri-phone-line',       false, false, 0),
    ('Qualified',              'Lead has been qualified as a potential client',     3, '#0ab39c', 'ri-checkbox-circle-line', false, false, 0),
    ('Consultation Scheduled', 'Consultation meeting has been scheduled',          4, '#9b59b6', 'ri-calendar-line',    false, false, 0),
    ('Proposal Sent',          'Engagement proposal or retainer sent to lead',     5, '#299cdb', 'ri-mail-send-line',   false, false, 0),
    ('Negotiation',            'Terms are being negotiated with the lead',         7, '#f7b84b', 'ri-discuss-line',     false, false, 0),
    ('Converted',              'Lead has been converted to a client',              8, '#0ab39c', 'ri-check-double-line', false, true,  0),
    ('Lost',                   'Lead was lost or declined services',               9, '#f06548', 'ri-close-circle-line', false, true,  0)
) AS s(name, description, stage_order, color, icon, is_initial, is_final, estimated_days)
WHERE NOT EXISTS (
    SELECT 1 FROM pipeline_stages ps WHERE ps.organization_id = o.id AND ps.name = s.name
);
