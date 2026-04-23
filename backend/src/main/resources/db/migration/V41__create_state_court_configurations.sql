-- ============================================================
-- V41: State Court Configurations
-- Replaces hardcoded Texas-only caption/formatting logic with
-- a data-driven table supporting all 50 US states.
-- ============================================================

CREATE TABLE IF NOT EXISTS state_court_configurations (
    id                    BIGSERIAL PRIMARY KEY,
    state_code            VARCHAR(2) NOT NULL,
    state_name            VARCHAR(50) NOT NULL,
    court_level           VARCHAR(50) NOT NULL,
    court_display_name    VARCHAR(200) NOT NULL,
    caption_template_html TEXT NOT NULL,
    caption_separator     VARCHAR(10) DEFAULT '',
    cause_number_label    VARCHAR(30) DEFAULT 'Case No.',
    is_commonwealth       BOOLEAN DEFAULT FALSE,
    party_label_style     VARCHAR(20) DEFAULT 'STANDARD',
    preamble_text         TEXT,
    comes_now_format      TEXT,
    prayer_format         TEXT,
    bar_number_prefix     VARCHAR(30) DEFAULT 'Bar No.',
    citation_reporters    TEXT,
    procedural_rules_ref  TEXT,
    constitutional_refs   TEXT,
    priority_rank         INTEGER DEFAULT 999,
    is_active             BOOLEAN DEFAULT TRUE,
    is_verified           BOOLEAN DEFAULT FALSE,
    verified_by           VARCHAR(100),
    verified_at           TIMESTAMP,
    notes                 TEXT,
    created_at            TIMESTAMP DEFAULT NOW(),
    updated_at            TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_state_court_level UNIQUE (state_code, court_level)
);

CREATE INDEX IF NOT EXISTS idx_scc_state_code ON state_court_configurations(state_code);
CREATE INDEX IF NOT EXISTS idx_scc_active ON state_court_configurations(is_active) WHERE is_active = TRUE;


-- ============================================================
-- Seed Data: 8 Priority States
-- ============================================================

-- ── TEXAS (DEFAULT) ─────────────────────────────────────────
INSERT INTO state_court_configurations (
    state_code, state_name, court_level, court_display_name,
    caption_template_html, caption_separator, cause_number_label,
    is_commonwealth, party_label_style, preamble_text,
    comes_now_format, prayer_format, bar_number_prefix,
    citation_reporters, procedural_rules_ref, constitutional_refs,
    priority_rank, is_active, is_verified, verified_by, verified_at
) VALUES (
    'TX', 'Texas', 'DEFAULT', 'IN THE DISTRICT COURT',
    -- Caption HTML (matches existing caption-texas.html exactly)
    '<table width="100%" border="0" cellpadding="0" cellspacing="0">
  <tr>
    <td colspan="3" align="center"><b>{{causeNumberLabel}} {{caseNumber}}</b></td>
  </tr>
  <tr>
    <td width="40%" valign="top"><b>{{plaintiffName}}</b></td>
    <td width="10%" align="center" valign="top"><b>&sect;</b></td>
    <td width="50%" valign="top"><b>{{courtName}}</b></td>
  </tr>
  <tr>
    <td></td>
    <td align="center"><b>&sect;</b></td>
    <td></td>
  </tr>
  <tr>
    <td valign="top"><b>vs.</b></td>
    <td align="center" valign="top"><b>&sect;</b></td>
    <td valign="top"><b>{{countyState}}</b></td>
  </tr>
  <tr>
    <td></td>
    <td align="center"><b>&sect;</b></td>
    <td></td>
  </tr>
  <tr>
    <td valign="top"><b>{{defendantName}}</b></td>
    <td align="center" valign="top"><b>&sect;</b></td>
    <td></td>
  </tr>
</table>',
    '§', 'CAUSE NO.', FALSE, 'STANDARD',
    'TO THE HONORABLE JUDGE OF SAID COURT:',
    'COMES NOW the {partyRole}, {partyName}, by and through undersigned counsel, and respectfully moves this Honorable Court to {relief}, and in support thereof would show the Court as follows:',
    'WHEREFORE, PREMISES CONSIDERED, the {partyRole} respectfully moves that this Honorable Court:',
    'SB#',
    '["S.W.3d", "S.W.2d", "Tex. Crim. App.", "Tex. App."]',
    '{"civil": "Tex. R. Civ. P.", "criminal": "Tex. Code Crim. Proc.", "evidence": "Tex. R. Evid.", "appellate": "Tex. R. App. P."}',
    '{"state": "Tex. Const. art. I", "federal": "U.S. Const. amend."}',
    1, TRUE, TRUE, 'system-migration', NOW()
);

