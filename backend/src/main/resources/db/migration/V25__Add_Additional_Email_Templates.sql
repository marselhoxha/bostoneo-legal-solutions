-- Add email templates for additional event types

-- Client Meeting Template
INSERT INTO email_templates (name, event_type, subject, body_template, description, is_default, is_active)
VALUES
('Client Meeting Reminder', 'CLIENT_MEETING', 
 'Client Meeting Reminder: {{eventTitle}}', 
 '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Client Meeting Reminder</title>
    <style>
        body {
            font-family: ''Segoe UI'', Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            background-color: #f7f9fc;
            margin: 0;
            padding: 0;
        }
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border: 1px solid #e1e1e1;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 8px rgba(0,0,0,0.05);
        }
        .email-header {
            background-color: #405189;
            color: #ffffff;
            padding: 20px;
            text-align: center;
        }
        .email-header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .email-body {
            padding: 30px;
        }
        .email-footer {
            background-color: #f8f9fa;
            color: #6c757d;
            font-size: 12px;
            padding: 20px;
            text-align: center;
        }
        .event-card {
            background-color: #f8f9fa;
            border-left: 4px solid #405189;
            padding: 20px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .event-title {
            margin-top: 0;
            color: #405189;
            font-weight: 600;
        }
        .event-detail {
            margin-bottom: 10px;
        }
        .detail-label {
            font-weight: 600;
            display: inline-block;
            width: 100px;
        }
        .reminder-time {
            background-color: #e6f3ff;
            border: 1px solid #b8daff;
            border-radius: 4px;
            padding: 10px;
            margin: 20px 0;
            color: #004085;
            font-weight: 500;
        }
        .action-button {
            display: inline-block;
            background-color: #405189;
            color: #ffffff !important;
            text-decoration: none;
            padding: 12px 30px;
            border-radius: 4px;
            font-weight: 600;
            margin: 20px 0;
        }
        .client-info {
            background-color: #f8f9fa;
            border: 1px solid #e1e1e1;
            border-radius: 4px;
            padding: 15px;
            margin-top: 20px;
        }
        .client-info h3 {
            margin-top: 0;
            color: #405189;
            font-size: 16px;
        }
        .logo {
            margin-bottom: 15px;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header">
            <div class="logo">
                <img src="https://bostoneo.com/logo.png" alt="Bostoneo Solutions" height="40">
            </div>
            <h1>Client Meeting Reminder</h1>
        </div>
        <div class="email-body">
            <p>Hello {{userName}},</p>
            <p>This is a reminder about your upcoming client meeting:</p>
            
            <div class="event-card">
                <h2 class="event-title">{{eventTitle}}</h2>
                <div class="event-detail">
                    <span class="detail-label">Date:</span> {{eventDate}}
                </div>
                <div class="event-detail">
                    <span class="detail-label">Time:</span> {{eventTime}}
                </div>
                <div class="event-detail">
                    <span class="detail-label">Location:</span> {{eventLocation}}
                </div>
                
                {{#if caseTitle}}
                <div class="event-detail" style="margin-top: 15px;">
                    <span class="detail-label">Case:</span> {{caseTitle}}
                </div>
                <div class="event-detail">
                    <span class="detail-label">Case Number:</span> {{caseNumber}}
                </div>
                {{/if}}
            </div>
            
            <div class="reminder-time">
                <strong>Starting Soon:</strong> This meeting is scheduled to begin in {{minutesBefore}} minutes.
            </div>
            
            {{#if clientInfo}}
            <div class="client-info">
                <h3>Client Information</h3>
                {{clientInfo}}
            </div>
            {{/if}}
            
            <p>Please ensure you have all necessary documents and information prepared for this client meeting.</p>
            
            <a href="https://app.bostoneo.com/calendar" class="action-button">View Meeting Details</a>
        </div>
        <div class="email-footer">
            <p>This is an automated reminder from the Bostoneo Solutions Case Management System.</p>
            <p>© 2023 Bostoneo Solutions. All rights reserved.</p>
        </div>
    </div>
</body>
</html>',
 'Template for client meeting reminders',
 TRUE, TRUE);

-- Consultation Template
INSERT INTO email_templates (name, event_type, subject, body_template, description, is_default, is_active)
VALUES
('Consultation Reminder', 'CONSULTATION', 
 'Consultation Reminder: {{eventTitle}}', 
 '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Consultation Reminder</title>
    <style>
        body {
            font-family: ''Segoe UI'', Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            background-color: #f7f9fc;
            margin: 0;
            padding: 0;
        }
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border: 1px solid #e1e1e1;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 8px rgba(0,0,0,0.05);
        }
        .email-header {
            background-color: #5b73e8;
            color: #ffffff;
            padding: 20px;
            text-align: center;
        }
        .email-header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .email-body {
            padding: 30px;
        }
        .email-footer {
            background-color: #f8f9fa;
            color: #6c757d;
            font-size: 12px;
            padding: 20px;
            text-align: center;
        }
        .event-card {
            background-color: #f8f9fa;
            border-left: 4px solid #5b73e8;
            padding: 20px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .event-title {
            margin-top: 0;
            color: #5b73e8;
            font-weight: 600;
        }
        .event-detail {
            margin-bottom: 10px;
        }
        .detail-label {
            font-weight: 600;
            display: inline-block;
            width: 100px;
        }
        .reminder-time {
            background-color: #e6f3ff;
            border: 1px solid #b8daff;
            border-radius: 4px;
            padding: 10px;
            margin: 20px 0;
            color: #004085;
            font-weight: 500;
        }
        .action-button {
            display: inline-block;
            background-color: #5b73e8;
            color: #ffffff !important;
            text-decoration: none;
            padding: 12px 30px;
            border-radius: 4px;
            font-weight: 600;
            margin: 20px 0;
        }
        .consultation-prep {
            background-color: #f8f9fa;
            border: 1px solid #e1e1e1;
            border-radius: 4px;
            padding: 15px;
            margin-top: 20px;
        }
        .consultation-prep h3 {
            margin-top: 0;
            color: #5b73e8;
            font-size: 16px;
        }
        .consultation-prep ul {
            margin-bottom: 0;
            padding-left: 20px;
        }
        .logo {
            margin-bottom: 15px;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header">
            <div class="logo">
                <img src="https://bostoneo.com/logo.png" alt="Bostoneo Solutions" height="40">
            </div>
            <h1>Consultation Reminder</h1>
        </div>
        <div class="email-body">
            <p>Hello {{userName}},</p>
            <p>This is a reminder about your upcoming consultation:</p>
            
            <div class="event-card">
                <h2 class="event-title">{{eventTitle}}</h2>
                <div class="event-detail">
                    <span class="detail-label">Date:</span> {{eventDate}}
                </div>
                <div class="event-detail">
                    <span class="detail-label">Time:</span> {{eventTime}}
                </div>
                <div class="event-detail">
                    <span class="detail-label">Location:</span> {{eventLocation}}
                </div>
                {{#if consultationType}}
                <div class="event-detail">
                    <span class="detail-label">Type:</span> {{consultationType}}
                </div>
                {{/if}}
            </div>
            
            <div class="reminder-time">
                <strong>Starting Soon:</strong> This consultation is scheduled to begin in {{minutesBefore}} minutes.
            </div>
            
            <div class="consultation-prep">
                <h3>Consultation Preparation</h3>
                <ul>
                    <li>Review client information and case details</li>
                    <li>Prepare any required documentation</li>
                    <li>Check consultation requirements and agenda</li>
                    <li>Ensure meeting space or virtual meeting link is ready</li>
                </ul>
            </div>
            
            <a href="https://app.bostoneo.com/calendar" class="action-button">View Consultation Details</a>
        </div>
        <div class="email-footer">
            <p>This is an automated reminder from the Bostoneo Solutions Case Management System.</p>
            <p>© 2023 Bostoneo Solutions. All rights reserved.</p>
        </div>
    </div>
</body>
</html>',
 'Template for consultation reminders',
 TRUE, TRUE);

-- Team Meeting Template
INSERT INTO email_templates (name, event_type, subject, body_template, description, is_default, is_active)
VALUES
('Team Meeting Reminder', 'TEAM_MEETING', 
 'Team Meeting Reminder: {{eventTitle}}', 
 '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Team Meeting Reminder</title>
    <style>
        body {
            font-family: ''Segoe UI'', Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            background-color: #f7f9fc;
            margin: 0;
            padding: 0;
        }
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border: 1px solid #e1e1e1;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 8px rgba(0,0,0,0.05);
        }
        .email-header {
            background-color: #299cdb;
            color: #ffffff;
            padding: 20px;
            text-align: center;
        }
        .email-header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .email-body {
            padding: 30px;
        }
        .email-footer {
            background-color: #f8f9fa;
            color: #6c757d;
            font-size: 12px;
            padding: 20px;
            text-align: center;
        }
        .event-card {
            background-color: #f8f9fa;
            border-left: 4px solid #299cdb;
            padding: 20px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .event-title {
            margin-top: 0;
            color: #299cdb;
            font-weight: 600;
        }
        .event-detail {
            margin-bottom: 10px;
        }
        .detail-label {
            font-weight: 600;
            display: inline-block;
            width: 100px;
        }
        .reminder-time {
            background-color: #e6f3ff;
            border: 1px solid #b8daff;
            border-radius: 4px;
            padding: 10px;
            margin: 20px 0;
            color: #004085;
            font-weight: 500;
        }
        .action-button {
            display: inline-block;
            background-color: #299cdb;
            color: #ffffff !important;
            text-decoration: none;
            padding: 12px 30px;
            border-radius: 4px;
            font-weight: 600;
            margin: 20px 0;
        }
        .meeting-agenda {
            background-color: #f8f9fa;
            border: 1px solid #e1e1e1;
            border-radius: 4px;
            padding: 15px;
            margin-top: 20px;
        }
        .meeting-agenda h3 {
            margin-top: 0;
            color: #299cdb;
            font-size: 16px;
        }
        .attendees {
            margin-top: 15px;
        }
        .attendees h4 {
            color: #299cdb;
            font-size: 14px;
            margin-bottom: 5px;
        }
        .attendee-list {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }
        .attendee {
            background-color: #e6f3ff;
            border-radius: 15px;
            padding: 3px 10px;
            font-size: 12px;
            color: #004085;
        }
        .logo {
            margin-bottom: 15px;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header">
            <div class="logo">
                <img src="https://bostoneo.com/logo.png" alt="Bostoneo Solutions" height="40">
            </div>
            <h1>Team Meeting Reminder</h1>
        </div>
        <div class="email-body">
            <p>Hello {{userName}},</p>
            <p>This is a reminder about your upcoming team meeting:</p>
            
            <div class="event-card">
                <h2 class="event-title">{{eventTitle}}</h2>
                <div class="event-detail">
                    <span class="detail-label">Date:</span> {{eventDate}}
                </div>
                <div class="event-detail">
                    <span class="detail-label">Time:</span> {{eventTime}}
                </div>
                <div class="event-detail">
                    <span class="detail-label">Location:</span> {{eventLocation}}
                </div>
                
                {{#if meetingLink}}
                <div class="event-detail">
                    <span class="detail-label">Join Link:</span> <a href="{{meetingLink}}">{{meetingLink}}</a>
                </div>
                {{/if}}
            </div>
            
            <div class="reminder-time">
                <strong>Starting Soon:</strong> This team meeting begins in {{minutesBefore}} minutes.
            </div>
            
            {{#if meetingAgenda}}
            <div class="meeting-agenda">
                <h3>Meeting Agenda</h3>
                <p>{{meetingAgenda}}</p>
            </div>
            {{/if}}
            
            {{#if attendees}}
            <div class="attendees">
                <h4>Meeting Attendees</h4>
                <div class="attendee-list">
                    {{#each attendees}}
                    <span class="attendee">{{this}}</span>
                    {{/each}}
                </div>
            </div>
            {{/if}}
            
            {{#if meetingLink}}
            <a href="{{meetingLink}}" class="action-button">Join Meeting</a>
            {{else}}
            <a href="https://app.bostoneo.com/calendar" class="action-button">View Meeting Details</a>
            {{/if}}
        </div>
        <div class="email-footer">
            <p>This is an automated reminder from the Bostoneo Solutions Case Management System.</p>
            <p>© 2023 Bostoneo Solutions. All rights reserved.</p>
        </div>
    </div>
</body>
</html>',
 'Template for team meeting reminders',
 TRUE, TRUE);

-- General Reminder Template
INSERT INTO email_templates (name, event_type, subject, body_template, description, is_default, is_active)
VALUES
('General Reminder', 'REMINDER', 
 'Reminder: {{eventTitle}}', 
 '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>General Reminder</title>
    <style>
        body {
            font-family: ''Segoe UI'', Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            background-color: #f7f9fc;
            margin: 0;
            padding: 0;
        }
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border: 1px solid #e1e1e1;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 8px rgba(0,0,0,0.05);
        }
        .email-header {
            background-color: #0ab39c;
            color: #ffffff;
            padding: 20px;
            text-align: center;
        }
        .email-header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .email-body {
            padding: 30px;
        }
        .email-footer {
            background-color: #f8f9fa;
            color: #6c757d;
            font-size: 12px;
            padding: 20px;
            text-align: center;
        }
        .event-card {
            background-color: #f8f9fa;
            border-left: 4px solid #0ab39c;
            padding: 20px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .event-title {
            margin-top: 0;
            color: #0ab39c;
            font-weight: 600;
        }
        .event-detail {
            margin-bottom: 10px;
        }
        .detail-label {
            font-weight: 600;
            display: inline-block;
            width: 100px;
        }
        .reminder-time {
            background-color: #e6f3ff;
            border: 1px solid #b8daff;
            border-radius: 4px;
            padding: 10px;
            margin: 20px 0;
            color: #004085;
            font-weight: 500;
        }
        .action-button {
            display: inline-block;
            background-color: #0ab39c;
            color: #ffffff !important;
            text-decoration: none;
            padding: 12px 30px;
            border-radius: 4px;
            font-weight: 600;
            margin: 20px 0;
        }
        .logo {
            margin-bottom: 15px;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header">
            <div class="logo">
                <img src="https://bostoneo.com/logo.png" alt="Bostoneo Solutions" height="40">
            </div>
            <h1>Reminder</h1>
        </div>
        <div class="email-body">
            <p>Hello {{userName}},</p>
            <p>This is a reminder for your attention:</p>
            
            <div class="event-card">
                <h2 class="event-title">{{eventTitle}}</h2>
                <div class="event-detail">
                    <span class="detail-label">Date:</span> {{eventDate}}
                </div>
                <div class="event-detail">
                    <span class="detail-label">Time:</span> {{eventTime}}
                </div>
                {{#if eventLocation}}
                <div class="event-detail">
                    <span class="detail-label">Location:</span> {{eventLocation}}
                </div>
                {{/if}}
                
                {{#if caseTitle}}
                <div class="event-detail" style="margin-top: 15px;">
                    <span class="detail-label">Case:</span> {{caseTitle}}
                </div>
                <div class="event-detail">
                    <span class="detail-label">Case Number:</span> {{caseNumber}}
                </div>
                {{/if}}
            </div>
            
            <div class="reminder-time">
                <strong>Coming Up:</strong> This is scheduled in {{minutesBefore}} minutes.
            </div>
            
            {{#if description}}
            <p>{{description}}</p>
            {{/if}}
            
            <a href="https://app.bostoneo.com/calendar" class="action-button">View Details</a>
        </div>
        <div class="email-footer">
            <p>This is an automated reminder from the Bostoneo Solutions Case Management System.</p>
            <p>© 2023 Bostoneo Solutions. All rights reserved.</p>
        </div>
    </div>
</body>
</html>',
 'Template for general reminders',
 TRUE, TRUE);

-- Deposition Template
INSERT INTO email_templates (name, event_type, subject, body_template, description, is_default, is_active)
VALUES
('Deposition Reminder', 'DEPOSITION', 
 'Deposition Reminder: {{eventTitle}}', 
 '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Deposition Reminder</title>
    <style>
        body {
            font-family: ''Segoe UI'', Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            background-color: #f7f9fc;
            margin: 0;
            padding: 0;
        }
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border: 1px solid #e1e1e1;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 8px rgba(0,0,0,0.05);
        }
        .email-header {
            background-color: #6c757d;
            color: #ffffff;
            padding: 20px;
            text-align: center;
        }
        .email-header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .email-body {
            padding: 30px;
        }
        .email-footer {
            background-color: #f8f9fa;
            color: #6c757d;
            font-size: 12px;
            padding: 20px;
            text-align: center;
        }
        .event-card {
            background-color: #f8f9fa;
            border-left: 4px solid #6c757d;
            padding: 20px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .event-title {
            margin-top: 0;
            color: #6c757d;
            font-weight: 600;
        }
        .event-detail {
            margin-bottom: 10px;
        }
        .detail-label {
            font-weight: 600;
            display: inline-block;
            width: 100px;
        }
        .reminder-time {
            background-color: #f8f9fa;
            border: 1px solid #dddddd;
            border-radius: 4px;
            padding: 10px;
            margin: 20px 0;
            color: #333333;
            font-weight: 500;
        }
        .action-button {
            display: inline-block;
            background-color: #6c757d;
            color: #ffffff !important;
            text-decoration: none;
            padding: 12px 30px;
            border-radius: 4px;
            font-weight: 600;
            margin: 20px 0;
        }
        .deposition-checklist {
            background-color: #f8f9fa;
            border: 1px solid #e1e1e1;
            border-radius: 4px;
            padding: 15px;
            margin-top: 20px;
        }
        .deposition-checklist h3 {
            margin-top: 0;
            color: #6c757d;
            font-size: 16px;
        }
        .deposition-checklist ul {
            margin-bottom: 0;
        }
        .logo {
            margin-bottom: 15px;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header">
            <div class="logo">
                <img src="https://bostoneo.com/logo.png" alt="Bostoneo Solutions" height="40">
            </div>
            <h1>Deposition Reminder</h1>
        </div>
        <div class="email-body">
            <p>Hello {{userName}},</p>
            <p>This is a reminder about your upcoming deposition:</p>
            
            <div class="event-card">
                <h2 class="event-title">{{eventTitle}}</h2>
                <div class="event-detail">
                    <span class="detail-label">Date:</span> {{eventDate}}
                </div>
                <div class="event-detail">
                    <span class="detail-label">Time:</span> {{eventTime}}
                </div>
                <div class="event-detail">
                    <span class="detail-label">Location:</span> {{eventLocation}}
                </div>
                
                {{#if witness}}
                <div class="event-detail">
                    <span class="detail-label">Witness:</span> {{witness}}
                </div>
                {{/if}}
                
                <div class="event-detail" style="margin-top: 15px;">
                    <span class="detail-label">Case:</span> {{caseTitle}}
                </div>
                <div class="event-detail">
                    <span class="detail-label">Case Number:</span> {{caseNumber}}
                </div>
            </div>
            
            <div class="reminder-time">
                <strong>Important:</strong> This deposition is scheduled to begin in {{minutesBefore}} minutes.
            </div>
            
            <div class="deposition-checklist">
                <h3>Deposition Preparation Checklist</h3>
                <ul>
                    <li>Review case files and relevant documents</li>
                    <li>Prepare exhibits and reference materials</li>
                    <li>Confirm court reporter attendance</li>
                    <li>Check technical equipment if recording</li>
                    <li>Bring multiple copies of key documents</li>
                </ul>
            </div>
            
            <a href="https://app.bostoneo.com/calendar" class="action-button">View Deposition Details</a>
        </div>
        <div class="email-footer">
            <p>This is an automated reminder from the Bostoneo Solutions Case Management System.</p>
            <p>© 2023 Bostoneo Solutions. All rights reserved.</p>
        </div>
    </div>
</body>
</html>',
 'Template for deposition reminders',
 TRUE, TRUE);

-- Mediation Template
INSERT INTO email_templates (name, event_type, subject, body_template, description, is_default, is_active)
VALUES
('Mediation Reminder', 'MEDIATION', 
 'Mediation Reminder: {{eventTitle}}', 
 '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mediation Reminder</title>
    <style>
        body {
            font-family: ''Segoe UI'', Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            background-color: #f7f9fc;
            margin: 0;
            padding: 0;
        }
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border: 1px solid #e1e1e1;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 8px rgba(0,0,0,0.05);
        }
        .email-header {
            background-color: #0ab39c;
            color: #ffffff;
            padding: 20px;
            text-align: center;
        }
        .email-header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .email-body {
            padding: 30px;
        }
        .email-footer {
            background-color: #f8f9fa;
            color: #6c757d;
            font-size: 12px;
            padding: 20px;
            text-align: center;
        }
        .event-card {
            background-color: #f8f9fa;
            border-left: 4px solid #0ab39c;
            padding: 20px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .event-title {
            margin-top: 0;
            color: #0ab39c;
            font-weight: 600;
        }
        .event-detail {
            margin-bottom: 10px;
        }
        .detail-label {
            font-weight: 600;
            display: inline-block;
            width: 120px;
        }
        .reminder-time {
            background-color: #e7f6f3;
            border: 1px solid #bfeae3;
            border-radius: 4px;
            padding: 10px;
            margin: 20px 0;
            color: #1d6758;
            font-weight: 500;
        }
        .action-button {
            display: inline-block;
            background-color: #0ab39c;
            color: #ffffff !important;
            text-decoration: none;
            padding: 12px 30px;
            border-radius: 4px;
            font-weight: 600;
            margin: 20px 0;
        }
        .mediation-tips {
            background-color: #f8f9fa;
            border: 1px solid #e1e1e1;
            border-radius: 4px;
            padding: 15px;
            margin-top: 20px;
        }
        .mediation-tips h3 {
            margin-top: 0;
            color: #0ab39c;
            font-size: 16px;
        }
        .mediation-tips ul {
            margin-bottom: 0;
        }
        .logo {
            margin-bottom: 15px;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header">
            <div class="logo">
                <img src="https://bostoneo.com/logo.png" alt="Bostoneo Solutions" height="40">
            </div>
            <h1>Mediation Reminder</h1>
        </div>
        <div class="email-body">
            <p>Hello {{userName}},</p>
            <p>This is a reminder about your upcoming mediation session:</p>
            
            <div class="event-card">
                <h2 class="event-title">{{eventTitle}}</h2>
                <div class="event-detail">
                    <span class="detail-label">Date:</span> {{eventDate}}
                </div>
                <div class="event-detail">
                    <span class="detail-label">Time:</span> {{eventTime}}
                </div>
                <div class="event-detail">
                    <span class="detail-label">Location:</span> {{eventLocation}}
                </div>
                
                {{#if mediator}}
                <div class="event-detail">
                    <span class="detail-label">Mediator:</span> {{mediator}}
                </div>
                {{/if}}
                
                <div class="event-detail" style="margin-top: 15px;">
                    <span class="detail-label">Case:</span> {{caseTitle}}
                </div>
                <div class="event-detail">
                    <span class="detail-label">Case Number:</span> {{caseNumber}}
                </div>
                
                {{#if opposingParty}}
                <div class="event-detail">
                    <span class="detail-label">Opposing Party:</span> {{opposingParty}}
                </div>
                {{/if}}
                
                {{#if opposingCounsel}}
                <div class="event-detail">
                    <span class="detail-label">Opposing Counsel:</span> {{opposingCounsel}}
                </div>
                {{/if}}
            </div>
            
            <div class="reminder-time">
                <strong>Important:</strong> This mediation session is scheduled to begin in {{minutesBefore}} minutes.
            </div>
            
            <div class="mediation-tips">
                <h3>Mediation Preparation Tips</h3>
                <ul>
                    <li>Review settlement position and goals</li>
                    <li>Prepare client for the mediation process</li>
                    <li>Bring all relevant case documents</li>
                    <li>Consider alternative resolution options</li>
                    <li>Bring settlement agreement template if appropriate</li>
                </ul>
            </div>
            
            <a href="https://app.bostoneo.com/calendar" class="action-button">View Mediation Details</a>
        </div>
        <div class="email-footer">
            <p>This is an automated reminder from the Bostoneo Solutions Case Management System.</p>
            <p>© 2023 Bostoneo Solutions. All rights reserved.</p>
        </div>
    </div>
</body>
</html>',
 'Template for mediation reminders',
 TRUE, TRUE); 