-- Seed/update system document request templates with styled HTML

-- Ensure unique constraint exists (may be missing on production)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'pi_document_request_templates_organization_id_template_code_key'
    ) THEN
        ALTER TABLE pi_document_request_templates ADD CONSTRAINT pi_document_request_templates_organization_id_template_code_key UNIQUE (organization_id, template_code);
    END IF;
END $$;

-- Delete existing system templates and re-insert with latest styled HTML
DELETE FROM pi_document_request_templates WHERE is_system = true AND organization_id IS NULL;

INSERT INTO pi_document_request_templates (organization_id, template_code, template_name, document_type, recipient_type, email_subject, email_body, sms_body, is_system, is_active)
VALUES
(NULL, E'MEDICAL_RECORDS_REQUEST', E'Medical Records Request', E'MEDICAL_RECORDS', E'MEDICAL_PROVIDER',
 E'Medical Records Request - {{clientName}} | DOA: {{accidentDate}}',
 E'<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: ''Segoe UI'', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 650px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header -->
        <tr>
            <td style="background: linear-gradient(135deg, #405189 0%, #2c3e6e 100%); padding: 30px 40px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Medical Records Request</h1>
            </td>
        </tr>

        <!-- Body -->
        <tr>
            <td style="padding: 40px;">
                <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">Dear Records Department,</p>

                <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">We are writing to request complete medical records for the following patient in connection with a legal matter:</p>

                <!-- Patient Info Box -->
                <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 8px; margin-bottom: 25px;">
                    <tr>
                        <td style="padding: 25px;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #e9ecef;">
                                        <span style="color: #6c757d; font-size: 14px; display: inline-block; width: 140px;">Patient Name:</span>
                                        <span style="color: #333333; font-size: 16px; font-weight: 600;">{{clientName}}</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #e9ecef;">
                                        <span style="color: #6c757d; font-size: 14px; display: inline-block; width: 140px;">Date of Birth:</span>
                                        <span style="color: #333333; font-size: 16px; font-weight: 600;">{{clientDob}}</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0;">
                                        <span style="color: #6c757d; font-size: 14px; display: inline-block; width: 140px;">Dates of Treatment:</span>
                                        <span style="color: #333333; font-size: 16px; font-weight: 600;">{{treatmentDates}}</span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>

                <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 15px;"><strong>Please include the following:</strong></p>

                <ul style="color: #333333; font-size: 15px; line-height: 1.8; margin: 0 0 25px; padding-left: 20px;">
                    <li>All office visit notes and progress notes</li>
                    <li>Diagnostic imaging reports and films (X-rays, MRI, CT scans)</li>
                    <li>Laboratory results</li>
                    <li>Treatment records and therapy notes</li>
                    <li>Billing records and itemized statements</li>
                    <li>Discharge summaries (if applicable)</li>
                </ul>

                <!-- Delivery Box -->
                <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #e8f4fd; border-left: 4px solid #0d6efd; border-radius: 4px; margin-bottom: 25px;">
                    <tr>
                        <td style="padding: 20px;">
                            <p style="color: #0d6efd; font-size: 14px; font-weight: 600; margin: 0 0 10px;">📋 Please Send Records To:</p>
                            <p style="color: #333333; font-size: 15px; line-height: 1.6; margin: 0;">
                                <strong>Fax:</strong> {{firmFax}}<br>
                                <strong>Email:</strong> {{firmEmail}}
                            </p>
                        </td>
                    </tr>
                </table>

                <p style="color: #333333; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
                    <strong>Enclosed:</strong> HIPAA-compliant Authorization for Release of Medical Records
                </p>

                <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 10px;">Thank you for your prompt attention to this matter.</p>

                <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 25px 0 0;">
                    Sincerely,<br><br>
                    <strong>{{senderName}}</strong><br>
                    {{firmName}}<br>
                    {{firmPhone}}
                </p>
            </td>
        </tr>

        <!-- Footer -->
        <tr>
            <td style="background-color: #f8f9fa; padding: 25px 40px; border-top: 1px solid #e9ecef;">
                <p style="color: #6c757d; font-size: 12px; line-height: 1.5; margin: 0; text-align: center;">
                    This email was sent by {{firmName}}.<br>
                    Please do not reply directly to this email. For questions, contact us at {{firmPhone}}.
                </p>
            </td>
        </tr>
    </table>
</body>
</html>',
 E'Medical records request sent for {{clientName}}. Please check your email for details. - {{firmName}}',
 true, true),
