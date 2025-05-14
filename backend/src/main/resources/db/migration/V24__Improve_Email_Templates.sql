-- Update email templates with more professional designs

-- Update Hearing Reminder template
UPDATE email_templates 
SET subject = 'Hearing Reminder: {{eventTitle}}',
    body_template = '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hearing Reminder</title>
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
            border-left: 4px solid #e74c3c;
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
            background-color: #fff8ed;
            border: 1px solid #ffecb5;
            border-radius: 4px;
            padding: 10px;
            margin: 20px 0;
            color: #856404;
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
        .logo {
            margin-bottom: 15px;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header">
            <div class="logo">
                <img src="https://***REMOVED***.com/logo.png" alt="Bostoneo Solutions" height="40">
            </div>
            <h1>Court Hearing Reminder</h1>
        </div>
        <div class="email-body">
            <p>Hello {{userName}},</p>
            <p>This is a reminder of your upcoming court hearing. Please review the details below:</p>
            
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
                <div class="event-detail" style="margin-top: 15px;">
                    <span class="detail-label">Case:</span> {{caseTitle}}
                </div>
                <div class="event-detail">
                    <span class="detail-label">Case Number:</span> {{caseNumber}}
                </div>
            </div>
            
            <div class="reminder-time">
                <strong>Important:</strong> This hearing is scheduled to begin in {{minutesBefore}} minutes.
            </div>
            
            <p>Please ensure you have all necessary documents and arrive early to allow time for security checks and locating the correct courtroom.</p>
            
            <a href="https://app.***REMOVED***.com/calendar" class="action-button">View in Calendar</a>
        </div>
        <div class="email-footer">
            <p>This is an automated reminder from the Bostoneo Solutions Case Management System.</p>
            <p>© 2023 Bostoneo Solutions. All rights reserved.</p>
        </div>
    </div>
</body>
</html>'
WHERE event_type = 'HEARING' AND is_default = TRUE;

-- Update Deadline Reminder template
UPDATE email_templates 
SET subject = 'Deadline Alert: {{eventTitle}}',
    body_template = '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Deadline Reminder</title>
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
            background-color: #f7b84b;
            color: #ffffff;
            padding: 20px;
            text-align: center;
        }
        .high-priority .email-header {
            background-color: #f06548;
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
            border-left: 4px solid #f7b84b;
            padding: 20px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .high-priority .event-card {
            border-left: 4px solid #f06548;
        }
        .event-title {
            margin-top: 0;
            color: #f7b84b;
            font-weight: 600;
        }
        .high-priority .event-title {
            color: #f06548;
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
            background-color: #fff8ed;
            border: 1px solid #ffecb5;
            border-radius: 4px;
            padding: 10px;
            margin: 20px 0;
            color: #856404;
            font-weight: 500;
        }
        .high-priority .reminder-time {
            background-color: #fceeed;
            border: 1px solid #f8d7da;
            color: #721c24;
        }
        .action-button {
            display: inline-block;
            background-color: #f7b84b;
            color: #ffffff !important;
            text-decoration: none;
            padding: 12px 30px;
            border-radius: 4px;
            font-weight: 600;
            margin: 20px 0;
        }
        .high-priority .action-button {
            background-color: #f06548;
        }
        .priority-badge {
            display: inline-block;
            background-color: #f06548;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: 600;
            font-size: 12px;
            margin-bottom: 10px;
        }
        .logo {
            margin-bottom: 15px;
        }
    </style>
</head>
<body>
    <div class="email-container {{highPriorityClass}}">
        <div class="email-header">
            <div class="logo">
                <img src="https://***REMOVED***.com/logo.png" alt="Bostoneo Solutions" height="40">
            </div>
            <h1>Deadline Reminder</h1>
        </div>
        <div class="email-body">
            <p>Hello {{userName}},</p>
            
            {{#if highPriority}}
            <div class="priority-badge">HIGH PRIORITY</div>
            {{/if}}
            
            <p>{{#if highPriority}}This is an <strong>urgent reminder</strong>{{else}}This is a reminder{{/if}} about an approaching deadline:</p>
            
            <div class="event-card">
                <h2 class="event-title">{{eventTitle}}</h2>
                <div class="event-detail">
                    <span class="detail-label">Due Date:</span> {{eventDate}}
                </div>
                <div class="event-detail">
                    <span class="detail-label">Due Time:</span> {{eventTime}}
                </div>
                <div class="event-detail" style="margin-top: 15px;">
                    <span class="detail-label">Case:</span> {{caseTitle}}
                </div>
                <div class="event-detail">
                    <span class="detail-label">Case Number:</span> {{caseNumber}}
                </div>
            </div>
            
            <div class="reminder-time">
                <strong>Time Remaining:</strong> This deadline expires in {{minutesBefore}} minutes.
            </div>
            
            <p>Please ensure all required actions are completed before the deadline. {{#if highPriority}}This is marked as high priority and requires immediate attention.{{/if}}</p>
            
            <a href="https://app.***REMOVED***.com/calendar" class="action-button">View Deadline Details</a>
        </div>
        <div class="email-footer">
            <p>This is an automated reminder from the Bostoneo Solutions Case Management System.</p>
            <p>© 2023 Bostoneo Solutions. All rights reserved.</p>
        </div>
    </div>
</body>
</html>'
WHERE event_type = 'DEADLINE' AND is_default = TRUE;

-- Update Meeting Reminder template
UPDATE email_templates 
SET subject = 'Meeting Reminder: {{eventTitle}}',
    body_template = '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Meeting Reminder</title>
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
            background-color: #3577f1;
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
            border-left: 4px solid #3577f1;
            padding: 20px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .event-title {
            margin-top: 0;
            color: #3577f1;
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
            background-color: #3577f1;
            color: #ffffff !important;
            text-decoration: none;
            padding: 12px 30px;
            border-radius: 4px;
            font-weight: 600;
            margin: 20px 0;
        }
        .meeting-actions {
            margin-top: 25px;
            display: flex;
            gap: 15px;
        }
        .virtual-badge {
            display: inline-block;
            background-color: #299cdb;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: 500;
            font-size: 12px;
            margin-top: 10px;
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
                <img src="https://***REMOVED***.com/logo.png" alt="Bostoneo Solutions" height="40">
            </div>
            <h1>Meeting Reminder</h1>
        </div>
        <div class="email-body">
            <p>Hello {{userName}},</p>
            <p>This is a reminder about your upcoming meeting:</p>
            
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
                
                {{#if isVirtual}}
                <div class="virtual-badge">Virtual Meeting</div>
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
                <strong>Starting Soon:</strong> This meeting begins in {{minutesBefore}} minutes.
            </div>
            
            {{#if meetingAgenda}}
            <h3>Meeting Agenda</h3>
            <p>{{meetingAgenda}}</p>
            {{/if}}
            
            {{#if meetingLink}}
            <div class="meeting-actions">
                <a href="{{meetingLink}}" class="action-button">Join Meeting</a>
                <a href="https://app.***REMOVED***.com/calendar" style="color: #3577f1; text-decoration: none;">View in Calendar</a>
            </div>
            {{else}}
            <a href="https://app.***REMOVED***.com/calendar" class="action-button">View Meeting Details</a>
            {{/if}}
        </div>
        <div class="email-footer">
            <p>This is an automated reminder from the Bostoneo Solutions Case Management System.</p>
            <p>© 2023 Bostoneo Solutions. All rights reserved.</p>
        </div>
    </div>
</body>
</html>'
WHERE event_type = 'MEETING' AND is_default = TRUE;

-- Add more specialized templates for different event types
INSERT INTO email_templates (name, event_type, subject, body_template, description, is_default, is_active)
VALUES
('Court Date Reminder', 'COURT_DATE', 
 'Court Date Reminder: {{eventTitle}}', 
 '<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Court Date Reminder</title>
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
            background-color: #f06548;
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
            border-left: 4px solid #f06548;
            padding: 20px;
            margin: 20px 0;
            border-radius: 4px;
        }
        .event-title {
            margin-top: 0;
            color: #f06548;
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
            background-color: #fceeed;
            border: 1px solid #f8d7da;
            border-radius: 4px;
            padding: 10px;
            margin: 20px 0;
            color: #721c24;
            font-weight: 500;
        }
        .action-button {
            display: inline-block;
            background-color: #f06548;
            color: #ffffff !important;
            text-decoration: none;
            padding: 12px 30px;
            border-radius: 4px;
            font-weight: 600;
            margin: 20px 0;
        }
        .checklist {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 4px;
            margin-top: 20px;
        }
        .checklist h3 {
            margin-top: 0;
            color: #f06548;
        }
        .checklist ul {
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
                <img src="https://***REMOVED***.com/logo.png" alt="Bostoneo Solutions" height="40">
            </div>
            <h1>Court Date Reminder</h1>
        </div>
        <div class="email-body">
            <p>Hello {{userName}},</p>
            <p>This is a reminder of your upcoming court date. Please review the details below:</p>
            
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
                <div class="event-detail">
                    <span class="detail-label">Courtroom:</span> {{courtroom}}
                </div>
                <div class="event-detail" style="margin-top: 15px;">
                    <span class="detail-label">Case:</span> {{caseTitle}}
                </div>
                <div class="event-detail">
                    <span class="detail-label">Case Number:</span> {{caseNumber}}
                </div>
                <div class="event-detail">
                    <span class="detail-label">Judge:</span> {{judgeName}}
                </div>
            </div>
            
            <div class="reminder-time">
                <strong>Important:</strong> This court date is scheduled to begin in {{minutesBefore}} minutes.
            </div>
            
            <div class="checklist">
                <h3>Pre-Court Checklist</h3>
                <ul>
                    <li>Bring all relevant case documents</li>
                    <li>Arrive at least 30 minutes early</li>
                    <li>Dress professionally</li>
                    <li>Bring photo identification</li>
                    <li>Turn off your mobile phone before entering the courtroom</li>
                </ul>
            </div>
            
            <a href="https://app.***REMOVED***.com/calendar" class="action-button">View in Calendar</a>
        </div>
        <div class="email-footer">
            <p>This is an automated reminder from the Bostoneo Solutions Case Management System.</p>
            <p>© 2023 Bostoneo Solutions. All rights reserved.</p>
        </div>
    </div>
</body>
</html>', 
 'Specialized template for court date reminders', 
 TRUE, TRUE); 