-- ── MASSACHUSETTS (DEFAULT) ────────────────────────────────
INSERT INTO state_court_configurations (
    state_code, state_name, court_level, court_display_name,
    caption_template_html, caption_separator, cause_number_label,
    is_commonwealth, party_label_style, preamble_text,
    comes_now_format, prayer_format, bar_number_prefix,
    citation_reporters, procedural_rules_ref, constitutional_refs,
    priority_rank, is_active, is_verified, verified_by, verified_at
) VALUES (
    'MA', 'Massachusetts', 'DEFAULT', 'SUPERIOR COURT DEPARTMENT OF THE TRIAL COURT',
    '<div align="center" style="text-align:center; margin-bottom:12px;">
  <strong>{{causeNumberLabel}} {{caseNumber}}</strong>
</div>
<table width="85%" align="center" border="0" cellpadding="4" cellspacing="0"
       style="width:85%; margin-left:auto; margin-right:auto; border:none; border-collapse:collapse;">
  <tr>
    <td width="45%" valign="top" style="width:45%; border:none; padding:2px 4px; vertical-align:top;">{{plaintiffName}},</td>
    <td width="10%" valign="top" style="width:10%; border:none; padding:2px 4px; vertical-align:top;"></td>
    <td width="45%" valign="top" style="width:45%; border:none; padding:2px 4px; vertical-align:top;">{{courtName}}</td>
  </tr>
  <tr>
    <td style="border:none; padding:2px 4px; padding-left:24px;"><em>{{plaintiffLabel}},</em></td>
    <td style="border:none; padding:2px 4px;"></td>
    <td style="border:none; padding:2px 4px;">{{countyState}}</td>
  </tr>
  <tr>
    <td style="border:none; padding:8px 4px;">v.</td>
    <td style="border:none; padding:2px 4px;"></td>
    <td style="border:none; padding:2px 4px;"></td>
  </tr>
  <tr>
    <td valign="top" style="border:none; padding:2px 4px; vertical-align:top;">{{defendantName}},</td>
    <td style="border:none; padding:2px 4px;"></td>
    <td style="border:none; padding:2px 4px;"></td>
  </tr>
  <tr>
    <td style="border:none; padding:2px 4px; padding-left:24px;"><em>{{defendantLabel}}.</em></td>
    <td style="border:none; padding:2px 4px;"></td>
    <td style="border:none; padding:2px 4px;"></td>
  </tr>
</table>',
    '', 'Docket No.', TRUE, 'COMMONWEALTH',
    'NOW COMES the {partyRole}, {partyName}, by and through undersigned counsel, and respectfully moves this Honorable Court as follows:',
    'NOW COMES the {partyRole}, {partyName}, by and through undersigned counsel, and respectfully moves this Honorable Court to {relief}, and in support thereof states as follows:',
    'WHEREFORE, the {partyRole} respectfully requests that this Honorable Court:',
    'BBO#',
    '["N.E.3d", "N.E.2d", "Mass. App. Ct.", "Mass."]',
    '{"civil": "Mass. R. Civ. P.", "criminal": "Mass. R. Crim. P.", "evidence": "Mass. G. Evid.", "appellate": "Mass. R. App. P."}',
    '{"state": "Mass. Const. pt. 1, art.", "federal": "U.S. Const. amend."}',
    2, TRUE, TRUE, 'system-migration', NOW()
);