(NULL, E'MEDICAL_BILLS_REQUEST', E'Medical Bills Request', E'MEDICAL_BILLS', E'BILLING_DEPT',
 E'Itemized Bill Request - {{clientName}} | Account #{{accountNumber}}',
 E'<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: ''Segoe UI'', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 650px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header -->
        <tr>
            <td style="background: linear-gradient(135deg, #0ab39c 0%, #078a76 100%); padding: 30px 40px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Itemized Bill Request</h1>
            </td>
        </tr>

        <!-- Body -->
        <tr>
            <td style="padding: 40px;">
                <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">Dear Billing Department,</p>

                <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">We are writing to request itemized billing statements for the following patient:</p>

                <!-- Patient Info Box -->
                <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 8px; margin-bottom: 25px;">
                    <tr>
                        <td style="padding: 25px;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #e9ecef;">
                                        <span style="color: #6c757d; font-size: 14px; display: inline-block; width: 140px;">Patient Name:</span>
                                        <span style="color: #333333; font-size: 16px; font-weight: 600;">{{clientName}}</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #e9ecef;">
                                        <span style="color: #6c757d; font-size: 14px; display: inline-block; width: 140px;">Date of Birth:</span>
                                        <span style="color: #333333; font-size: 16px; font-weight: 600;">{{clientDob}}</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #e9ecef;">
                                        <span style="color: #6c757d; font-size: 14px; display: inline-block; width: 140px;">Dates of Service:</span>
                                        <span style="color: #333333; font-size: 16px; font-weight: 600;">{{treatmentDates}}</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0;">
                                        <span style="color: #6c757d; font-size: 14px; display: inline-block; width: 140px;">Account Number:</span>
                                        <span style="color: #333333; font-size: 16px; font-weight: 600;">{{accountNumber}}</span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>

                <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 15px;"><strong>Please include the following:</strong></p>

                <ul style="color: #333333; font-size: 15px; line-height: 1.8; margin: 0 0 25px; padding-left: 20px;">
                    <li>Complete itemized bill with CPT/procedure codes</li>
                    <li>Payment history and adjustments</li>
                    <li>Outstanding balance information</li>
                    <li>Any lien or subrogation information</li>
                </ul>

                <!-- Delivery Box -->
                <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #e6f7f5; border-left: 4px solid #0ab39c; border-radius: 4px; margin-bottom: 25px;">
                    <tr>
                        <td style="padding: 20px;">
                            <p style="color: #0ab39c; font-size: 14px; font-weight: 600; margin: 0 0 10px;">📋 Please Send Bills To:</p>
                            <p style="color: #333333; font-size: 15px; line-height: 1.6; margin: 0;">
                                <strong>Fax:</strong> {{firmFax}}<br>
                                <strong>Email:</strong> {{firmEmail}}
                            </p>
                        </td>
                    </tr>
                </table>

                <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 10px;">Thank you for your assistance.</p>

                <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 25px 0 0;">
                    Sincerely,<br><br>
                    <strong>{{senderName}}</strong><br>
                    {{firmName}}
                </p>
            </td>
        </tr>

        <!-- Footer -->
        <tr>
            <td style="background-color: #f8f9fa; padding: 25px 40px; border-top: 1px solid #e9ecef;">
                <p style="color: #6c757d; font-size: 12px; line-height: 1.5; margin: 0; text-align: center;">
                    This email was sent by {{firmName}}.<br>
                    Please do not reply directly to this email.
                </p>
            </td>
        </tr>
    </table>
</body>
</html>',
 E'Billing records request sent for {{clientName}}. Please check your email. - {{firmName}}',
 true, true),
