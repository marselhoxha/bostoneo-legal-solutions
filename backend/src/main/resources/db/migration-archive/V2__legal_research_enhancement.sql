-- =============================================================================
-- Legal Research Enhancement - Database Migration
-- Version: 2.0
-- Date: 2025-10-07
-- Description: Creates all tables for 13 AI legal research features
-- =============================================================================

-- =============================================================================
-- FEATURE 1: Research-to-Action Workflows
-- =============================================================================

CREATE TABLE IF NOT EXISTS research_action_items (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    research_session_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    case_id BIGINT UNSIGNED,

    -- Action configuration
    action_type ENUM('DRAFT_MOTION', 'CREATE_DEADLINE', 'ATTACH_DOCUMENT', 'CREATE_TASK', 'ADD_NOTE', 'SCHEDULE_EVENT') NOT NULL,
    source_finding TEXT NOT NULL,
    source_citation VARCHAR(500),
    action_status ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'DISMISSED') DEFAULT 'PENDING',

    -- For DRAFT_MOTION
    draft_document_id CHAR(36), -- UUID reference to legal_documents
    document_type VARCHAR(100),

    -- For CREATE_DEADLINE
    deadline_date DATETIME,
    deadline_type VARCHAR(100),
    calendar_event_id BIGINT UNSIGNED,

    -- For CREATE_TASK
    task_id BIGINT, -- Signed BIGINT to match case_tasks table
    task_description TEXT,
    task_priority ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT'),

    -- Metadata
    ai_confidence_score DECIMAL(5,2),
    user_modified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    dismissed_at TIMESTAMP NULL,

    FOREIGN KEY (research_session_id) REFERENCES ai_conversation_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (case_id) REFERENCES legal_cases(id) ON DELETE SET NULL,
    -- Note: draft_document_id is UUID (CHAR(36)) - no FK constraint for performance
    FOREIGN KEY (task_id) REFERENCES case_tasks(id) ON DELETE SET NULL,
    FOREIGN KEY (calendar_event_id) REFERENCES calendar_events(id) ON DELETE SET NULL,

    INDEX idx_user_status (user_id, action_status),
    INDEX idx_case_actions (case_id, action_type),
    INDEX idx_session (research_session_id),
    INDEX idx_created_at (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- FEATURE 2: Multi-Source Truth Score
-- =============================================================================

CREATE TABLE IF NOT EXISTS research_verification_scores (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    session_id BIGINT UNSIGNED NOT NULL,
    message_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,

    -- Core finding
    finding_text TEXT NOT NULL,
    finding_hash VARCHAR(64) NOT NULL, -- SHA-256 hash for deduplication

    -- Verification metrics
    truth_score DECIMAL(5,2) NOT NULL, -- 0-100
    confidence_level ENUM('LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH') NOT NULL,
    verification_status ENUM('UNVERIFIED', 'PARTIALLY_VERIFIED', 'VERIFIED', 'CONTRADICTED') DEFAULT 'UNVERIFIED',

    -- Source analysis
    total_sources_found INT DEFAULT 0,
    primary_sources_count INT DEFAULT 0,
    secondary_sources_count INT DEFAULT 0,
    court_opinions_count INT DEFAULT 0,
    statutes_count INT DEFAULT 0,
    regulations_count INT DEFAULT 0,

    -- Source quality metrics
    avg_source_authority_score DECIMAL(5,2),
    most_recent_source_year INT,
    oldest_source_year INT,

    -- Jurisdictional analysis
    jurisdictions_covered JSON,
    primary_jurisdiction VARCHAR(100),
    multi_jurisdiction BOOLEAN DEFAULT FALSE,

    -- Contradiction detection
    contradicting_sources_found INT DEFAULT 0,
    contradiction_details JSON,

    -- Metadata
    sources_data JSON NOT NULL,
    verification_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_reverified_at TIMESTAMP NULL,

    FOREIGN KEY (session_id) REFERENCES ai_conversation_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (message_id) REFERENCES ai_conversation_messages(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

    UNIQUE KEY unique_finding (finding_hash, session_id),
    INDEX idx_truth_score (truth_score DESC),
    INDEX idx_verification_status (verification_status),
    INDEX idx_session_scores (session_id, truth_score DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- FEATURE 3: Live Research Assistant
-- =============================================================================

CREATE TABLE IF NOT EXISTS live_assistant_suggestions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    case_id BIGINT UNSIGNED,

    -- Trigger context
    trigger_type ENUM('CASE_UPDATE', 'DOCUMENT_UPLOAD', 'TASK_CREATED', 'DEADLINE_APPROACHING', 'MANUAL_REQUEST') NOT NULL,
    trigger_entity_type VARCHAR(50),
    trigger_entity_id BIGINT UNSIGNED,

    -- Suggestion content
    suggestion_type ENUM('RESEARCH_QUERY', 'CASE_LAW', 'MOTION_TEMPLATE', 'DEADLINE_REMINDER', 'STRATEGY_TIP', 'CITATION_CHECK') NOT NULL,
    suggestion_title VARCHAR(255) NOT NULL,
    suggestion_content TEXT NOT NULL,
    suggested_action VARCHAR(255),

    -- Relevance scoring
    relevance_score DECIMAL(5,2) NOT NULL,
    priority ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') DEFAULT 'MEDIUM',

    -- User interaction
    status ENUM('PENDING', 'VIEWED', 'ACCEPTED', 'DISMISSED', 'EXPIRED') DEFAULT 'PENDING',
    viewed_at TIMESTAMP NULL,
    accepted_at TIMESTAMP NULL,
    dismissed_at TIMESTAMP NULL,
    expires_at TIMESTAMP NULL,

    -- Follow-up tracking
    resulted_in_session_id BIGINT UNSIGNED,
    resulted_in_action BOOLEAN DEFAULT FALSE,

    -- Metadata
    context_data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (case_id) REFERENCES legal_cases(id) ON DELETE CASCADE,
    FOREIGN KEY (resulted_in_session_id) REFERENCES ai_conversation_sessions(id) ON DELETE SET NULL,

    INDEX idx_user_pending (user_id, status, priority DESC),
    INDEX idx_case_suggestions (case_id, created_at DESC),
    INDEX idx_relevance (relevance_score DESC, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- FEATURE 4: Collaborative Research Workspaces
-- =============================================================================

CREATE TABLE IF NOT EXISTS research_workspaces (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    workspace_name VARCHAR(255) NOT NULL,
    case_id BIGINT UNSIGNED,
    practice_area VARCHAR(100),
    jurisdiction VARCHAR(100),

    -- Owner and access control
    created_by_user_id BIGINT UNSIGNED NOT NULL,
    firm_id BIGINT UNSIGNED,
    is_public BOOLEAN DEFAULT FALSE,
    access_level ENUM('PRIVATE', 'TEAM', 'FIRM', 'PUBLIC') DEFAULT 'PRIVATE',

    -- Workspace state
    status ENUM('ACTIVE', 'ARCHIVED', 'COMPLETED') DEFAULT 'ACTIVE',
    primary_research_question TEXT,
    workspace_description TEXT,

    -- Collaboration tracking
    participant_count INT DEFAULT 1,
    total_messages INT DEFAULT 0,
    total_documents INT DEFAULT 0,
    total_annotations INT DEFAULT 0,

    -- Session data
    last_activity_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    archived_at TIMESTAMP NULL,

    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (case_id) REFERENCES legal_cases(id) ON DELETE SET NULL,

    INDEX idx_case_workspaces (case_id, status),
    INDEX idx_user_workspaces (created_by_user_id, status),
    INDEX idx_activity (last_activity_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS workspace_participants (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,

    -- Role and permissions
    role ENUM('OWNER', 'EDITOR', 'VIEWER') NOT NULL,
    can_invite BOOLEAN DEFAULT FALSE,
    can_edit BOOLEAN DEFAULT TRUE,
    can_delete BOOLEAN DEFAULT FALSE,

    -- Activity tracking
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    messages_contributed INT DEFAULT 0,

    -- Notification preferences
    notify_on_message BOOLEAN DEFAULT TRUE,
    notify_on_annotation BOOLEAN DEFAULT TRUE,

    FOREIGN KEY (workspace_id) REFERENCES research_workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

    UNIQUE KEY unique_participant (workspace_id, user_id),
    INDEX idx_user_workspaces (user_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS workspace_annotations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    message_id BIGINT UNSIGNED,

    -- Annotation content
    annotation_type ENUM('NOTE', 'QUESTION', 'HIGHLIGHT', 'TAG', 'BOOKMARK') NOT NULL,
    annotation_text TEXT,
    highlighted_text TEXT,
    position_data JSON,

    -- Categorization
    tags JSON,
    color VARCHAR(20) DEFAULT '#ffeb3b',

    -- Collaboration
    replies_count INT DEFAULT 0,
    parent_annotation_id BIGINT UNSIGNED,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP NULL,
    resolved_by_user_id BIGINT UNSIGNED,

    FOREIGN KEY (workspace_id) REFERENCES research_workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (message_id) REFERENCES ai_conversation_messages(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_annotation_id) REFERENCES workspace_annotations(id) ON DELETE CASCADE,
    FOREIGN KEY (resolved_by_user_id) REFERENCES users(id) ON DELETE SET NULL,

    INDEX idx_workspace_annotations (workspace_id, created_at DESC),
    INDEX idx_message_annotations (message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS workspace_activity_log (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,

    -- Activity details
    activity_type ENUM('MESSAGE_SENT', 'ANNOTATION_ADDED', 'DOCUMENT_ATTACHED', 'PARTICIPANT_JOINED', 'PARTICIPANT_LEFT', 'WORKSPACE_CREATED', 'WORKSPACE_ARCHIVED') NOT NULL,
    activity_description VARCHAR(500),
    entity_type VARCHAR(50),
    entity_id BIGINT UNSIGNED,

    -- Metadata
    activity_data JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (workspace_id) REFERENCES research_workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

    INDEX idx_workspace_activity (workspace_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- FEATURE 5: Smart Legal Development Notifications
-- =============================================================================

CREATE TABLE IF NOT EXISTS legal_development_subscriptions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    subscription_name VARCHAR(255),

    -- Subscription criteria
    keywords JSON NOT NULL,
    practice_areas JSON,
    jurisdictions JSON,
    case_id BIGINT UNSIGNED,

    -- Source configuration
    monitor_case_law BOOLEAN DEFAULT TRUE,
    monitor_statutes BOOLEAN DEFAULT TRUE,
    monitor_regulations BOOLEAN DEFAULT TRUE,

    -- Notification preferences
    notification_frequency ENUM('REAL_TIME', 'DAILY_DIGEST', 'WEEKLY_DIGEST') DEFAULT 'DAILY_DIGEST',
    email_notifications BOOLEAN DEFAULT TRUE,
    in_app_notifications BOOLEAN DEFAULT TRUE,

    -- Filtering
    relevance_threshold DECIMAL(5,2) DEFAULT 70.00,

    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_checked_at TIMESTAMP NULL,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (case_id) REFERENCES legal_cases(id) ON DELETE CASCADE,

    INDEX idx_active_subscriptions (is_active, last_checked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS legal_development_alerts (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    subscription_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,

    -- Development details
    development_type ENUM('CASE_LAW', 'STATUTE', 'REGULATION', 'RULE_CHANGE') NOT NULL,
    title VARCHAR(500) NOT NULL,
    summary TEXT,
    citation VARCHAR(500),
    source_url VARCHAR(1000),
    publication_date DATE,

    -- Relevance scoring
    relevance_score DECIMAL(5,2) NOT NULL,
    relevance_explanation TEXT,

    -- Impact analysis
    potential_impact ENUM('HIGH', 'MEDIUM', 'LOW') NOT NULL,
    impact_summary TEXT,
    affected_cases JSON,

    -- User interaction
    status ENUM('UNREAD', 'READ', 'DISMISSED', 'ACTIONED') DEFAULT 'UNREAD',
    read_at TIMESTAMP NULL,
    actioned_at TIMESTAMP NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (subscription_id) REFERENCES legal_development_subscriptions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

    INDEX idx_user_unread (user_id, status, created_at DESC),
    INDEX idx_impact (potential_impact, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- FEATURE 6: Citation Manager with Auto-Shepardization
-- =============================================================================

CREATE TABLE IF NOT EXISTS citation_library (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    case_id BIGINT UNSIGNED,

    -- Citation details
    citation_string VARCHAR(500) NOT NULL,
    case_name VARCHAR(500),
    court VARCHAR(200),
    decision_date DATE,
    docket_number VARCHAR(100),

    -- Shepardization data
    shepardization_status ENUM('GOOD_LAW', 'QUESTIONED', 'CRITICIZED', 'DISTINGUISHED', 'OVERRULED', 'SUPERSEDED', 'UNKNOWN') DEFAULT 'UNKNOWN',
    last_shepardized_at TIMESTAMP NULL,
    shepard_signal VARCHAR(50),

    -- Treatment summary
    citing_cases_count INT DEFAULT 0,
    positive_treatment_count INT DEFAULT 0,
    negative_treatment_count INT DEFAULT 0,
    neutral_treatment_count INT DEFAULT 0,

    -- Jurisdictional analysis
    jurisdictions_covered JSON,
    primary_jurisdiction VARCHAR(100),
    multi_jurisdiction BOOLEAN DEFAULT FALSE,

    -- Organization
    tags JSON,
    notes TEXT,
    is_favorite BOOLEAN DEFAULT FALSE,

    -- Alerts
    alert_on_new_treatment BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (case_id) REFERENCES legal_cases(id) ON DELETE SET NULL,

    UNIQUE KEY unique_citation (user_id, citation_string),
    INDEX idx_shepard_status (shepardization_status),
    INDEX idx_user_favorites (user_id, is_favorite)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shepardization_history (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    citation_id BIGINT UNSIGNED NOT NULL,

    -- Citing case details
    citing_case_citation VARCHAR(500) NOT NULL,
    citing_case_name VARCHAR(500),
    citing_case_date DATE,
    citing_case_court VARCHAR(200),

    -- Treatment
    treatment_type ENUM('FOLLOWED', 'DISTINGUISHED', 'CRITICIZED', 'OVERRULED', 'QUESTIONED', 'CITED', 'SUPERSEDED') NOT NULL,
    treatment_depth ENUM('ANALYZED', 'DISCUSSED', 'MENTIONED') DEFAULT 'MENTIONED',

    -- Context
    citing_page_number VARCHAR(50),
    excerpt TEXT,
    headnote_reference VARCHAR(100),

    discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (citation_id) REFERENCES citation_library(id) ON DELETE CASCADE,

    INDEX idx_citation_treatment (citation_id, treatment_type, discovered_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- FEATURE 7: AI Opposing Counsel Simulator
-- =============================================================================

CREATE TABLE IF NOT EXISTS argument_simulations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    case_id BIGINT UNSIGNED,

    -- Original argument
    original_argument TEXT NOT NULL,
    argument_type VARCHAR(100),
    legal_issue VARCHAR(500),

    -- Simulation results
    counterarguments_json JSON,
    weaknesses_identified JSON,
    suggested_rebuttals JSON,

    -- Scoring
    strength_score DECIMAL(5,2),
    vulnerability_score DECIMAL(5,2),

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (case_id) REFERENCES legal_cases(id) ON DELETE SET NULL,

    INDEX idx_user_simulations (user_id, created_at DESC),
    INDEX idx_case_simulations (case_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- FEATURE 8: Jurisdiction Intelligence Engine
-- =============================================================================

CREATE TABLE IF NOT EXISTS jurisdiction_comparisons (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    case_id BIGINT UNSIGNED,

    -- Comparison parameters
    legal_issue VARCHAR(500) NOT NULL,
    jurisdictions_array JSON NOT NULL,
    practice_area VARCHAR(100),

    -- Analysis results
    comparison_matrix_json JSON,
    key_differences JSON,
    choice_of_law_recommendation TEXT,
    forum_shopping_analysis TEXT,

    -- Recommendations
    recommended_jurisdiction VARCHAR(100),
    recommendation_reasoning TEXT,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (case_id) REFERENCES legal_cases(id) ON DELETE SET NULL,

    INDEX idx_user_comparisons (user_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- FEATURE 9: Predictive Case Outcome Analysis
-- =============================================================================

CREATE TABLE IF NOT EXISTS judge_analytics (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    judge_name VARCHAR(255) NOT NULL,
    court VARCHAR(200),
    jurisdiction VARCHAR(100),

    -- Ruling patterns
    ruling_patterns_json JSON,
    avg_plaintiff_win_rate DECIMAL(5,2),
    avg_defendant_win_rate DECIMAL(5,2),

    -- Motion statistics
    motion_grant_rates JSON,
    summary_judgment_grant_rate DECIMAL(5,2),
    motion_to_dismiss_grant_rate DECIMAL(5,2),

    -- Case type preferences
    case_type_statistics JSON,

    -- Metadata
    total_cases_analyzed INT DEFAULT 0,
    data_source VARCHAR(100),
    last_updated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE KEY unique_judge (judge_name, court),
    INDEX idx_court (court),
    INDEX idx_jurisdiction (jurisdiction)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS case_outcome_predictions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    case_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,

    -- Prediction
    predicted_outcome VARCHAR(255),
    confidence_score DECIMAL(5,2),
    success_probability DECIMAL(5,2),

    -- Analysis factors
    factors_json JSON,
    judge_analytics_id BIGINT UNSIGNED,
    similar_cases_analyzed INT,

    -- Risk assessment
    risk_level ENUM('LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'),
    risk_factors JSON,

    -- Recommendations
    settlement_recommendation TEXT,
    strategy_recommendations JSON,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (case_id) REFERENCES legal_cases(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (judge_analytics_id) REFERENCES judge_analytics(id) ON DELETE SET NULL,

    INDEX idx_case_predictions (case_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- FEATURE 10: Visual Research Mind Maps
-- =============================================================================

CREATE TABLE IF NOT EXISTS research_mind_map_nodes (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    workspace_id BIGINT UNSIGNED,
    user_id BIGINT UNSIGNED NOT NULL,
    session_id BIGINT UNSIGNED,

    -- Node properties
    node_type VARCHAR(50),
    label VARCHAR(255),
    content TEXT,

    -- Visual properties
    position_x DECIMAL(10,2),
    position_y DECIMAL(10,2),
    color VARCHAR(20),
    size VARCHAR(20),

    -- Metadata
    metadata_json JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (workspace_id) REFERENCES research_workspaces(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES ai_conversation_sessions(id) ON DELETE CASCADE,

    INDEX idx_workspace_nodes (workspace_id),
    INDEX idx_session_nodes (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS research_mind_map_edges (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    source_node_id BIGINT UNSIGNED NOT NULL,
    target_node_id BIGINT UNSIGNED NOT NULL,

    -- Edge properties
    relationship_type VARCHAR(100),
    label VARCHAR(255),
    strength DECIMAL(5,2),

    -- Visual properties
    color VARCHAR(20),
    style VARCHAR(50),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (source_node_id) REFERENCES research_mind_map_nodes(id) ON DELETE CASCADE,
    FOREIGN KEY (target_node_id) REFERENCES research_mind_map_nodes(id) ON DELETE CASCADE,

    INDEX idx_source_edges (source_node_id),
    INDEX idx_target_edges (target_node_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- FEATURE 11: AI Deposition Prep Assistant
-- =============================================================================

CREATE TABLE IF NOT EXISTS deposition_prep_sessions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    case_id BIGINT UNSIGNED,

    -- Deposition details
    deponent_name VARCHAR(255),
    deposition_date DATE,
    deposition_type VARCHAR(100),

    -- Documents analyzed
    documents_analyzed JSON,
    total_documents INT DEFAULT 0,

    -- Analysis summary
    contradictions_found INT DEFAULT 0,
    timeline_events_extracted INT DEFAULT 0,
    questions_generated INT DEFAULT 0,

    -- Status
    status ENUM('DRAFT', 'IN_PROGRESS', 'COMPLETED') DEFAULT 'DRAFT',

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (case_id) REFERENCES legal_cases(id) ON DELETE SET NULL,

    INDEX idx_user_sessions (user_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS deposition_questions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    session_id BIGINT UNSIGNED NOT NULL,

    -- Question details
    question_text TEXT NOT NULL,
    question_category VARCHAR(100),
    question_type VARCHAR(50),

    -- Context
    based_on_document_id CHAR(36), -- UUID reference to legal_documents
    based_on_evidence TEXT,
    expected_answer TEXT,

    -- Organization
    question_order INT,
    is_follow_up BOOLEAN DEFAULT FALSE,
    parent_question_id BIGINT UNSIGNED,

    -- User interaction
    is_included BOOLEAN DEFAULT TRUE,
    user_modified_text TEXT,
    notes TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (session_id) REFERENCES deposition_prep_sessions(id) ON DELETE CASCADE,
    -- Note: based_on_document_id is UUID (CHAR(36)) - no FK constraint for performance
    FOREIGN KEY (parent_question_id) REFERENCES deposition_questions(id) ON DELETE SET NULL,

    INDEX idx_session_questions (session_id, question_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS document_contradictions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    session_id BIGINT UNSIGNED NOT NULL,

    -- Contradiction details
    contradiction_type VARCHAR(100),
    severity ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL,

    -- Document references
    document_1_id CHAR(36), -- UUID reference to legal_documents
    document_1_excerpt TEXT,
    document_1_page VARCHAR(50),

    document_2_id CHAR(36), -- UUID reference to legal_documents
    document_2_excerpt TEXT,
    document_2_page VARCHAR(50),

    -- Analysis
    contradiction_explanation TEXT,
    potential_resolution TEXT,

    -- User interaction
    is_acknowledged BOOLEAN DEFAULT FALSE,
    user_notes TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (session_id) REFERENCES deposition_prep_sessions(id) ON DELETE CASCADE,
    -- Note: document_1_id and document_2_id are UUIDs (CHAR(36)) - no FK constraints for performance

    INDEX idx_session_contradictions (session_id, severity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- FEATURE 12: Real-Time Hearing Assistant
-- =============================================================================

CREATE TABLE IF NOT EXISTS hearing_assistant_sessions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    case_id BIGINT UNSIGNED,

    -- Hearing details
    hearing_type VARCHAR(100),
    hearing_date DATE,
    court_name VARCHAR(200),
    judge_name VARCHAR(255),

    -- Session tracking
    session_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    session_end TIMESTAMP NULL,
    total_queries INT DEFAULT 0,

    -- Transcript data (if available)
    transcript_segments JSON,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (case_id) REFERENCES legal_cases(id) ON DELETE SET NULL,

    INDEX idx_user_sessions (user_id, hearing_date DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS hearing_assistant_queries (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    session_id BIGINT UNSIGNED NOT NULL,

    -- Query details
    query_text TEXT NOT NULL,
    query_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Response
    response_text TEXT,
    response_citations JSON,
    response_time_ms INT,

    -- Context
    hearing_context TEXT,

    -- User interaction
    was_helpful BOOLEAN,
    bookmarked BOOLEAN DEFAULT FALSE,

    FOREIGN KEY (session_id) REFERENCES hearing_assistant_sessions(id) ON DELETE CASCADE,

    INDEX idx_session_queries (session_id, query_timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- FEATURE 13: Client-Facing Research Portal
-- =============================================================================

CREATE TABLE IF NOT EXISTS client_research_shares (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    case_id BIGINT UNSIGNED,
    client_user_id BIGINT UNSIGNED,

    -- Share details
    share_title VARCHAR(255) NOT NULL,
    share_description TEXT,

    -- Content
    original_research_session_id BIGINT UNSIGNED,
    simplified_content TEXT,
    faq_json JSON,
    key_points JSON,

    -- Access control
    access_token VARCHAR(100) UNIQUE,
    is_password_protected BOOLEAN DEFAULT FALSE,
    password_hash VARCHAR(255),

    -- Permissions
    allow_download BOOLEAN DEFAULT FALSE,
    allow_print BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP NULL,

    -- Status
    status ENUM('DRAFT', 'ACTIVE', 'EXPIRED', 'REVOKED') DEFAULT 'DRAFT',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at TIMESTAMP NULL,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (case_id) REFERENCES legal_cases(id) ON DELETE SET NULL,
    FOREIGN KEY (client_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (original_research_session_id) REFERENCES ai_conversation_sessions(id) ON DELETE SET NULL,

    INDEX idx_user_shares (user_id, created_at DESC),
    INDEX idx_client_shares (client_user_id, status),
    INDEX idx_access_token (access_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS client_portal_access_log (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    share_id BIGINT UNSIGNED NOT NULL,

    -- Access details
    accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,

    -- Activity
    action VARCHAR(50),
    duration_seconds INT,

    FOREIGN KEY (share_id) REFERENCES client_research_shares(id) ON DELETE CASCADE,

    INDEX idx_share_access (share_id, accessed_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- Additional Support Tables
-- =============================================================================

-- AI Usage Quota (for cost management)
CREATE TABLE IF NOT EXISTS ai_usage_quota (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    quota_date DATE NOT NULL,

    -- Usage tracking
    tokens_used INT DEFAULT 0,
    api_calls_made INT DEFAULT 0,
    cost_usd DECIMAL(10,4) DEFAULT 0.0000,

    -- Limits
    daily_token_limit INT DEFAULT 100000,
    monthly_cost_limit_usd DECIMAL(10,2) DEFAULT 500.00,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

    UNIQUE KEY unique_user_date (user_id, quota_date),
    INDEX idx_quota_date (quota_date DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Audit Log for security compliance
CREATE TABLE IF NOT EXISTS legal_research_audit_log (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED,

    -- Action details
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id BIGINT UNSIGNED,

    -- Request details
    ip_address VARCHAR(45),
    user_agent TEXT,

    -- Metadata
    metadata_json JSON,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,

    INDEX idx_user_actions (user_id, timestamp DESC),
    INDEX idx_action_type (action, timestamp DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- Performance Optimization Indexes
-- =============================================================================

-- Composite indexes for common query patterns
CREATE INDEX idx_session_user_date ON ai_conversation_sessions(user_id, created_at DESC);
CREATE INDEX idx_workspace_active ON research_workspaces(status, last_activity_at DESC);

-- Full-text search indexes
ALTER TABLE citation_library ADD FULLTEXT INDEX idx_citation_fulltext (citation_string, case_name);
ALTER TABLE research_workspaces ADD FULLTEXT INDEX idx_workspace_search (workspace_name, primary_research_question);

-- =============================================================================
-- End of Migration
-- =============================================================================