-- ── NEW YORK (DEFAULT) ─────────────────────────────────────
INSERT INTO state_court_configurations (
    state_code, state_name, court_level, court_display_name,
    caption_template_html, caption_separator, cause_number_label,
    is_commonwealth, party_label_style, preamble_text,
    comes_now_format, prayer_format, bar_number_prefix,
    citation_reporters, procedural_rules_ref, constitutional_refs,
    priority_rank, is_active, is_verified
) VALUES (
    'NY', 'New York', 'DEFAULT', 'SUPREME COURT OF THE STATE OF NEW YORK',
    '<div align="center" style="text-align:center; margin-bottom:8px;">
  <strong>{{courtName}}</strong><br/>
  <span>{{countyState}}</span>
</div>
<table width="100%" border="0" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
  <tr>
    <td width="60%" valign="top" style="border-bottom:1px solid #000; padding:6px 4px;">
      {{plaintiffName}},<br/>
      <span style="padding-left:24px;"><em>{{plaintiffLabel}},</em></span>
    </td>
    <td width="40%" valign="top" rowspan="3" style="padding:6px 4px; vertical-align:middle; text-align:right;">
      <strong>{{causeNumberLabel}} {{caseNumber}}</strong>
    </td>
  </tr>
  <tr>
    <td style="padding:4px; text-align:center; border-bottom:1px solid #000;">
      <strong>- against -</strong>
    </td>
  </tr>
  <tr>
    <td valign="top" style="padding:6px 4px;">
      {{defendantName}},<br/>
      <span style="padding-left:24px;"><em>{{defendantLabel}}.</em></span>
    </td>
  </tr>
</table>',
    '', 'Index No.', FALSE, 'PEOPLE',
    NULL,
    '{partyName}, by and through undersigned counsel, respectfully submits this {documentType} and states as follows:',
    'WHEREFORE, {partyRole} respectfully requests that this Court:',
    'Bar No.',
    '["N.Y.3d", "N.Y.2d", "A.D.3d", "A.D.2d", "N.Y.S.3d", "N.Y.S.2d", "Misc. 3d"]',
    '{"civil": "N.Y. C.P.L.R.", "criminal": "N.Y. Crim. Proc. Law", "evidence": "N.Y. C.P.L.R. art. 45", "appellate": "N.Y. C.P.L.R. art. 55"}',
    '{"state": "N.Y. Const. art. I", "federal": "U.S. Const. amend."}',
    3, TRUE, FALSE
);

-- ── CALIFORNIA (DEFAULT) ───────────────────────────────────
INSERT INTO state_court_configurations (
    state_code, state_name, court_level, court_display_name,
    caption_template_html, caption_separator, cause_number_label,
    is_commonwealth, party_label_style, preamble_text,
    comes_now_format, prayer_format, bar_number_prefix,
    citation_reporters, procedural_rules_ref, constitutional_refs,
    priority_rank, is_active, is_verified
) VALUES (
    'CA', 'California', 'DEFAULT', 'SUPERIOR COURT OF THE STATE OF CALIFORNIA',
    '<div align="center" style="text-align:center; margin-bottom:8px;">
  <strong>{{courtName}}</strong><br/>
  <span>{{countyState}}</span>
</div>
<div align="center" style="text-align:center; margin-bottom:12px;">
  <strong>{{causeNumberLabel}} {{caseNumber}}</strong>
</div>
<table width="85%" align="center" border="0" cellpadding="4" cellspacing="0"
       style="width:85%; margin-left:auto; margin-right:auto; border:none; border-collapse:collapse;">
  <tr>
    <td width="45%" valign="top" style="width:45%; border:none; padding:2px 4px; vertical-align:top;">{{plaintiffName}},</td>
    <td width="10%" valign="top" style="width:10%; border:none; padding:2px 4px; vertical-align:top;"></td>
    <td width="45%" valign="top" style="width:45%; border:none; padding:2px 4px; vertical-align:top;"></td>
  </tr>
  <tr>
    <td style="border:none; padding:2px 4px; padding-left:24px;"><em>{{plaintiffLabel}},</em></td>
    <td style="border:none; padding:2px 4px;"></td>
    <td style="border:none; padding:2px 4px;"></td>
  </tr>
  <tr>
    <td style="border:none; padding:8px 4px;">vs.</td>
    <td style="border:none; padding:2px 4px;"></td>
    <td style="border:none; padding:2px 4px;"></td>
  </tr>
  <tr>
    <td valign="top" style="border:none; padding:2px 4px; vertical-align:top;">{{defendantName}},</td>
    <td style="border:none; padding:2px 4px;"></td>
    <td style="border:none; padding:2px 4px;"></td>
  </tr>
  <tr>
    <td style="border:none; padding:2px 4px; padding-left:24px;"><em>{{defendantLabel}}.</em></td>
    <td style="border:none; padding:2px 4px;"></td>
    <td style="border:none; padding:2px 4px;"></td>
  </tr>
</table>',
    '', 'Case No.', FALSE, 'PEOPLE',
    NULL,
    '{partyName}, by and through undersigned counsel, hereby moves this Court for an order {relief}, and states as follows:',
    'WHEREFORE, {partyRole} respectfully requests that this Court:',
    'SBN',
    '["Cal.5th", "Cal.4th", "Cal.App.5th", "Cal.App.4th", "Cal.Rptr.3d"]',
    '{"civil": "Cal. Code Civ. Proc.", "criminal": "Cal. Penal Code", "evidence": "Cal. Evid. Code", "appellate": "Cal. Rules of Court"}',
    '{"state": "Cal. Const. art. I", "federal": "U.S. Const. amend."}',
    4, TRUE, FALSE
);