(NULL, E'INSURANCE_POLICY_REQUEST', E'Insurance Policy Limits Request', E'INSURANCE', E'INSURANCE_ADJUSTER',
 E'Policy Limits Disclosure Request - Claim #{{claimNumber}} | {{clientName}} v. {{defendantName}}',
 E'<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: ''Segoe UI'', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 650px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header -->
        <tr>
            <td style="background: linear-gradient(135deg, #f7b84b 0%, #e5a93a 100%); padding: 30px 40px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Policy Limits Disclosure Request</h1>
            </td>
        </tr>

        <!-- Body -->
        <tr>
            <td style="padding: 40px;">
                <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">Dear {{adjusterName}},</p>

                <!-- Claim Info Box -->
                <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fff8e6; border: 1px solid #f7b84b; border-radius: 8px; margin-bottom: 25px;">
                    <tr>
                        <td style="padding: 25px;">
                            <p style="color: #b8860b; font-size: 14px; font-weight: 600; margin: 0 0 15px; text-transform: uppercase; letter-spacing: 1px;">Claim Information</p>
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #ffe5a0;">
                                        <span style="color: #6c757d; font-size: 14px; display: inline-block; width: 120px;">Re:</span>
                                        <span style="color: #333333; font-size: 16px; font-weight: 600;">{{clientName}} v. {{defendantName}}</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; border-bottom: 1px solid #ffe5a0;">
                                        <span style="color: #6c757d; font-size: 14px; display: inline-block; width: 120px;">Claim Number:</span>
                                        <span style="color: #333333; font-size: 16px; font-weight: 600;">{{claimNumber}}</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0;">
                                        <span style="color: #6c757d; font-size: 14px; display: inline-block; width: 120px;">Date of Loss:</span>
                                        <span style="color: #333333; font-size: 16px; font-weight: 600;">{{accidentDate}}</span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>

                <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">
                    I represent <strong>{{clientName}}</strong> in connection with the above-referenced claim.
                </p>

                <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 15px;">
                    Pursuant to your duty of good faith, please provide the following:
                </p>

                <ol style="color: #333333; font-size: 15px; line-height: 1.8; margin: 0 0 25px; padding-left: 20px;">
                    <li>The declarations page showing all applicable policy limits</li>
                    <li>Written confirmation of coverage for this claim</li>
                    <li>Any policy exclusions that may apply to this matter</li>
                    <li>Information regarding any other policies that may provide coverage</li>
                </ol>

                <!-- Important Notice Box -->
                <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-left: 4px solid #f7b84b; border-radius: 4px; margin-bottom: 25px;">
                    <tr>
                        <td style="padding: 20px;">
                            <p style="color: #333333; font-size: 14px; line-height: 1.6; margin: 0;">
                                <strong>⏰ Please respond within 30 days.</strong><br>
                                Failure to disclose policy limits may be considered evidence of bad faith.
                            </p>
                        </td>
                    </tr>
                </table>

                <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 10px;">Thank you for your prompt attention to this matter.</p>

                <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 25px 0 0;">
                    Sincerely,<br><br>
                    <strong>{{senderName}}</strong><br>
                    {{firmName}}<br>
                    {{firmAddress}}<br>
                    {{firmPhone}}
                </p>
            </td>
        </tr>

        <!-- Footer -->
        <tr>
            <td style="background-color: #f8f9fa; padding: 25px 40px; border-top: 1px solid #e9ecef;">
                <p style="color: #6c757d; font-size: 12px; line-height: 1.5; margin: 0; text-align: center;">
                    This email was sent by {{firmName}}.<br>
                    For questions, contact us at {{firmPhone}}.
                </p>
            </td>
        </tr>
    </table>
</body>
</html>',
 E'Policy limits request sent for Claim #{{claimNumber}}. Please check your email. - {{firmName}}',
 true, true),
