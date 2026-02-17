-- Enhanced Audit Log System for Activity Tracking
-- Migration V37: Create comprehensive audit and performance tracking tables

-- 1. Main Audit Log Table
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED,
    session_id VARCHAR(255),
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id BIGINT UNSIGNED,
    description TEXT,
    metadata JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_entity (entity_type, entity_id),
    INDEX idx_audit_timestamp (timestamp),
    INDEX idx_audit_action (action),
    INDEX idx_audit_recent (timestamp DESC, user_id),
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE SET NULL
);

-- 2. Performance Metrics Table for KPI tracking
CREATE TABLE IF NOT EXISTS performance_metrics (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,4) NOT NULL,
    metric_unit VARCHAR(20),
    category VARCHAR(50) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_metrics_name_period (metric_name, period_start, period_end),
    INDEX idx_metrics_category (category),
    INDEX idx_metrics_created (created_at)
);

-- 3. Case Timeline Table for detailed case activity tracking
CREATE TABLE IF NOT EXISTS case_timeline (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    case_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED,
    event_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    visibility VARCHAR(20) DEFAULT 'INTERNAL',
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (case_id) REFERENCES legal_cases(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE SET NULL,
    INDEX idx_case_timeline_case (case_id),
    INDEX idx_case_timeline_date (event_date),
    INDEX idx_case_timeline_user (user_id),
    INDEX idx_case_timeline_type (event_type)
);

-- 4. Activity Aggregation Table for performance
CREATE TABLE IF NOT EXISTS activity_summary (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    date DATE NOT NULL,
    user_id BIGINT UNSIGNED,
    entity_type VARCHAR(50),
    action VARCHAR(50),
    activity_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_daily_activity (date, user_id, entity_type, action),
    INDEX idx_activity_summary_date (date),
    INDEX idx_activity_summary_user (user_id),
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);

-- 5. System Health Metrics Table
CREATE TABLE IF NOT EXISTS system_health_metrics (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    metric_type VARCHAR(50) NOT NULL,
    metric_value DECIMAL(10,4) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    threshold_warning DECIMAL(10,4),
    threshold_critical DECIMAL(10,4),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_health_type_time (metric_type, recorded_at),
    INDEX idx_health_status (status)
);

-- 6. Insert initial performance metric categories
INSERT IGNORE INTO performance_metrics (metric_name, metric_value, metric_unit, category, period_start, period_end) VALUES
('collection_rate', 85.5, 'percentage', 'FINANCIAL', CURDATE() - INTERVAL 30 DAY, CURDATE()),
('case_success_rate', 78.2, 'percentage', 'CASE_MANAGEMENT', CURDATE() - INTERVAL 30 DAY, CURDATE()),
('client_satisfaction', 4.6, 'rating', 'CLIENT_SATISFACTION', CURDATE() - INTERVAL 30 DAY, CURDATE()),
('system_uptime', 99.8, 'percentage', 'OPERATIONAL', CURDATE() - INTERVAL 30 DAY, CURDATE()),
('average_response_time', 3.2, 'hours', 'CLIENT_SATISFACTION', CURDATE() - INTERVAL 30 DAY, CURDATE()),
('billable_utilization', 82.1, 'percentage', 'PRODUCTIVITY', CURDATE() - INTERVAL 30 DAY, CURDATE());

-- 7. Insert sample system health metrics
INSERT IGNORE INTO system_health_metrics (metric_type, metric_value, status, threshold_warning, threshold_critical) VALUES
('cpu_usage', 45.2, 'NORMAL', 70.0, 90.0),
('memory_usage', 62.8, 'NORMAL', 80.0, 95.0),
('disk_usage', 58.3, 'NORMAL', 85.0, 95.0),
('database_connections', 12, 'NORMAL', 80.0, 95.0),
('response_time_avg', 250.5, 'NORMAL', 1000.0, 2000.0);

-- 8. Add some sample audit log entries for testing
INSERT IGNORE INTO audit_log (user_id, action, entity_type, entity_id, description, metadata) VALUES
(1, 'LOGIN', 'USER', 1, 'User logged into the system', '{"browser": "Chrome", "os": "Windows"}'),
(1, 'VIEW', 'CUSTOMER', 1, 'Viewed customer details', '{"customer_name": "John Doe"}'),
(1, 'CREATE', 'CASE', 1, 'Created new case', '{"case_type": "Personal Injury", "priority": "HIGH"}'),
(1, 'UPDATE', 'DOCUMENT', 1, 'Updated document metadata', '{"document_type": "Contract", "version": "1.2"}'),
(2, 'CREATE', 'INVOICE', 1, 'Generated new invoice', '{"amount": 2500.00, "client": "ABC Corp"}');

-- Show migration completion message
SELECT 'V37 Migration completed: Enhanced Audit Log System created successfully!' as status; 
 
 
 
 
 
 