-- ── FLORIDA (DEFAULT) ──────────────────────────────────────
INSERT INTO state_court_configurations (
    state_code, state_name, court_level, court_display_name,
    caption_template_html, caption_separator, cause_number_label,
    is_commonwealth, party_label_style, preamble_text,
    comes_now_format, prayer_format, bar_number_prefix,
    citation_reporters, procedural_rules_ref, constitutional_refs,
    priority_rank, is_active, is_verified
) VALUES (
    'FL', 'Florida', 'DEFAULT', 'IN THE CIRCUIT COURT OF THE JUDICIAL CIRCUIT',
    '<div align="center" style="text-align:center; margin-bottom:8px;">
  <strong>{{courtName}}</strong><br/>
  <span>IN AND FOR {{countyState}}</span>
</div>
<div align="center" style="text-align:center; margin-bottom:12px;">
  <strong>{{causeNumberLabel}} {{caseNumber}}</strong>
</div>
<table width="85%" align="center" border="0" cellpadding="4" cellspacing="0"
       style="width:85%; margin-left:auto; margin-right:auto; border:none; border-collapse:collapse;">
  <tr>
    <td width="45%" valign="top" style="width:45%; border:none; padding:2px 4px; vertical-align:top;">{{plaintiffName}},</td>
    <td width="10%" valign="top" style="width:10%; border:none; padding:2px 4px; vertical-align:top;"></td>
    <td width="45%" valign="top" style="width:45%; border:none; padding:2px 4px; vertical-align:top;"></td>
  </tr>
  <tr>
    <td style="border:none; padding:2px 4px; padding-left:24px;"><em>{{plaintiffLabel}},</em></td>
    <td style="border:none; padding:2px 4px;"></td>
    <td style="border:none; padding:2px 4px;"></td>
  </tr>
  <tr>
    <td style="border:none; padding:8px 4px;">v.</td>
    <td style="border:none; padding:2px 4px;"></td>
    <td style="border:none; padding:2px 4px;"></td>
  </tr>
  <tr>
    <td valign="top" style="border:none; padding:2px 4px; vertical-align:top;">{{defendantName}},</td>
    <td style="border:none; padding:2px 4px;"></td>
    <td style="border:none; padding:2px 4px;"></td>
  </tr>
  <tr>
    <td style="border:none; padding:2px 4px; padding-left:24px;"><em>{{defendantLabel}}.</em></td>
    <td style="border:none; padding:2px 4px;"></td>
    <td style="border:none; padding:2px 4px;"></td>
  </tr>
</table>',
    '', 'Case No.', FALSE, 'STANDARD',
    NULL,
    'COMES NOW the {partyRole}, {partyName}, by and through undersigned counsel, and hereby moves this Honorable Court for {relief}, and in support thereof states:',
    'WHEREFORE, the {partyRole} respectfully requests this Honorable Court to:',
    'Fla. Bar No.',
    '["So. 3d", "So. 2d", "Fla.", "Fla. L. Weekly"]',
    '{"civil": "Fla. R. Civ. P.", "criminal": "Fla. R. Crim. P.", "evidence": "Fla. Stat. ch. 90", "appellate": "Fla. R. App. P."}',
    '{"state": "Fla. Const. art. I", "federal": "U.S. Const. amend."}',
    5, TRUE, FALSE
);