(NULL, E'WAGE_DOCUMENTATION_REQUEST', E'Wage Documentation Request', E'WAGE_DOCUMENTATION', E'EMPLOYER_HR',
 E'Employment Verification & Wage Documentation Request - {{clientName}}',
 E'<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: ''Segoe UI'', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 650px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header -->
        <tr>
            <td style="background: linear-gradient(135deg, #299cdb 0%, #1f7ab5 100%); padding: 30px 40px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Employment Verification Request</h1>
            </td>
        </tr>

        <!-- Body -->
        <tr>
            <td style="padding: 40px;">
                <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">Dear Human Resources Department,</p>

                <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">
                    We represent <strong>{{clientName}}</strong> in connection with a personal injury matter. We are requesting employment and wage documentation as authorized by the enclosed release.
                </p>

                <!-- Employee Info Box -->
                <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #e8f4fc; border-radius: 8px; margin-bottom: 25px;">
                    <tr>
                        <td style="padding: 25px;">
                            <p style="color: #299cdb; font-size: 14px; font-weight: 600; margin: 0 0 15px; text-transform: uppercase; letter-spacing: 1px;">Employee Information</p>
                            <p style="color: #333333; font-size: 16px; font-weight: 600; margin: 0;">{{clientName}}</p>
                        </td>
                    </tr>
                </table>

                <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 15px;"><strong>Please provide the following documentation:</strong></p>

                <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 25px;">
                    <tr>
                        <td style="padding: 15px; background-color: #f8f9fa; border-radius: 8px 8px 0 0;">
                            <p style="color: #299cdb; font-size: 14px; font-weight: 600; margin: 0;">1. Employment Verification Letter</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 15px; background-color: #ffffff; border: 1px solid #e9ecef; border-top: none;">
                            <ul style="color: #333333; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                                <li>Dates of employment</li>
                                <li>Job title and description of duties</li>
                                <li>Regular work hours and schedule</li>
                                <li>Rate of pay (hourly/salary)</li>
                            </ul>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 15px; background-color: #f8f9fa;">
                            <p style="color: #299cdb; font-size: 14px; font-weight: 600; margin: 0;">2. Wage Documentation</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 15px; background-color: #ffffff; border: 1px solid #e9ecef; border-top: none; border-radius: 0 0 8px 8px;">
                            <ul style="color: #333333; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                                <li>Pay stubs for the past 12 months</li>
                                <li>Record of any missed work due to injury</li>
                                <li>Documentation of lost overtime/bonus opportunities</li>
                                <li>W-2 or 1099 forms for the past year</li>
                            </ul>
                        </td>
                    </tr>
                </table>

                <!-- Delivery Box -->
                <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #e8f4fc; border-left: 4px solid #299cdb; border-radius: 4px; margin-bottom: 25px;">
                    <tr>
                        <td style="padding: 20px;">
                            <p style="color: #299cdb; font-size: 14px; font-weight: 600; margin: 0 0 10px;">📋 Please Send Documentation To:</p>
                            <p style="color: #333333; font-size: 15px; line-height: 1.6; margin: 0;">
                                <strong>Fax:</strong> {{firmFax}}<br>
                                <strong>Email:</strong> {{firmEmail}}
                            </p>
                        </td>
                    </tr>
                </table>

                <p style="color: #333333; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
                    <strong>Enclosed:</strong> Signed authorization from {{clientName}}
                </p>

                <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 10px;">Thank you for your cooperation.</p>

                <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 25px 0 0;">
                    Sincerely,<br><br>
                    <strong>{{senderName}}</strong><br>
                    {{firmName}}
                </p>
            </td>
        </tr>

        <!-- Footer -->
        <tr>
            <td style="background-color: #f8f9fa; padding: 25px 40px; border-top: 1px solid #e9ecef;">
                <p style="color: #6c757d; font-size: 12px; line-height: 1.5; margin: 0; text-align: center;">
                    This email was sent by {{firmName}}.<br>
                    Please do not reply directly to this email.
                </p>
            </td>
        </tr>
    </table>
</body>
</html>',
 E'Wage documentation request sent to your employer. Please check your email. - {{firmName}}',
 true, true),
