-- Create the email_templates table
CREATE TABLE IF NOT EXISTS email_templates (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    event_type VARCHAR(50) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    body_template TEXT NOT NULL,
    description VARCHAR(255),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create the reminder_queue table
CREATE TABLE IF NOT EXISTS reminder_queue (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    event_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    scheduled_time TIMESTAMP NOT NULL,
    minutes_before INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    retry_count INT DEFAULT 0,
    last_attempt TIMESTAMP NULL,
    error_message VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reminder_type VARCHAR(20) NOT NULL DEFAULT 'PRIMARY',
    
    CONSTRAINT fk_reminder_event FOREIGN KEY (event_id) REFERENCES calendar_events(id) ON DELETE CASCADE
);

-- Create indexes for efficient queries
CREATE INDEX idx_reminder_status ON reminder_queue (status);
CREATE INDEX idx_reminder_event ON reminder_queue (event_id);
CREATE INDEX idx_reminder_scheduled ON reminder_queue (scheduled_time);
CREATE INDEX idx_email_template_event_type ON email_templates (event_type);
CREATE INDEX idx_email_template_active ON email_templates (is_active);

-- Insert default email templates
INSERT INTO email_templates (name, event_type, subject, body_template, description, is_default, is_active)
VALUES
('Default Hearing Reminder', 'HEARING', 
 'Reminder: {{eventTitle}}', 
 '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #2c3e50;">Hello {{userName}},</h2>
    <p>This is a reminder for your upcoming hearing:</p>
    <div style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #e74c3c; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #2c3e50;">{{eventTitle}}</h3>
        <p><strong>Date:</strong> {{eventDate}}</p>
        <p><strong>Time:</strong> {{eventTime}}</p>
        <p><strong>Location:</strong> {{eventLocation}}</p>
    </div>
    <p>This hearing is scheduled to begin in {{minutesBefore}} minutes.</p>
    <p>You can view full details in your calendar in the application.</p>
    <p>Best regards,<br>The Boston EO Solutions Team</p>
</div>', 
 'Default template for hearing reminders', 
 TRUE, TRUE),
 
('Default Deadline Reminder', 'DEADLINE', 
 'Reminder: {{eventTitle}} Deadline', 
 '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #2c3e50;">Hello {{userName}},</h2>
    <p>This is a reminder for your upcoming deadline:</p>
    <div style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #f39c12; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #2c3e50;">{{eventTitle}}</h3>
        <p><strong>Due Date:</strong> {{eventDate}}</p>
        <p><strong>Due Time:</strong> {{eventTime}}</p>
    </div>
    <p>This deadline is scheduled to expire in {{minutesBefore}} minutes.</p>
    <p>You can view full details in your calendar in the application.</p>
    <p>Best regards,<br>The Boston EO Solutions Team</p>
</div>', 
 'Default template for deadline reminders', 
 TRUE, TRUE),
 
('Default Meeting Reminder', 'MEETING', 
 'Reminder: {{eventTitle}}', 
 '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #2c3e50;">Hello {{userName}},</h2>
    <p>This is a reminder for your upcoming meeting:</p>
    <div style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #3498db; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #2c3e50;">{{eventTitle}}</h3>
        <p><strong>Date:</strong> {{eventDate}}</p>
        <p><strong>Time:</strong> {{eventTime}}</p>
        <p><strong>Location:</strong> {{eventLocation}}</p>
    </div>
    <p>This meeting is scheduled to begin in {{minutesBefore}} minutes.</p>
    <p>You can view full details in your calendar in the application.</p>
    <p>Best regards,<br>The Boston EO Solutions Team</p>
</div>', 
 'Default template for meeting reminders', 
 TRUE, TRUE); 