-- ── ILLINOIS (DEFAULT) ─────────────────────────────────────
INSERT INTO state_court_configurations (
    state_code, state_name, court_level, court_display_name,
    caption_template_html, caption_separator, cause_number_label,
    is_commonwealth, party_label_style, preamble_text,
    comes_now_format, prayer_format, bar_number_prefix,
    citation_reporters, procedural_rules_ref, constitutional_refs,
    priority_rank, is_active, is_verified
) VALUES (
    'IL', 'Illinois', 'DEFAULT', 'IN THE CIRCUIT COURT OF COOK COUNTY',
    '<div align="center" style="text-align:center; margin-bottom:8px;">
  <strong>{{courtName}}</strong><br/>
  <span>{{countyState}}</span>
</div>
<div align="center" style="text-align:center; margin-bottom:12px;">
  <strong>{{causeNumberLabel}} {{caseNumber}}</strong>
</div>
<table width="85%" align="center" border="0" cellpadding="4" cellspacing="0"
       style="width:85%; margin-left:auto; margin-right:auto; border:none; border-collapse:collapse;">
  <tr>
    <td width="45%" valign="top" style="width:45%; border:none; padding:2px 4px; vertical-align:top;">{{plaintiffName}},</td>
    <td width="10%" valign="top" style="width:10%; border:none; padding:2px 4px; vertical-align:top;"></td>
    <td width="45%" valign="top" style="width:45%; border:none; padding:2px 4px; vertical-align:top;"></td>
  </tr>
  <tr>
    <td style="border:none; padding:2px 4px; padding-left:24px;"><em>{{plaintiffLabel}},</em></td>
    <td style="border:none; padding:2px 4px;"></td>
    <td style="border:none; padding:2px 4px;"></td>
  </tr>
  <tr>
    <td style="border:none; padding:8px 4px;">v.</td>
    <td style="border:none; padding:2px 4px;"></td>
    <td style="border:none; padding:2px 4px;"></td>
  </tr>
  <tr>
    <td valign="top" style="border:none; padding:2px 4px; vertical-align:top;">{{defendantName}},</td>
    <td style="border:none; padding:2px 4px;"></td>
    <td style="border:none; padding:2px 4px;"></td>
  </tr>
  <tr>
    <td style="border:none; padding:2px 4px; padding-left:24px;"><em>{{defendantLabel}}.</em></td>
    <td style="border:none; padding:2px 4px;"></td>
    <td style="border:none; padding:2px 4px;"></td>
  </tr>
</table>',
    '', 'Case No.', FALSE, 'PEOPLE',
    'NOW COMES the {partyRole}, {partyName}, by and through undersigned counsel, and respectfully moves this Honorable Court as follows:',
    'NOW COMES the {partyRole}, {partyName}, by {partyName}''s attorney, and respectfully moves this Honorable Court to {relief}, and in support thereof states as follows:',
    'WHEREFORE, the {partyRole} respectfully requests that this Honorable Court:',
    'ARDC No.',
    '["N.E.3d", "N.E.2d", "Ill. 2d", "Ill. App. 3d", "Ill. Dec."]',
    '{"civil": "735 ILCS 5/ (Code of Civil Procedure)", "criminal": "725 ILCS 5/ (Code of Criminal Procedure)", "evidence": "Ill. R. Evid.", "appellate": "Ill. Sup. Ct. R."}',
    '{"state": "Ill. Const. art. I", "federal": "U.S. Const. amend."}',
    6, TRUE, FALSE
);

-- ── PENNSYLVANIA (DEFAULT) ─────────────────────────────────
INSERT INTO state_court_configurations (
    state_code, state_name, court_level, court_display_name,
    caption_template_html, caption_separator, cause_number_label,
    is_commonwealth, party_label_style, preamble_text,
    comes_now_format, prayer_format, bar_number_prefix,
    citation_reporters, procedural_rules_ref, constitutional_refs,
    priority_rank, is_active, is_verified
) VALUES (
    'PA', 'Pennsylvania', 'DEFAULT', 'IN THE COURT OF COMMON PLEAS',
    '<div align="center" style="text-align:center; margin-bottom:8px;">
  <strong>{{courtName}}</strong><br/>
  <span>{{countyState}}</span>
</div>
<div align="center" style="text-align:center; margin-bottom:12px;">
  <strong>{{causeNumberLabel}} {{caseNumber}}</strong>
</div>
<table width="85%" align="center" border="0" cellpadding="4" cellspacing="0"
       style="width:85%; margin-left:auto; margin-right:auto; border:none; border-collapse:collapse;">
  <tr>
    <td width="45%" valign="top" style="width:45%; border:none; padding:2px 4px; vertical-align:top;">{{plaintiffName}},</td>
    <td width="10%" valign="top" style="width:10%; border:none; padding:2px 4px; vertical-align:top;"></td>
    <td width="45%" valign="top" style="width:45%; border:none; padding:2px 4px; vertical-align:top;"></td>
  </tr>
  <tr>
    <td style="border:none; padding:2px 4px; padding-left:24px;"><em>{{plaintiffLabel}},</em></td>
    <td style="border:none; padding:2px 4px;"></td>
    <td style="border:none; padding:2px 4px;"></td>
  </tr>
  <tr>
    <td style="border:none; padding:8px 4px;">v.</td>
    <td style="border:none; padding:2px 4px;"></td>
    <td style="border:none; padding:2px 4px;"></td>
  </tr>
  <tr>
    <td valign="top" style="border:none; padding:2px 4px; vertical-align:top;">{{defendantName}},</td>
    <td style="border:none; padding:2px 4px;"></td>
    <td style="border:none; padding:2px 4px;"></td>
  </tr>
  <tr>
    <td style="border:none; padding:2px 4px; padding-left:24px;"><em>{{defendantLabel}}.</em></td>
    <td style="border:none; padding:2px 4px;"></td>
    <td style="border:none; padding:2px 4px;"></td>
  </tr>
</table>',
    '', 'Docket No.', TRUE, 'COMMONWEALTH',
    NULL,
    '{partyName}, by and through undersigned counsel, respectfully moves this Honorable Court for {relief}, and in support thereof avers as follows:',
    'WHEREFORE, {partyRole} respectfully requests that this Honorable Court:',
    'Attorney I.D. No.',
    '["A.3d", "A.2d", "Pa.", "Pa. Super.", "Pa. Commw."]',
    '{"civil": "Pa. R.C.P.", "criminal": "Pa. R.Crim.P.", "evidence": "Pa. R.E.", "appellate": "Pa. R.A.P."}',
    '{"state": "Pa. Const. art. I", "federal": "U.S. Const. amend."}',
    7, TRUE, FALSE
);