(NULL, E'POLICE_REPORT_REQUEST', E'Police Report Request', E'POLICE_REPORT', E'POLICE_DEPT',
 E'Police Report Request - Report #{{reportNumber}} | Date: {{accidentDate}}',
 E'<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: ''Segoe UI'', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 650px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header -->
        <tr>
            <td style="background: linear-gradient(135deg, #6c757d 0%, #495057 100%); padding: 30px 40px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Police Report Request</h1>
            </td>
        </tr>

        <!-- Body -->
        <tr>
            <td style="padding: 40px;">
                <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">To: Records Department</p>

                <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">
                    Please provide a copy of the accident/incident report for the following:
                </p>

                <!-- Report Info Box -->
                <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 8px; margin-bottom: 25px;">
                    <tr>
                        <td style="padding: 25px;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="padding: 10px 0; border-bottom: 1px solid #e9ecef;">
                                        <span style="color: #6c757d; font-size: 14px; display: inline-block; width: 140px;">Report Number:</span>
                                        <span style="color: #333333; font-size: 16px; font-weight: 600;">{{reportNumber}}</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px 0; border-bottom: 1px solid #e9ecef;">
                                        <span style="color: #6c757d; font-size: 14px; display: inline-block; width: 140px;">Date of Incident:</span>
                                        <span style="color: #333333; font-size: 16px; font-weight: 600;">{{accidentDate}}</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px 0; border-bottom: 1px solid #e9ecef;">
                                        <span style="color: #6c757d; font-size: 14px; display: inline-block; width: 140px;">Location:</span>
                                        <span style="color: #333333; font-size: 16px; font-weight: 600;">{{accidentLocation}}</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px 0;">
                                        <span style="color: #6c757d; font-size: 14px; display: inline-block; width: 140px;">Party Involved:</span>
                                        <span style="color: #333333; font-size: 16px; font-weight: 600;">{{clientName}}</span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>

                <!-- Payment Box -->
                <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #e8f5e9; border-left: 4px solid #4caf50; border-radius: 4px; margin-bottom: 25px;">
                    <tr>
                        <td style="padding: 20px;">
                            <p style="color: #2e7d32; font-size: 14px; font-weight: 600; margin: 0 0 10px;">💵 Payment Information</p>
                            <p style="color: #333333; font-size: 15px; line-height: 1.6; margin: 0;">
                                Fee of <strong>${{reportFee}}</strong> enclosed / will follow upon invoice
                            </p>
                        </td>
                    </tr>
                </table>

                <!-- Delivery Box -->
                <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-left: 4px solid #6c757d; border-radius: 4px; margin-bottom: 25px;">
                    <tr>
                        <td style="padding: 20px;">
                            <p style="color: #495057; font-size: 14px; font-weight: 600; margin: 0 0 10px;">📋 Please Mail Report To:</p>
                            <p style="color: #333333; font-size: 15px; line-height: 1.6; margin: 0;">
                                {{firmName}}<br>
                                {{firmAddress}}
                            </p>
                            <p style="color: #333333; font-size: 15px; line-height: 1.6; margin: 15px 0 0;">
                                <strong>Or Fax:</strong> {{firmFax}}
                            </p>
                        </td>
                    </tr>
                </table>

                <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 10px;">Thank you for your assistance.</p>

                <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 25px 0 0;">
                    Sincerely,<br><br>
                    <strong>{{senderName}}</strong><br>
                    {{firmName}}
                </p>
            </td>
        </tr>

        <!-- Footer -->
        <tr>
            <td style="background-color: #f8f9fa; padding: 25px 40px; border-top: 1px solid #e9ecef;">
                <p style="color: #6c757d; font-size: 12px; line-height: 1.5; margin: 0; text-align: center;">
                    This email was sent by {{firmName}}.
                </p>
            </td>
        </tr>
    </table>
</body>
</html>',
 NULL,
 true, true),
(NULL, E'CLIENT_DOCUMENT_REQUEST', E'Client Document Request', E'PHOTOGRAPHS', E'CLIENT',
 E'Action Required: Documents Needed for Your Case #{{caseNumber}}',
 E'<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: ''Segoe UI'', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 650px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header -->
        <tr>
            <td style="background: linear-gradient(135deg, #405189 0%, #2c3e6e 100%); padding: 30px 40px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Documents Needed</h1>
                <p style="color: rgba(255,255,255,0.8); margin: 10px 0 0; font-size: 14px;">Case #{{caseNumber}}</p>
            </td>
        </tr>

        <!-- Body -->
        <tr>
            <td style="padding: 40px;">
                <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">Dear {{clientName}},</p>

                <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">
                    To continue progressing your case, we need the following documents from you:
                </p>

                <!-- Documents Needed Box -->
                <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; margin-bottom: 25px;">
                    <tr>
                        <td style="padding: 25px;">
                            <p style="color: #856404; font-size: 14px; font-weight: 600; margin: 0 0 15px;">📄 DOCUMENTS REQUESTED:</p>
                            <p style="color: #333333; font-size: 15px; line-height: 1.8; margin: 0;">{{requestedDocuments}}</p>
                        </td>
                    </tr>
                </table>

                <!-- How to Send Box -->
                <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #e8f4fd; border-radius: 8px; margin-bottom: 25px;">
                    <tr>
                        <td style="padding: 25px;">
                            <p style="color: #0d6efd; font-size: 14px; font-weight: 600; margin: 0 0 15px;">How to Send Your Documents:</p>
                            <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                    <td style="padding: 10px 0; border-bottom: 1px solid #cce5ff;">
                                        <span style="color: #0d6efd; font-size: 18px; display: inline-block; width: 30px; vertical-align: middle;">🌐</span>
                                        <span style="color: #333333; font-size: 15px; vertical-align: middle;"><strong>Client Portal:</strong> Log in to your account and upload documents securely</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px 0;">
                                        <span style="color: #0d6efd; font-size: 18px; display: inline-block; width: 30px; vertical-align: middle;">📧</span>
                                        <span style="color: #333333; font-size: 15px; vertical-align: middle;"><strong>Email:</strong> {{firmEmail}}</span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>

                <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">
                    If you have any questions or need assistance gathering these documents, please don''t hesitate to call us at <strong>{{firmPhone}}</strong>.
                </p>

                <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 10px;">Thank you for your cooperation.</p>

                <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 25px 0 0;">
                    Best regards,<br><br>
                    <strong>{{senderName}}</strong><br>
                    {{firmName}}
                </p>
            </td>
        </tr>

        <!-- Footer -->
        <tr>
            <td style="background-color: #f8f9fa; padding: 25px 40px; border-top: 1px solid #e9ecef;">
                <p style="color: #6c757d; font-size: 12px; line-height: 1.5; margin: 0; text-align: center;">
                    This email was sent by {{firmName}} regarding your case.<br>
                    If you have questions, call us at {{firmPhone}}.
                </p>
            </td>
        </tr>
    </table>
</body>
</html>',
 E'Hi {{clientName}}, we need additional documents for your case. Please check your email or call us at {{firmPhone}}. - {{firmName}}',
 true, true),
