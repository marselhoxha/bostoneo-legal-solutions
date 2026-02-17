-- Update workflow templates with proper step configurations
-- Phase 7: Add synthesisType, generationType, displayType, integrationType to step configs

-- Update Complaint Response workflow
UPDATE case_workflow_templates
SET steps_config = JSON_OBJECT(
    'steps', JSON_ARRAY(
        JSON_OBJECT('number', 1, 'name', 'Document Analysis', 'type', 'display', 'displayType', 'full', 'description', 'Display stored document analysis with action items and timeline'),
        JSON_OBJECT('number', 2, 'name', 'Timeline & Deadlines', 'type', 'display', 'displayType', 'timeline', 'description', 'Show timeline events and key deadlines'),
        JSON_OBJECT('number', 3, 'name', 'Draft Answer', 'type', 'integration', 'integrationType', 'create_draft', 'generationType', 'answer_draft', 'description', 'Create draft answer to the complaint'),
        JSON_OBJECT('number', 4, 'name', 'Evidence Checklist', 'type', 'synthesis', 'synthesisType', 'evidence_checklist', 'description', 'Generate evidence gathering checklist'),
        JSON_OBJECT('number', 5, 'name', 'Team Notification', 'type', 'action', 'actionType', 'notify_team', 'description', 'Notify team members for review')
    )
)
WHERE template_type = 'complaint_response';

-- Update Contract Review workflow
UPDATE case_workflow_templates
SET steps_config = JSON_OBJECT(
    'steps', JSON_ARRAY(
        JSON_OBJECT('number', 1, 'name', 'Document Analysis', 'type', 'display', 'displayType', 'analysis', 'description', 'Display stored contract analysis'),
        JSON_OBJECT('number', 2, 'name', 'Risk Assessment', 'type', 'display', 'displayType', 'full', 'description', 'Show aggregated risk assessment with action items'),
        JSON_OBJECT('number', 3, 'name', 'Generate Redlines', 'type', 'generation', 'generationType', 'contract_redlines', 'description', 'Create suggested contract redlines'),
        JSON_OBJECT('number', 4, 'name', 'Negotiation Priorities', 'type', 'synthesis', 'synthesisType', 'negotiation_priorities', 'description', 'Generate negotiation priority list'),
        JSON_OBJECT('number', 5, 'name', 'Approval Routing', 'type', 'action', 'actionType', 'approval', 'description', 'Route for client/partner approval')
    )
)
WHERE template_type = 'contract_review';

-- Update Motion Opposition workflow
UPDATE case_workflow_templates
SET steps_config = JSON_OBJECT(
    'steps', JSON_ARRAY(
        JSON_OBJECT('number', 1, 'name', 'Motion Analysis', 'type', 'display', 'displayType', 'full', 'description', 'Display motion document analysis'),
        JSON_OBJECT('number', 2, 'name', 'Legal Research', 'type', 'integration', 'integrationType', 'legal_research', 'description', 'Find counter-authorities via Research'),
        JSON_OBJECT('number', 3, 'name', 'Draft Opposition Brief', 'type', 'generation', 'generationType', 'opposition_brief', 'description', 'Draft opposition brief'),
        JSON_OBJECT('number', 4, 'name', 'Supporting Evidence', 'type', 'synthesis', 'synthesisType', 'evidence_checklist', 'description', 'Generate supporting evidence checklist'),
        JSON_OBJECT('number', 5, 'name', 'Filing Checklist', 'type', 'display', 'displayType', 'action_items', 'description', 'Show court filing requirements')
    )
)
WHERE template_type = 'motion_opposition';

-- Update Discovery Response workflow
UPDATE case_workflow_templates
SET steps_config = JSON_OBJECT(
    'steps', JSON_ARRAY(
        JSON_OBJECT('number', 1, 'name', 'Request Analysis', 'type', 'display', 'displayType', 'full', 'description', 'Display discovery request analysis'),
        JSON_OBJECT('number', 2, 'name', 'Objection Identification', 'type', 'synthesis', 'synthesisType', 'summary', 'description', 'Identify potential objections'),
        JSON_OBJECT('number', 3, 'name', 'Document Collection', 'type', 'action', 'actionType', 'document_collection', 'description', 'User collects responsive documents'),
        JSON_OBJECT('number', 4, 'name', 'Draft Responses', 'type', 'generation', 'generationType', 'discovery_responses', 'description', 'Draft discovery responses'),
        JSON_OBJECT('number', 5, 'name', 'Review Checklist', 'type', 'display', 'displayType', 'action_items', 'description', 'Show review checklist before sending')
    )
)
WHERE template_type = 'discovery_response';

-- Update Due Diligence workflow
UPDATE case_workflow_templates
SET steps_config = JSON_OBJECT(
    'steps', JSON_ARRAY(
        JSON_OBJECT('number', 1, 'name', 'Document Organization', 'type', 'display', 'displayType', 'analysis', 'description', 'Organize documents by type'),
        JSON_OBJECT('number', 2, 'name', 'Issue Aggregation', 'type', 'display', 'displayType', 'full', 'description', 'Show aggregated issues across documents'),
        JSON_OBJECT('number', 3, 'name', 'Risk Matrix', 'type', 'synthesis', 'synthesisType', 'risk_matrix', 'description', 'Generate comprehensive risk matrix'),
        JSON_OBJECT('number', 4, 'name', 'DD Report', 'type', 'generation', 'generationType', 'due_diligence_report', 'description', 'Generate due diligence report'),
        JSON_OBJECT('number', 5, 'name', 'Export Options', 'type', 'action', 'actionType', 'export', 'description', 'Export report in various formats')
    )
)
WHERE template_type = 'due_diligence';
