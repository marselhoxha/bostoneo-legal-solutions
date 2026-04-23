-- V46: Fix caption templates for 8 states based on deep audit against real court rules
-- Fixes: hardcoded counties (IL, HI), wrong separator (CA, HI), missing structural
-- elements (PA colon column, GA/OH/MA bracket column, NJ CIVIL ACTION, MA COMMONWEALTH header)

-- Step 1: IL - Remove hardcoded Cook County, move case number to right side
UPDATE state_court_configurations
SET court_display_name = 'IN THE CIRCUIT COURT',
    caption_template_html = '<div align="center" style="text-align:center; margin-bottom:8px;"><strong>{{courtName}}</strong><br/><span>{{countyState}}</span></div><table width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr><td width="55%" valign="top" style="padding:2px 4px;">{{plaintiffName}},</td><td width="45%" valign="top" style="padding:2px 4px; text-align:right;"><strong>{{causeNumberLabel}} {{caseNumber}}</strong></td></tr><tr><td style="padding:2px 4px; padding-left:24px;"><em>{{plaintiffLabel}},</em></td><td style="padding:2px 4px;"></td></tr><tr><td style="padding:8px 4px;">v.</td><td style="padding:2px 4px;"></td></tr><tr><td valign="top" style="padding:2px 4px;">{{defendantName}},</td><td style="padding:2px 4px;"></td></tr><tr><td style="padding:2px 4px; padding-left:24px;"><em>{{defendantLabel}}.</em></td><td style="padding:2px 4px;"></td></tr></table>',
    updated_at = NOW()
WHERE state_code = 'IL';

-- Step 2: HI - Remove hardcoded First Circuit, fix vs. to v., use {{countyState}}
UPDATE state_court_configurations
SET court_display_name = 'IN THE CIRCUIT COURT',
    caption_template_html = '<div align="center" style="text-align:center; margin-bottom:8px;"><strong>{{courtName}}</strong><br/><span>{{countyState}}</span></div><div align="center" style="text-align:center; margin-bottom:12px;"><strong>{{causeNumberLabel}} {{caseNumber}}</strong></div><table width="85%" align="center" border="0" cellpadding="4" cellspacing="0" style="width:85%; margin-left:auto; margin-right:auto; border:none; border-collapse:collapse;"><tr><td width="45%" valign="top" style="border:none; padding:2px 4px;">{{plaintiffName}},</td><td width="10%" style="border:none;"></td><td width="45%" style="border:none;"></td></tr><tr><td style="border:none; padding:2px 4px; padding-left:24px;"><em>{{plaintiffLabel}},</em></td><td style="border:none;"></td><td style="border:none;"></td></tr><tr><td style="border:none; padding:8px 4px;">v.</td><td style="border:none;"></td><td style="border:none;"></td></tr><tr><td valign="top" style="border:none; padding:2px 4px;">{{defendantName}},</td><td style="border:none;"></td><td style="border:none;"></td></tr><tr><td style="border:none; padding:2px 4px; padding-left:24px;"><em>{{defendantLabel}}.</em></td><td style="border:none;"></td><td style="border:none;"></td></tr></table>',
    updated_at = NOW()
WHERE state_code = 'HI';

-- Step 3: CA - Fix vs. to v., move case number to right side per Rule 2.111
UPDATE state_court_configurations
SET caption_template_html = '<div align="center" style="text-align:center; margin-bottom:8px;"><strong>{{courtName}}</strong><br/><span>{{countyState}}</span></div><table width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr><td width="55%" valign="top" style="padding:2px 4px;">{{plaintiffName}},</td><td width="45%" valign="top" style="padding:2px 4px; text-align:right;"><strong>{{causeNumberLabel}} {{caseNumber}}</strong></td></tr><tr><td style="padding:2px 4px; padding-left:24px;"><em>{{plaintiffLabel}},</em></td><td style="padding:2px 4px;"></td></tr><tr><td style="padding:8px 4px;">v.</td><td style="padding:2px 4px;"></td></tr><tr><td valign="top" style="padding:2px 4px;">{{defendantName}},</td><td style="padding:2px 4px;"></td></tr><tr><td style="padding:2px 4px; padding-left:24px;"><em>{{defendantLabel}}.</em></td><td style="padding:2px 4px;"></td></tr></table>',
    updated_at = NOW()