(NULL, E'WITNESS_STATEMENT_REQUEST', E'Witness Statement Request', E'WITNESS', E'WITNESS',
 E'Witness Statement Request - Incident on {{accidentDate}}',
 E'<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: ''Segoe UI'', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 650px; margin: 0 auto; background-color: #ffffff;">
        <!-- Header -->
        <tr>
            <td style="background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%); padding: 30px 40px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Witness Statement Request</h1>
            </td>
        </tr>

        <!-- Body -->
        <tr>
            <td style="padding: 40px;">
                <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">Dear {{witnessName}},</p>

                <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">
                    You have been identified as a potential witness to an incident that occurred on <strong>{{accidentDate}}</strong> at <strong>{{accidentLocation}}</strong>.
                </p>

                <!-- Info Box -->
                <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3e8ff; border-left: 4px solid #7c3aed; border-radius: 4px; margin-bottom: 25px;">
                    <tr>
                        <td style="padding: 20px;">
                            <p style="color: #333333; font-size: 15px; line-height: 1.6; margin: 0;">
                                We represent <strong>{{clientName}}</strong> who was involved in this incident. Your account of what you witnessed would be very valuable to our case.
                            </p>
                        </td>
                    </tr>
                </table>

                <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">
                    Would you be willing to provide a brief written statement or speak with us about what you observed? Your cooperation would be greatly appreciated.
                </p>

                <!-- Contact Box -->
                <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 8px; margin-bottom: 25px;">
                    <tr>
                        <td style="padding: 25px; text-align: center;">
                            <p style="color: #6c757d; font-size: 14px; font-weight: 600; margin: 0 0 15px;">PLEASE CONTACT US:</p>
                            <p style="color: #333333; font-size: 18px; margin: 0 0 10px;">
                                <strong>📞 {{firmPhone}}</strong>
                            </p>
                            <p style="color: #333333; font-size: 16px; margin: 0;">
                                <strong>📧 {{firmEmail}}</strong>
                            </p>
                        </td>
                    </tr>
                </table>

                <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 0 0 10px;">Thank you for your time and consideration.</p>

                <p style="color: #333333; font-size: 16px; line-height: 1.6; margin: 25px 0 0;">
                    Sincerely,<br><br>
                    <strong>{{senderName}}</strong><br>
                    {{firmName}}
                </p>
            </td>
        </tr>

        <!-- Footer -->
        <tr>
            <td style="background-color: #f8f9fa; padding: 25px 40px; border-top: 1px solid #e9ecef;">
                <p style="color: #6c757d; font-size: 12px; line-height: 1.5; margin: 0; text-align: center;">
                    This email was sent by {{firmName}}.<br>
                    Your participation is voluntary and greatly appreciated.
                </p>
            </td>
        </tr>
    </table>
</body>
</html>',
 E'Hi, this is {{firmName}}. You may have witnessed an incident on {{accidentDate}}. Would you be willing to share what you saw? Please call {{firmPhone}}.',
 true, true);