-- ── FEDERAL (DEFAULT) ──────────────────────────────────────
INSERT INTO state_court_configurations (
    state_code, state_name, court_level, court_display_name,
    caption_template_html, caption_separator, cause_number_label,
    is_commonwealth, party_label_style, preamble_text,
    comes_now_format, prayer_format, bar_number_prefix,
    citation_reporters, procedural_rules_ref, constitutional_refs,
    priority_rank, is_active, is_verified
) VALUES (
    'US', 'Federal', 'DEFAULT', 'UNITED STATES DISTRICT COURT',
    '<div align="center" style="text-align:center; margin-bottom:8px;">
  <strong>{{courtName}}</strong><br/>
  <span>{{countyState}}</span>
</div>
<div align="center" style="text-align:center; margin-bottom:12px;">
  <strong>{{causeNumberLabel}} {{caseNumber}}</strong>
</div>
<table width="85%" align="center" border="0" cellpadding="4" cellspacing="0"
       style="width:85%; margin-left:auto; margin-right:auto; border:none; border-collapse:collapse;">
  <tr>
    <td width="45%" valign="top" style="width:45%; border:none; padding:2px 4px; vertical-align:top;">{{plaintiffName}},</td>
    <td width="10%" valign="top" style="width:10%; border:none; padding:2px 4px; vertical-align:top;"></td>
    <td width="45%" valign="top" style="width:45%; border:none; padding:2px 4px; vertical-align:top;"></td>
  </tr>
  <tr>
    <td style="border:none; padding:2px 4px; padding-left:24px;"><em>{{plaintiffLabel}},</em></td>
    <td style="border:none; padding:2px 4px;"></td>
    <td style="border:none; padding:2px 4px;"></td>
  </tr>
  <tr>
    <td style="border:none; padding:8px 4px;">v.</td>
    <td style="border:none; padding:2px 4px;"></td>
    <td style="border:none; padding:2px 4px;"></td>
  </tr>
  <tr>
    <td valign="top" style="border:none; padding:2px 4px; vertical-align:top;">{{defendantName}},</td>
    <td style="border:none; padding:2px 4px;"></td>
    <td style="border:none; padding:2px 4px;"></td>
  </tr>
  <tr>
    <td style="border:none; padding:2px 4px; padding-left:24px;"><em>{{defendantLabel}}.</em></td>
    <td style="border:none; padding:2px 4px;"></td>
    <td style="border:none; padding:2px 4px;"></td>
  </tr>
</table>',
    '', 'Civil Action No.', FALSE, 'STANDARD',
    NULL,
    '{partyName}, by and through undersigned counsel, respectfully moves this Court pursuant to {rule} for an order {relief}, and in support thereof states as follows:',
    'WHEREFORE, {partyRole} respectfully requests that this Court:',
    'Bar No.',
    '["U.S.", "S. Ct.", "F.4th", "F.3d", "F. Supp. 3d", "F. Supp. 2d"]',
    '{"civil": "Fed. R. Civ. P.", "criminal": "Fed. R. Crim. P.", "evidence": "Fed. R. Evid.", "appellate": "Fed. R. App. P."}',
    '{"federal": "U.S. Const. amend."}',
    8, TRUE, FALSE
);