WHERE state_code = 'CA';

-- Step 4: PA - Add colon separator column, case number right side, CIVIL ACTION (Pa.R.C.P. 1018)
UPDATE state_court_configurations
SET caption_separator = ':',
    caption_template_html = '<div align="center" style="text-align:center; margin-bottom:8px;"><strong>{{courtName}}</strong><br/><span>{{countyState}}</span></div><table width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr><td width="45%" valign="top" style="padding:2px 4px;">{{plaintiffName}},</td><td width="5%" valign="top" style="padding:2px 0; text-align:center;">:</td><td width="50%" valign="top" style="padding:2px 4px;"><strong>{{causeNumberLabel}} {{caseNumber}}</strong></td></tr><tr><td style="padding:2px 4px; padding-left:24px;"><em>{{plaintiffLabel}},</em></td><td style="padding:2px 0; text-align:center;">:</td><td style="padding:2px 4px;"></td></tr><tr><td style="padding:8px 4px;">v.</td><td style="padding:2px 0; text-align:center;">:</td><td style="padding:2px 4px;">CIVIL ACTION</td></tr><tr><td valign="top" style="padding:2px 4px;">{{defendantName}},</td><td style="padding:2px 0; text-align:center;">:</td><td style="padding:2px 4px;"></td></tr><tr><td style="padding:2px 4px; padding-left:24px;"><em>{{defendantLabel}}.</em></td><td style="padding:2px 0; text-align:center;">:</td><td style="padding:2px 4px;"></td></tr></table>',
    updated_at = NOW()
WHERE state_code = 'PA';

-- Step 5: GA - Add bracket column, case number right side (Uniform Superior Court Rule 36.3)
UPDATE state_court_configurations
SET caption_separator = ')',
    caption_template_html = '<div align="center" style="text-align:center; margin-bottom:8px;"><strong>{{courtName}}</strong><br/><span>{{countyState}}</span></div><table width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr><td width="45%" valign="top" style="padding:2px 4px;">{{plaintiffName}},</td><td width="5%" valign="top" style="padding:2px 0; text-align:center;">)</td><td width="50%" valign="top" style="padding:2px 4px;"></td></tr><tr><td style="padding:2px 4px; padding-left:24px;"><em>{{plaintiffLabel}},</em></td><td style="padding:2px 0; text-align:center;">)</td><td style="padding:2px 4px;"><strong>{{causeNumberLabel}} {{caseNumber}}</strong></td></tr><tr><td style="padding:8px 4px;">v.</td><td style="padding:2px 0; text-align:center;">)</td><td style="padding:2px 4px;"></td></tr><tr><td valign="top" style="padding:2px 4px;">{{defendantName}},</td><td style="padding:2px 0; text-align:center;">)</td><td style="padding:2px 4px;"></td></tr><tr><td style="padding:2px 4px; padding-left:24px;"><em>{{defendantLabel}}.</em></td><td style="padding:2px 0; text-align:center;">)</td><td style="padding:2px 4px;"></td></tr></table>',
    updated_at = NOW()
WHERE state_code = 'GA';

