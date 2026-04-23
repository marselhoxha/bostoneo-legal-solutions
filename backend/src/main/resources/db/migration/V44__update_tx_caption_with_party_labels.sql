-- Add {{plaintiffLabel}} and {{defendantLabel}} placeholders to Texas caption template
UPDATE state_court_configurations
SET caption_template_html = '<table width="100%" border="0" cellpadding="0" cellspacing="0">
  <tr>
    <td colspan="3" align="center"><b>{{causeNumberLabel}} {{caseNumber}}</b></td>
  </tr>
  <tr>
    <td width="40%" valign="top"><b>{{plaintiffName}}</b><br/>{{plaintiffLabel}}</td>
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
    <td valign="top"><b>{{defendantName}}</b><br/>{{defendantLabel}}</td>
    <td align="center" valign="top"><b>&sect;</b></td>
    <td></td>
  </tr>
</table>',
    updated_at = NOW()
WHERE state_code = 'TX' AND court_level = 'DEFAULT';
