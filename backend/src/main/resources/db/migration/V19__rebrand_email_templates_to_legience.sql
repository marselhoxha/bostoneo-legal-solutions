-- Rebrand all email templates from Bostoneo/Boston EO to Legience
-- Templates 1-9: Replace "The Boston EO Solutions Team" with "The Legience Team"
-- Templates 10-14: Replace "The Bostoneo Solutions Team" with "The Legience Team"
-- Template 15: Replace all Bostoneo references (logo, footer, copyright, URL)

-- Update simple HTML templates (IDs 1-9) that have "The Boston EO Solutions Team"
UPDATE email_templates
SET body_template = REPLACE(body_template, 'The Boston EO Solutions Team', 'The Legience Team')
WHERE id IN (1, 2, 3, 7, 8, 9);

-- Update simple HTML templates (IDs 10-14) that have "The Bostoneo Solutions Team"
UPDATE email_templates
SET body_template = REPLACE(body_template, 'The Bostoneo Solutions Team', 'The Legience Team')
WHERE id IN (10, 11, 12, 13, 14);

-- Update rich CLIENT_MEETING template (ID 15) - multiple Bostoneo references
UPDATE email_templates
SET body_template = REPLACE(
    REPLACE(
        REPLACE(
            REPLACE(body_template,
                'alt="Bostoneo Solutions"', 'alt="Legience"'),
            'Bostoneo Solutions Case Management System', 'Legience Case Management System'),
        '© 2025 Bostoneo Solutions', '© 2025 Legience'),
    'https://bostoneo.com/logo.png', 'https://legience.com/logo.png')
WHERE id = 15;

-- Also update the app URL in template 15
UPDATE email_templates
SET body_template = REPLACE(body_template, 'https://app.bostoneo.com/', 'https://app.legience.com/')
WHERE id = 15;