-- Step 6: OH - Add bracket column, case number right side, judge name (Ohio Civ. R. 10(A))
UPDATE state_court_configurations
SET caption_separator = ')',
    caption_template_html = '<div align="center" style="text-align:center; margin-bottom:8px;"><strong>{{courtName}}</strong><br/><span>{{countyState}}</span></div><table width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr><td width="45%" valign="top" style="padding:2px 4px;">{{plaintiffName}},</td><td width="5%" valign="top" style="padding:2px 0; text-align:center;">)</td><td width="50%" valign="top" style="padding:2px 4px;"></td></tr><tr><td style="padding:2px 4px; padding-left:24px;"><em>{{plaintiffLabel}},</em></td><td style="padding:2px 0; text-align:center;">)</td><td style="padding:2px 4px;"><strong>{{causeNumberLabel}} {{caseNumber}}</strong></td></tr><tr><td style="padding:8px 4px;">v.</td><td style="padding:2px 0; text-align:center;">)</td><td style="padding:2px 4px;">Judge {{judgeName}}</td></tr><tr><td valign="top" style="padding:2px 4px;">{{defendantName}},</td><td style="padding:2px 0; text-align:center;">)</td><td style="padding:2px 4px;"></td></tr><tr><td style="padding:2px 4px; padding-left:24px;"><em>{{defendantLabel}}.</em></td><td style="padding:2px 0; text-align:center;">)</td><td style="padding:2px 4px;"></td></tr></table>',
    updated_at = NOW()
WHERE state_code = 'OH';

-- Step 7: MA - Add COMMONWEALTH header, bracket column, docket to right side
UPDATE state_court_configurations
SET caption_separator = ')',
    caption_template_html = '<div align="center" style="text-align:center; margin-bottom:8px;"><strong>COMMONWEALTH OF MASSACHUSETTS</strong></div><table width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr><td width="45%" valign="top" style="padding:2px 4px;">{{plaintiffName}},</td><td width="5%" valign="top" style="padding:2px 0; text-align:center;">)</td><td width="50%" valign="top" style="padding:2px 4px;">{{courtName}}</td></tr><tr><td style="padding:2px 4px; padding-left:24px;"><em>{{plaintiffLabel}},</em></td><td style="padding:2px 0; text-align:center;">)</td><td style="padding:2px 4px;">{{countyState}}</td></tr><tr><td style="padding:8px 4px;">v.</td><td style="padding:2px 0; text-align:center;">)</td><td style="padding:2px 4px;"><strong>{{causeNumberLabel}} {{caseNumber}}</strong></td></tr><tr><td valign="top" style="padding:2px 4px;">{{defendantName}},</td><td style="padding:2px 0; text-align:center;">)</td><td style="padding:2px 4px;"></td></tr><tr><td style="padding:2px 4px; padding-left:24px;"><em>{{defendantLabel}}.</em></td><td style="padding:2px 0; text-align:center;">)</td><td style="padding:2px 4px;"></td></tr></table>',
    updated_at = NOW()
WHERE state_code = 'MA';

-- Step 8: NJ - Add CIVIL ACTION designation (NJ Rule 1:4-1)
UPDATE state_court_configurations
SET caption_template_html = '<div align="center" style="text-align:center; margin-bottom:8px;"><strong>{{courtName}}</strong><br/><span>LAW DIVISION, {{countyState}}</span></div><div align="center" style="text-align:center; margin-bottom:12px;"><strong>{{causeNumberLabel}} {{caseNumber}}</strong></div><table width="85%" align="center" border="0" cellpadding="4" cellspacing="0" style="width:85%; margin-left:auto; margin-right:auto; border:none; border-collapse:collapse;"><tr><td width="55%" valign="top" style="border:none; padding:2px 4px;">{{plaintiffName}},</td><td width="45%" valign="top" style="border:none; padding:2px 4px;">CIVIL ACTION</td></tr><tr><td style="border:none; padding:2px 4px; padding-left:24px;"><em>{{plaintiffLabel}},</em></td><td style="border:none; padding:2px 4px;"></td></tr><tr><td style="border:none; padding:8px 4px;">v.</td><td style="border:none; padding:2px 4px;"></td></tr><tr><td valign="top" style="border:none; padding:2px 4px;">{{defendantName}},</td><td style="border:none; padding:2px 4px;"></td></tr><tr><td style="border:none; padding:2px 4px; padding-left:24px;"><em>{{defendantLabel}}.</em></td><td style="border:none; padding:2px 4px;"></td></tr></table>',
    updated_at = NOW()
WHERE state_code = 'NJ';
