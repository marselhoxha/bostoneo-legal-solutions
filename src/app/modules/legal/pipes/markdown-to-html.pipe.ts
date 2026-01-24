import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ChartSecurityService } from '../services/chart-security.service';

@Pipe({
  name: 'markdownToHtml',
  standalone: true
})
export class MarkdownToHtmlPipe implements PipeTransform {
  private chartSecurity = inject(ChartSecurityService);

  constructor(private sanitizer: DomSanitizer) {}

  transform(value: string): SafeHtml {
    if (!value) {
      return '';
    }

    // STEP 1: Process checkmark citations BEFORE markdown conversion (while still markdown syntax)
    let markdown = this.processCheckmarkCitations(value);

    // STEP 2: Convert markdown to HTML
    let html = this.convertMarkdownToHtml(markdown);

    // STEP 3: CREATE LINKS DIRECTLY (emergency fix - backend not injecting URLs)
    html = this.createCitationLinks(html);

    // STEP 4: Apply legal highlighting to the HTML output (NOT checkmarks - already processed)
    html = this.highlightLegalTerms(html);

    // IMPORTANT: Use bypassSecurityTrustHtml to allow our custom HTML/CSS classes
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  /**
   * Process checkmark citations BEFORE markdown-to-HTML conversion
   * This ensures the checkmark and link stay together in one HTML element
   */
  private processCheckmarkCitations(markdown: string): string {
    // Match ✓ followed by markdown link: ✓ [citation](url) or ✓ [citation - View →](url)
    // Handles BOTH old format (no " - View →") and new format (with " - View →")
    // This runs BEFORE markdown conversion, so we're matching markdown syntax
    return markdown.replace(/✓\s*\[([^\]]+?)\]\(([^)]+)\)/gi,
      (_match, linkText, url) => {
        // Remove " - View →" suffix if present (for consistency)
        const cleanText = linkText.replace(/\s*-\s*View\s*→\s*$/i, '').trim();
        // Create complete HTML badge with link inside
        // Return HTML directly (will NOT be processed by markdown converter since it's already HTML)
        return `<span class="citation-verified">✓ <a href="${url}" target="_blank" rel="noopener noreferrer">${cleanText}</a></span>`;
      });
  }

  /**
   * EMERGENCY FIX: Create links directly in frontend since backend isn't injecting them
   * This runs AFTER markdown conversion but BEFORE other highlighting
   * Creates SPECIFIC URLs with section/rule numbers when possible
   */
  private createCitationLinks(html: string): string {
    // IRC citations - extract section number for specific URL with subsection anchor
    // Supports optional checkmark prefix
    // Fixed: Added \s* before parentheses to handle spaces, use [^)]+ to capture to closing )
    html = html.replace(/(?:✓\s*)?\bIRC\s*§\s*(\d+)(?:\s*\([^)]+\))*(?![<\w])/gi,
      (match, section) => {
        let url = `https://www.law.cornell.edu/uscode/text/26/${section}`;
        // Extract first subsection: (h), (h)(3), etc. → h
        const firstSubsection = match.match(/\(([a-zA-Z0-9]+)\)/);
        if (firstSubsection) {
          url += `#${firstSubsection[1]}`;
        }
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="legal-link">${match}</a>`;
      });

    // Treasury Regulations - use Cornell CFR with specific regulation number
    // Supports "Treas. Reg.", "Treasury Reg.", "Treas. Regulation", "Treasury Regulation"
    // Supports optional checkmark prefix
    // Fixed: Added \s* before parentheses, use [^)]+ to capture to closing )
    html = html.replace(/(?:✓\s*)?\b(?:Treas(?:ury)?\.?\s*(?:Reg\.|Regulation))\s*§\s*[\d.]+[A-Za-z]*(?:-[\d]+[A-Za-z]*)*(?:\s*\([^)]+\))*(?![<\w])/gi,
      (match) => {
        // Extract base regulation number (everything up to first opening parenthesis or end)
        const regMatch = match.match(/§\s*([\d.]+[A-Za-z]*(?:-[\d]+[A-Za-z]*)*)/);
        const regNumber = regMatch ? regMatch[1].trim() : '';
        return `<a href="https://www.law.cornell.edu/cfr/text/26/${regNumber}" target="_blank" rel="noopener noreferrer" class="legal-link">${match}</a>`;
      });

    // Tax Court Rules - no specific URL pattern available
    // Supports optional checkmark prefix
    // Fixed: Added \s* before parentheses, use [^)]+ to capture to closing )
    html = html.replace(/(?:✓\s*)?\bTax Court Rule\s*\d+(?:\s*\([^)]+\))*(?![<\w])/gi,
      (match) => {
        return `<a href="https://www.ustaxcourt.gov/rules.html" target="_blank" rel="noopener noreferrer" class="legal-link">${match}</a>`;
      });

    // M.G.L. citations - extract chapter and section for specific URL
    // Supports optional checkmark prefix
    // Fixed: Added \s* before parentheses, use [^)]+ to capture to closing )
    html = html.replace(/(?:✓\s*)?\bM\.G\.L\.\s*c\.\s*(\d+[AB]?)(?:,?\s*§\s*(\w+(?:\s*\([^)]+\))*))?(?![<\w])/gi,
      (match, chapter, section) => {
        if (section) {
          // Both chapter and section - create full URL
          return `<a href="https://malegislature.gov/Laws/GeneralLaws/Chapter${chapter}/Section${section}" target="_blank" rel="noopener noreferrer" class="legal-link">${match}</a>`;
        } else {
          // Just chapter - link to chapter page
          return `<a href="https://malegislature.gov/Laws/GeneralLaws/Chapter${chapter}" target="_blank" rel="noopener noreferrer" class="legal-link">${match}</a>`;
        }
      });

    // Mass. R. Crim. P. - link to specific rule pages with descriptive titles
    // Supports optional checkmark prefix
    // Fixed: Added \s* before parentheses, use [^)]+ to capture to closing )
    html = html.replace(/(?:✓\s*)?\bMass\.\s*R\.\s*Crim\.\s*P\.(?:\s*(\d+(?:\.\d+)?)(?:\s*\([^)]+\))*)?(?![<\w])/gi,
      (match, ruleNum) => {
        // Mapping of common rule numbers to their URL slugs
        const ruleUrlMap: {[key: string]: string} = {
          '3': 'criminal-procedure-rule-3-the-complaint',
          '4': 'criminal-procedure-rule-4-arrest-warrant-or-summons-on-a-complaint',
          '7': 'criminal-procedure-rule-7-other-pleas',
          '12': 'criminal-procedure-rule-12-pleas-and-pretrial-motions',
          '14': 'criminal-procedure-rule-14-pretrial-discovery-from-the-prosecution',
          '14.1': 'criminal-procedure-rule-141-pretrial-reciprocal-discovery-from-the-defense',
          '14.2': 'criminal-procedure-rule-142-pretrial-discovery-procedures',
          '17': 'criminal-procedure-rule-17-subpoena',
          '30': 'criminal-procedure-rule-30-instructions',
          '36': 'criminal-procedure-rule-36-stay-of-execution-bail-after-conviction'
        };

        if (ruleNum && ruleUrlMap[ruleNum]) {
          return `<a href="https://www.mass.gov/rules-of-criminal-procedure/${ruleUrlMap[ruleNum]}" target="_blank" rel="noopener noreferrer" class="legal-link">${match}</a>`;
        } else {
          // Fall back to general page for unmapped rules
          return `<a href="https://www.mass.gov/law-library/massachusetts-rules-of-criminal-procedure" target="_blank" rel="noopener noreferrer" class="legal-link">${match}</a>`;
        }
      });

    // Mass. R. Civ. P. - link to general page (specific URLs require rule titles we don't have)
    // Supports optional checkmark prefix
    // Fixed: Added \s* before parentheses, use [^)]+ to capture to closing )
    html = html.replace(/(?:✓\s*)?\bMass\.\s*R\.\s*Civ\.\s*P\.(?:\s*\d+(?:\s*\([^)]+\))*)?(?![<\w])/gi,
      (match) => {
        return `<a href="https://www.mass.gov/law-library/massachusetts-rules-of-civil-procedure" target="_blank" rel="noopener noreferrer" class="legal-link">${match}</a>`;
      });

    // BMC Standing Orders - general page (no specific URLs available)
    // Supports optional checkmark prefix
    html = html.replace(/(?:✓\s*)?\bBMC\s+Standing\s+Order\s+\d+-\d+(?![<\w])/gi,
      (match) => {
        return `<a href="https://www.mass.gov/guides/massachusetts-rules-of-court-and-standing-orders" target="_blank" rel="noopener noreferrer" class="legal-link">${match}</a>`;
      });

    // BMC Local Rules - general page (no specific URLs available)
    // Supports optional checkmark prefix
    html = html.replace(/(?:✓\s*)?\bBMC\s+Local\s+Rule\s+\d+(?![<\w])/gi,
      (match) => {
        return `<a href="https://www.mass.gov/guides/massachusetts-rules-of-court-and-standing-orders" target="_blank" rel="noopener noreferrer" class="legal-link">${match}</a>`;
      });

    // Fed. R. Civ. P. - extract rule number for specific URL
    // Supports optional checkmark prefix
    // Fixed: Added \s* before parentheses, use [^)]+ to capture to closing )
    html = html.replace(/(?:✓\s*)?\bFed\.\s*R\.\s*Civ\.\s*P\.\s*(\d+)(?:\s*\([^)]+\))*(?![<\w])/gi,
      (match, rule) => {
        return `<a href="https://www.law.cornell.edu/rules/frcp/rule_${rule}" target="_blank" rel="noopener noreferrer" class="legal-link">${match}</a>`;
      });

    // Fed. R. Crim. P. - extract rule number for specific URL
    // Supports optional checkmark prefix
    // Fixed: Added \s* before parentheses, use [^)]+ to capture to closing )
    html = html.replace(/(?:✓\s*)?\bFed\.\s*R\.\s*Crim\.\s*P\.\s*(\d+)(?:\s*\([^)]+\))*(?![<\w])/gi,
      (match, rule) => {
        return `<a href="https://www.law.cornell.edu/rules/frcrmp/rule_${rule}" target="_blank" rel="noopener noreferrer" class="legal-link">${match}</a>`;
      });

    return html;
  }

  private highlightLegalTerms(html: string): string {
    // Apply highlighting to text content only, skipping HTML tags
    let result = html;

    // Split by HTML tags to process only text content
    const parts = result.split(/(<[^>]*>)/);

    for (let i = 0; i < parts.length; i++) {
      // Skip HTML tags (they start with <)
      if (parts[i].startsWith('<')) continue;

      let text = parts[i];

      // NOTE: Checkmark badges are now processed BEFORE markdown conversion
      // in the processCheckmarkCitations() method above
      // This section only handles other legal term highlighting

      // Warning assumption badges (⚠️ **Assumption**:)
      text = text.replace(/⚠️\s*\*\*Assumption\*\*:/g,
        `<span class="assumption-badge">⚠️ <strong>Assumption</strong>:</span>`);

      // Helper function to generate meter HTML
      const createMeter = (level: string, label: string): string => {
        const meterClass = level.toLowerCase();
        return `<span class="severity-meter meter-${meterClass}"><span class="meter-bars"><span class="bar"></span><span class="bar"></span><span class="bar"></span><span class="bar"></span><span class="bar"></span><span class="bar"></span></span><span class="meter-label">${label}</span></span>`;
      };

      // Emoji pattern: Match warning emoji (with or without variation selector)
      // ⚠️ is U+26A0 + U+FE0F, ⚠ is just U+26A0
      const warnEmoji = '(?:⚠️|⚠)';

      // Severity meters WITH ⚠️ prefix - match full phrases like "HIGH SEVERITY"
      // Order matters: match longer phrases first (HIGH SEVERITY before HIGH)
      text = text.replace(new RegExp(warnEmoji + '\\s*(CRITICAL)\\s*:?', 'gi'),
        (_match, label) => createMeter('critical', label.toUpperCase()));
      text = text.replace(new RegExp(warnEmoji + '\\s*(HIGH\\s+SEVERITY)\\s*:?', 'gi'),
        (_match, label) => createMeter('critical', label.toUpperCase().replace(/\s+/g, ' ')));
      text = text.replace(new RegExp(warnEmoji + '\\s*(MAJOR)\\s*:?', 'gi'),
        (_match, label) => createMeter('high', label.toUpperCase()));
      text = text.replace(new RegExp(warnEmoji + '\\s*(HIGH)\\s*:?', 'gi'),
        (_match, label) => createMeter('high', label.toUpperCase()));
      text = text.replace(new RegExp(warnEmoji + '\\s*(MODERATE\\s+SEVERITY)\\s*:?', 'gi'),
        (_match, label) => createMeter('medium', label.toUpperCase().replace(/\s+/g, ' ')));
      text = text.replace(new RegExp(warnEmoji + '\\s*(MEDIUM\\s+SEVERITY)\\s*:?', 'gi'),
        (_match, label) => createMeter('medium', label.toUpperCase().replace(/\s+/g, ' ')));
      text = text.replace(new RegExp(warnEmoji + '\\s*(MODERATE|MEDIUM)\\s*:?', 'gi'),
        (_match, label) => createMeter('medium', label.toUpperCase()));
      text = text.replace(new RegExp(warnEmoji + '\\s*(LOW\\s+SEVERITY)\\s*:?', 'gi'),
        (_match, label) => createMeter('low', label.toUpperCase().replace(/\s+/g, ' ')));
      text = text.replace(new RegExp(warnEmoji + '\\s*(LOW|MINOR)\\s*:?', 'gi'),
        (_match, label) => createMeter('low', label.toUpperCase()));

      // Severity meters WITHOUT ⚠️ - standalone at line start
      // Match full phrases first, then single words
      // HIGH SEVERITY / MODERATE SEVERITY / LOW SEVERITY at line start
      text = text.replace(/^(HIGH\s+SEVERITY)\s*:?\s*/gm,
        (_match, label) => createMeter('critical', label.toUpperCase().replace(/\s+/g, ' ')) + ' ');
      text = text.replace(/^(MODERATE\s+SEVERITY|MEDIUM\s+SEVERITY)\s*:?\s*/gm,
        (_match, label) => createMeter('medium', label.toUpperCase().replace(/\s+/g, ' ')) + ' ');
      text = text.replace(/^(LOW\s+SEVERITY)\s*:?\s*/gm,
        (_match, label) => createMeter('low', label.toUpperCase().replace(/\s+/g, ' ')) + ' ');

      // Compound severity phrases at line start (HIGH RISK, MODERATE RISK, etc.) - match these BEFORE single words
      text = text.replace(/^(CRITICAL|HIGH|MODERATE|MEDIUM|LOW)\s+(RISK|PRIORITY|EXPOSURE|IMPACT)\s*[-—:]/gm,
        (_match, level, suffix) => {
          const levelLower = level.toLowerCase();
          const meterLevel = levelLower === 'critical' ? 'critical' :
                            levelLower === 'high' ? 'high' :
                            (levelLower === 'medium' || levelLower === 'moderate') ? 'medium' : 'low';
          return createMeter(meterLevel, `${level.toUpperCase()} ${suffix.toUpperCase()}`) + ' ';
        });

      // Single severity words at line start (only when NOT followed by SEVERITY or RISK)
      text = text.replace(/^(CRITICAL)\s*:?\s*(?!SEVERITY|RISK)/gm,
        (_match, label) => createMeter('critical', label) + ' ');
      text = text.replace(/^(MAJOR)\s*:?\s*(?!SEVERITY|RISK)/gm,
        (_match, label) => createMeter('high', label) + ' ');
      text = text.replace(/^(HIGH)\s*:?\s*(?!SEVERITY|RISK)/gm,
        (_match, label) => createMeter('high', label) + ' ');
      text = text.replace(/^(MODERATE|MEDIUM)\s*:?\s*(?!SEVERITY|RISK)/gm,
        (_match, label) => createMeter('medium', label) + ' ');
      text = text.replace(/^(LOW|MINOR)\s*:?\s*(?!SEVERITY|RISK)/gm,
        (_match, label) => createMeter('low', label) + ' ');

      // Generic severity pattern: ⚠️ [SEVERITY]:
      text = text.replace(new RegExp(warnEmoji + '\\s*\\[SEVERITY\\]:?', 'gi'),
        createMeter('medium', 'SEVERITY'));

      // Bracketed severity patterns: ⚠️ [CATEGORY - LEVEL]: (VALIDITY, THREAT LEVEL, STRENGTH, IMPORTANCE, VIABILITY, etc.)
      // Match pattern: ⚠️ [WORD(S) - HIGH/MEDIUM/LOW/CRITICAL]:
      text = text.replace(new RegExp(warnEmoji + '\\s*\\[([A-Z\\s]+)\\s*-\\s*(CRITICAL|HIGH|MEDIUM|MODERATE|LOW)\\]:?', 'gi'),
        (_match, category, level) => {
          const levelLower = level.toLowerCase();
          const meterLevel = levelLower === 'critical' ? 'critical' :
                            levelLower === 'high' ? 'high' :
                            (levelLower === 'medium' || levelLower === 'moderate') ? 'medium' : 'low';
          return createMeter(meterLevel, `${level.toUpperCase()} ${category.trim().toUpperCase()}`);
        });

      // Urgency meters: ⚠️ [URGENCY - X]:
      text = text.replace(new RegExp(warnEmoji + '\\s*\\[URGENCY\\s*-\\s*(IMMEDIATE|HIGH|STANDARD)\\]:?', 'gi'),
        (_match, level) => {
          const meterLevel = level.toLowerCase() === 'immediate' ? 'critical' :
                            level.toLowerCase() === 'high' ? 'high' : 'medium';
          return createMeter(meterLevel, level);
        });

      // Compound severity phrases WITH emoji: ⚠️ HIGH RISK, ⚠️ MODERATE RISK, etc.
      text = text.replace(new RegExp(warnEmoji + '\\s*(CRITICAL|HIGH|MODERATE|MEDIUM|LOW)\\s+(RISK|PRIORITY|EXPOSURE|IMPACT)\\s*:?', 'gi'),
        (_match, level, suffix) => {
          const levelLower = level.toLowerCase();
          const meterLevel = levelLower === 'critical' ? 'critical' :
                            levelLower === 'high' ? 'high' :
                            (levelLower === 'medium' || levelLower === 'moderate') ? 'medium' : 'low';
          return createMeter(meterLevel, `${level.toUpperCase()} ${suffix.toUpperCase()}`);
        });

      // Inline compound phrases: "Assessment: HIGH RISK —" or "Level: MODERATE PRIORITY:"
      // Match after colon/space, capture full compound phrase
      text = text.replace(/:\s*(CRITICAL|HIGH|MODERATE|MEDIUM|LOW)\s+(RISK|PRIORITY|EXPOSURE|IMPACT)\s*([—\-:])/gi,
        (_match, level, suffix, separator) => {
          const levelLower = level.toLowerCase();
          const meterLevel = levelLower === 'critical' ? 'critical' :
                            levelLower === 'high' ? 'high' :
                            (levelLower === 'medium' || levelLower === 'moderate') ? 'medium' : 'low';
          return ': ' + createMeter(meterLevel, `${level.toUpperCase()} ${suffix.toUpperCase()}`) + ' ' + separator;
        });

      // Positive outcome badges (✅ [HELPFUL], ✅ Favorable, etc.)
      text = text.replace(/✅\s*\[?(HELPFUL|FAVORABLE|GOOD|POSITIVE)\]?:?/gi,
        `<span class="outcome-positive"><i class="ri-checkbox-circle-fill"></i> $1</span>`);

      // Negative outcome badges (❌ [SEVERITY], ❌ Unfavorable, etc.)
      text = text.replace(/❌\s*\[?(SEVERITY|UNFAVORABLE|BAD|NEGATIVE|DENIED)\]?:?/gi,
        `<span class="outcome-negative"><i class="ri-close-circle-fill"></i> $1</span>`);

      // REMOVED: Citation highlighting (redundant - citations are now clickable links)
      // The following citation types are now handled by createCitationLinks() and styled as links:
      // - Mass. R. Civ. P., Mass. R. Crim. P., M.G.L.
      // - Treasury Regulations
      // - IRC provisions
      // - Tax Court Rules
      // - Federal Rules (Civ. P. and Crim. P.)
      // - U.S. Sentencing Guidelines
      // - D. Mass. Local Rules

      // Judge and doctor names (Hon., Dr., Judge, Justice + Name)
      text = text.replace(/\b((?:Hon\.|Dr\.|Judge|Justice)\s+[A-Z][a-z]+(?:\s+[A-Z]'?[A-Z]?[a-z]+)*(?:'s)?)\b/g, (match) =>
        `<span class="legal-judge">${match}</span>`);

      // 3. Dollar amounts with K/M/B suffix, decimals, and ranges (e.g., $5K, $2-3M, $4.2M, $10-20K)
      text = text.replace(/\$\d+(?:\.\d+)?(?:,\d{3})*(?:K|M|B)?(?:\s*-\s*\$?\d+(?:\.\d+)?(?:,\d{3})*(?:K|M|B)?)?/gi, (match) =>
        `<span class="legal-amount">${match}</span>`);

      // 4. Dates - month name + day + year
      text = text.replace(/\b((?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+\d{1,2},?\s+\d{4})\b/g, (match) =>
        `<span class="legal-date">${match}</span>`);

      // 5. Year ranges
      text = text.replace(/\b(\d{4}-\d{4})\b/g, (match) =>
        `<span class="legal-date">${match}</span>`);

      // 6. Motion types
      text = text.replace(/\b(Motion\s+for\s+Class\s+Certification)\b/gi, (match) =>
        `<span class="legal-term">${match}</span>`);
      text = text.replace(/\b(Motion\s+for\s+Sanctions)\b/gi, (match) =>
        `<span class="legal-term">${match}</span>`);

      // 7. Legal terms
      text = text.replace(/\b(spoliation|adverse\s+inference|trade\s+secret)\b/gi, (match) =>
        `<span class="legal-term">${match}</span>`);
      text = text.replace(/\b(MCAD\s+complaint)\b/g, (match) =>
        `<span class="legal-term">${match}</span>`);

      parts[i] = text;
    }

    // Join parts back together
    let finalHtml = parts.join('');

    // Cleanup: Remove orphaned warning emojis that appear before severity meters
    // (This happens when emoji and severity text were in separate HTML elements due to bold/italic formatting)
    finalHtml = finalHtml.replace(/(?:⚠️|⚠)\s*(?:<[^>]*>\s*)*(<span class="severity-meter)/g, '$1');

    return finalHtml;
  }

  /**
   * Detect if a table contains timeline/date data
   * Checks for date patterns in first column or date-related headers
   */
  private isTimelineTable(tableRows: string[]): boolean {
    if (tableRows.length < 2) return false; // Need at least header + 1 data row

    const headerRow = tableRows[0];
    const headerCells = this.parseTableRow(headerRow);

    // Check if header contains timeline-related keywords
    const timelineKeywords = /date|timeline|event|milestone|deadline|when|period/i;
    const hasTimelineHeader = headerCells.some(cell => timelineKeywords.test(cell));

    // Check if first column of data rows contains dates
    let dateCount = 0;
    const datePattern = /\d{4}[-\/]\d{1,2}[-\/]\d{1,2}|\d{1,2}[-\/]\d{1,2}[-\/]\d{4}|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4}/i;

    for (let i = 1; i < Math.min(tableRows.length, 4); i++) { // Check first 3 data rows
      const cells = this.parseTableRow(tableRows[i]);
      if (cells.length > 0 && datePattern.test(cells[0])) {
        dateCount++;
      }
    }

    // It's a timeline if header suggests it OR majority of first column are dates
    return hasTimelineHeader || dateCount >= 2;
  }

  /**
   * Convert a table-formatted timeline to visual timeline
   */
  private convertTimelineTable(tableRows: string[]): string {
    if (tableRows.length < 2) return ''; // Need at least header + data

    const timelineItems: {date: string, description: string}[] = [];

    // Skip header row (index 0) and process data rows
    for (let i = 1; i < tableRows.length; i++) {
      const cells = this.parseTableRow(tableRows[i]);
      if (cells.length >= 2) {
        timelineItems.push({
          date: cells[0], // First column is date
          description: cells.slice(1).join(' - ') // Remaining columns are description
        });
      } else if (cells.length === 1) {
        // Single column - try to parse as "date: description"
        const match = cells[0].match(/^([^:]+):\s*(.+)$/);
        if (match) {
          timelineItems.push({
            date: match[1],
            description: match[2]
          });
        }
      }
    }

    if (timelineItems.length === 0) return '';

    return this.formatTimelineItems(timelineItems);
  }

  /**
   * Convert markdown tables to HTML tables
   * Detects pipe-delimited tables and converts them to proper HTML table structure
   * Timeline tables are converted to visual timelines instead
   */
  private convertTablesToHtml(text: string): string {
    const lines = text.split('\n');
    const result: string[] = [];
    let tableRows: string[] = [];
    let inTable = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Check if this is a table row (starts and ends with |)
      if (line.startsWith('|') && line.endsWith('|')) {
        // Check if this is a separator row (contains only |, -, and spaces)
        if (/^\|[\s\-|]+\|$/.test(line)) {
          // This is a separator row - continue accumulating
          inTable = true;
          continue;
        }

        // This is a data row
        tableRows.push(line);
        inTable = true;
      } else {
        // Not a table row
        if (inTable && tableRows.length > 0) {
          // Check if this is a timeline table before converting
          if (this.isTimelineTable(tableRows)) {
            result.push(this.convertTimelineTable(tableRows));
          } else {
            result.push(this.formatTableRows(tableRows));
          }
          tableRows = [];
          inTable = false;
        }
        result.push(lines[i]); // Keep original line (with original spacing)
      }
    }

    // Handle table at end of text
    if (tableRows.length > 0) {
      // Check if this is a timeline table before converting
      if (this.isTimelineTable(tableRows)) {
        result.push(this.convertTimelineTable(tableRows));
      } else {
        result.push(this.formatTableRows(tableRows));
      }
    }

    return result.join('\n');
  }

  /**
   * Format accumulated table rows into HTML table structure
   * First row becomes <thead>, remaining rows become <tbody>
   * Uses Velzon table styling classes
   * IMPORTANT: No newlines to prevent <br> injection
   */
  private formatTableRows(rows: string[]): string {
    if (rows.length === 0) return '';

    let html = '<div class="table-responsive"><table class="table table-bordered table-striped table-hover align-middle mb-0"><thead class="table-light"><tr>';

    const headerCells = this.parseTableRow(rows[0]);
    headerCells.forEach(cell => {
      html += `<th scope="col">${cell}</th>`;
    });
    html += '</tr></thead>';

    if (rows.length > 1) {
      html += '<tbody>';
      for (let i = 1; i < rows.length; i++) {
        const cells = this.parseTableRow(rows[i]);
        html += '<tr>';
        cells.forEach(cell => {
          html += `<td>${cell}</td>`;
        });
        html += '</tr>';
      }
      html += '</tbody>';
    }

    html += '</table></div>';
    return html;
  }

  /**
   * Parse a markdown table row into individual cells
   * Splits by | and trims whitespace from each cell
   */
  private parseTableRow(row: string): string[] {
    // Remove leading and trailing pipes, then split by pipe
    const trimmed = row.trim().replace(/^\|/, '').replace(/\|$/, '');
    return trimmed.split('|').map(cell => cell.trim());
  }

  /**
   * Convert timeline patterns to beautiful visual timelines
   * Detects TIMELINE: markers, date-prefixed bullet points, or narrative date format
   */
  private convertTimelinesToHtml(text: string): string {
    const lines = text.split('\n');
    const result: string[] = [];
    let timelineItems: {date: string, description: string}[] = [];
    let inTimeline = false;
    let explicitTimeline = false;
    let currentDate = '';
    let descriptions: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Check for explicit TIMELINE: marker
      if (line.match(/^TIMELINE:?\s*$/i)) {
        explicitTimeline = true;
        inTimeline = true;
        continue;
      }

      // Check for date-prefixed bullet points
      // Formats: - **Jan 15, 2024**: Description, - Jan 15, 2024 (10 days): Description, - **November-December 2026**: Description, - Q2 2027: Description
      // The date can be optionally wrapped in bold (**date**)
      const bulletTimelineMatch = line.match(/^[-*]\s*(?:\*\*)?([A-Za-z]+-?[A-Za-z]*\s+\d{1,2},?\s+\d{4}|Q[1-4]\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}|[A-Za-z]+\s+\d{4}|[A-Za-z]+-[A-Za-z]+\s+\d{4})(?:\*\*)?(?:\s*\([^)]+\))?:\s*(.+)$/);

      if (bulletTimelineMatch && (explicitTimeline || inTimeline || this.looksLikeTimeline(lines, i))) {
        inTimeline = true;
        timelineItems.push({
          date: bulletTimelineMatch[1],
          description: bulletTimelineMatch[2]
        });
        continue;
      }

      // Check for narrative date format (Format: **November 9, 2025** (10 days), November-December 2026, Q2 2027)
      // The date can be optionally wrapped in bold
      const narrativeDateMatch = line.match(/^(?:\*\*)?([A-Za-z]+-?[A-Za-z]*\s+\d{1,2},?\s+\d{4}|Q[1-4]\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}|[A-Za-z]+\s+\d{4}|[A-Za-z]+-[A-Za-z]+\s+\d{4})(?:\*\*)?(?:\s*\([^)]+\))?$/);

      if (narrativeDateMatch) {
        // Save previous date's data if exists
        if (currentDate && descriptions.length > 0) {
          timelineItems.push({
            date: currentDate,
            description: descriptions.join(' • ')
          });
        }
        // Start new date entry
        currentDate = narrativeDateMatch[1];
        descriptions = [];
        inTimeline = true;
        continue;
      }

      // Check for description bullets (○, ◦, •, -, *) following a date
      const descriptionMatch = line.match(/^[○◦•\-*]\s*(.+)$/);

      if (descriptionMatch && currentDate) {
        descriptions.push(descriptionMatch[1]);
        continue;
      }

      // Skip empty lines and headings within timeline - they're just formatting
      if (inTimeline && (line === '' || line.match(/^#{1,6}\s/))) {
        // Save current date's data if exists before heading
        if (currentDate && descriptions.length > 0) {
          timelineItems.push({
            date: currentDate,
            description: descriptions.join(' • ')
          });
          currentDate = '';
          descriptions = [];
        }
        // Don't output the timeline yet, just skip this line
        continue;
      }

      // Not a timeline-related line - this breaks the timeline
      if (!inTimeline || (line !== '' && !descriptionMatch && !narrativeDateMatch && !bulletTimelineMatch)) {
        // Save any pending timeline data
        if (currentDate && descriptions.length > 0) {
          timelineItems.push({
            date: currentDate,
            description: descriptions.join(' • ')
          });
          currentDate = '';
          descriptions = [];
        }

        if (timelineItems.length > 0) {
          result.push(this.formatTimelineItems(timelineItems));
          timelineItems = [];
        }

        inTimeline = false;
        explicitTimeline = false;
        result.push(lines[i]);
      }
    }

    // Handle timeline at end of text
    if (currentDate && descriptions.length > 0) {
      timelineItems.push({
        date: currentDate,
        description: descriptions.join(' • ')
      });
    }

    if (timelineItems.length > 0) {
      result.push(this.formatTimelineItems(timelineItems));
    }

    return result.join('\n');
  }

  /**
   * Check if the current line is part of a timeline pattern
   * (2+ date-prefixed items within next 10 lines suggest a timeline)
   * Skips empty lines and headings when looking for timeline items
   */
  private looksLikeTimeline(lines: string[], currentIndex: number): boolean {
    let count = 0;
    const datePattern = /^[-*]\s*(?:\*\*)?([A-Za-z]+-?[A-Za-z]*\s+\d{1,2},?\s+\d{4}|Q[1-4]\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}|[A-Za-z]+\s+\d{4}|[A-Za-z]+-[A-Za-z]+\s+\d{4})(?:\*\*)?(?:\s*\([^)]+\))?:\s*(.+)$/;

    // Check next several lines (skip empty lines and headings)
    for (let i = currentIndex; i < Math.min(currentIndex + 10, lines.length); i++) {
      const trimmed = lines[i].trim();

      // Skip empty lines and headings
      if (trimmed === '' || trimmed.match(/^#{1,6}\s/)) {
        continue;
      }

      if (trimmed.match(datePattern)) {
        count++;
        if (count >= 2) {
          return true; // Found 2 timeline items, that's enough
        }
      }
    }

    return count >= 2;
  }

  /**
   * Format timeline items into beautiful visual timeline using Velzon theme styling
   * Optimized for both light and dark modes with soft colors and proper contrast
   * IMPORTANT: No newlines in the HTML to prevent markdown converter from adding <br> tags
   */
  private formatTimelineItems(items: {date: string, description: string}[]): string {
    let html = '<div class="position-relative ,mt-4 mb-4">';

    // Vertical connecting line - starts from center of first icon, ends at center of last icon
    // top: 18px (half of 36px icon), height: calculated based on number of items
    // Each item has mb-4 spacing (24px in Bootstrap default), so: (items - 1) * 24px
    const lineHeight = items.length > 1 ? `calc(100% - 90px)` : '0';
    html += `<div class="position-absolute" style="left: 18px; top: 30px; height: ${lineHeight}; width: 2px; background: var(--vz-border-color); opacity: 0.3; z-index: 0;"></div>`;

    items.forEach((item, index) => {
      const icon = this.getTimelineIcon(item.description);
      const iconBgClass = this.getEventIconBgClass(item.description);
      const iconColorClass = this.getEventIconColorClass(item.description);
      const badgeClass = this.getEventBadgeClass(item.description);
      const isLast = index === items.length - 1;

      // Timeline item with Velzon flexbox utilities
      html += `<div class="position-relative d-flex align-items-start ${isLast ? 'mb-0' : 'mb-4'}">`;

      // Icon circle with solid background to cover line - box-shadow acts as halo to hide line
      html += `<div class="position-relative flex-shrink-0 ${iconBgClass}" style="width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; z-index: 2; "><i class="${icon} ${iconColorClass}" style="font-size: 16px;"></i></div>`;

      // Content area with proper dark mode text colors
      html += `<div class="flex-grow-1 ms-3 pt-0">`;

      // Date header with badge - removed text-dark for dark mode compatibility
      html += `<div class="d-flex align-items-center gap-2 mb-2">`;
      html += `<h6 class="mb-0 fw-semibold" style="font-size: 15px; letter-spacing: -0.01em;">${this.formatTimelineDate(item.date)}</h6>`;
      html += `<span class="badge ${badgeClass} fw-medium" style="font-size: 10px; padding: 3px 8px; letter-spacing: 0.03em;">${this.getEventTypeLabel(item.description)}</span>`;
      html += `</div>`;

      // Description with muted text (works in both light and dark mode)
      html += `<p class="mb-0 text-muted" style="font-size: 13px; line-height: 1.6; max-width: 95%;">${item.description}</p>`;

      html += `</div>`;
      html += `</div>`;
    });

    html += '</div>';
    return html;
  }

  /**
   * Get event type label based on description keywords
   */
  private getEventTypeLabel(description: string): string {
    const lower = description.toLowerCase();
    if (lower.includes('file') || lower.includes('filed') || lower.includes('submit')) return 'Filing';
    if (lower.includes('hear') || lower.includes('court') || lower.includes('trial')) return 'Hearing';
    if (lower.includes('deadline') || lower.includes('due')) return 'Deadline';
    if (lower.includes('discovery') || lower.includes('disclosure')) return 'Discovery';
    if (lower.includes('motion') || lower.includes('petition')) return 'Motion';
    if (lower.includes('decision') || lower.includes('ruling') || lower.includes('order')) return 'Ruling';
    if (lower.includes('settlement') || lower.includes('agree')) return 'Settlement';
    return 'Event';
  }

  /**
   * Get Velzon soft background color class for event icon (for dark mode compatibility)
   */
  private getEventIconBgClass(description: string): string {
    const lower = description.toLowerCase();
    if (lower.includes('file') || lower.includes('filed') || lower.includes('submit')) return 'bg-primary-subtle';
    if (lower.includes('hear') || lower.includes('court') || lower.includes('trial')) return 'bg-secondary-subtle';
    if (lower.includes('deadline') || lower.includes('due')) return 'bg-danger-subtle';
    if (lower.includes('discovery') || lower.includes('disclosure')) return 'bg-info-subtle';
    if (lower.includes('motion') || lower.includes('petition')) return 'bg-warning-subtle';
    if (lower.includes('decision') || lower.includes('ruling') || lower.includes('order')) return 'bg-success-subtle';
    if (lower.includes('settlement') || lower.includes('agree')) return 'bg-success-subtle';
    return 'bg-primary-subtle';
  }

  /**
   * Get Velzon text color class for event icon
   */
  private getEventIconColorClass(description: string): string {
    const lower = description.toLowerCase();
    if (lower.includes('file') || lower.includes('filed') || lower.includes('submit')) return 'text-primary';
    if (lower.includes('hear') || lower.includes('court') || lower.includes('trial')) return 'text-secondary';
    if (lower.includes('deadline') || lower.includes('due')) return 'text-danger';
    if (lower.includes('discovery') || lower.includes('disclosure')) return 'text-info';
    if (lower.includes('motion') || lower.includes('petition')) return 'text-warning';
    if (lower.includes('decision') || lower.includes('ruling') || lower.includes('order')) return 'text-success';
    if (lower.includes('settlement') || lower.includes('agree')) return 'text-success';
    return 'text-primary';
  }

  /**
   * Get Velzon badge class for event type
   */
  private getEventBadgeClass(description: string): string {
    const lower = description.toLowerCase();
    if (lower.includes('file') || lower.includes('filed') || lower.includes('submit')) return 'bg-primary-subtle text-primary';
    if (lower.includes('hear') || lower.includes('court') || lower.includes('trial')) return 'bg-secondary-subtle text-secondary';
    if (lower.includes('deadline') || lower.includes('due')) return 'bg-danger-subtle text-danger';
    if (lower.includes('discovery') || lower.includes('disclosure')) return 'bg-info-subtle text-info';
    if (lower.includes('motion') || lower.includes('petition')) return 'bg-warning-subtle text-warning';
    if (lower.includes('decision') || lower.includes('ruling') || lower.includes('order')) return 'bg-success-subtle text-success';
    if (lower.includes('settlement') || lower.includes('agree')) return 'bg-success-subtle text-success';
    return 'bg-primary-subtle text-primary';
  }

  /**
   * Get appropriate icon based on timeline description keywords
   */
  private getTimelineIcon(description: string): string {
    const lower = description.toLowerCase();

    if (lower.includes('file') || lower.includes('filed') || lower.includes('submit')) return 'ri-file-text-line';
    if (lower.includes('hear') || lower.includes('court') || lower.includes('trial')) return 'ri-government-line';
    if (lower.includes('deadline') || lower.includes('due')) return 'ri-calendar-line';
    if (lower.includes('discovery') || lower.includes('disclosure')) return 'ri-search-line';
    if (lower.includes('motion') || lower.includes('petition')) return 'ri-file-list-3-line';
    if (lower.includes('decision') || lower.includes('ruling') || lower.includes('order')) return 'ri-scales-3-line';
    if (lower.includes('settlement') || lower.includes('agree')) return 'ri-handshake-line';
    if (lower.includes('appeal')) return 'ri-arrow-up-circle-line';

    return 'ri-calendar-event-line'; // Default icon
  }

  /**
   * Format date for timeline display
   */
  private formatTimelineDate(dateStr: string): string {
    // Handle special formats that won't parse as dates
    if (dateStr.match(/^Q[1-4]\s+\d{4}$/)) {
      // Q2 2027 -> Quarter 2, 2027
      return dateStr.replace(/^Q([1-4])\s+(\d{4})$/, 'Quarter $1, $2');
    }

    if (dateStr.match(/^[A-Za-z]+-[A-Za-z]+\s+\d{4}$/)) {
      // November-December 2026 -> already formatted nicely
      return dateStr;
    }

    if (dateStr.match(/^[A-Za-z]+\s+\d{4}$/)) {
      // October 2026 -> already formatted nicely
      return dateStr;
    }

    // Try to parse and format standard dates nicely
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    // Return as-is if parsing fails
    return dateStr;
  }

  /**
   * Convert chart patterns to visual HTML representations
   * Supports BAR, PIE, and LINE charts with pure HTML/CSS
   */
  private convertChartsToHtml(text: string): string {
    // CHART:BAR pattern with table data
    text = text.replace(/CHART:BAR\s*\n(\|[^\n]+\|\n)+/gi, (match) => {
      return this.createBarChart(match);
    });

    // CHART:PIE pattern with percentage list
    text = text.replace(/CHART:PIE\s*\n([-*]\s+[^:]+:\s*\d+%\s*\n)+/gi, (match) => {
      return this.createPieChart(match);
    });

    // CHART:LINE pattern with year/value pairs
    text = text.replace(/CHART:LINE\s*\n([^\n]+\n)?(\d{4}:\s*\d+\s*\n)+/gi, (match) => {
      return this.createLineChart(match);
    });

    return text;
  }

  /**
   * Convert invalid bar chart (with text data) back to table format
   * Removes CHART:BAR prefix and returns as markdown table for normal table rendering
   */
  private convertChartToTable(chartText: string): string {
    // Remove CHART:BAR prefix, return remainder as markdown table
    const tableMarkdown = chartText.replace(/^CHART:BAR\s*\n/i, '');
    // The table will be processed by convertTablesToHtml() in the normal flow
    return tableMarkdown;
  }

  /**
   * Parse chart values from formatted text into numeric values for calculations
   * Handles currency formatting, ranges, and various text patterns
   */
  private parseChartValue(text: string): number {
    if (!text) {
      return 0;
    }

    // Remove common formatting: $, commas, +
    let cleaned = text.trim()
      .replace(/\$/g, '')
      .replace(/,/g, '')
      .replace(/\+/g, '');

    // Handle ranges: "300-800" → average (550)
    const rangeMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
    if (rangeMatch) {
      const min = parseFloat(rangeMatch[1]);
      const max = parseFloat(rangeMatch[2]);
      return (min + max) / 2;
    }

    // Handle slash-separated values like "0 upfront/15000 contingency" → take max
    // Extract all numbers from the text
    const numbers = cleaned.match(/\d+(?:\.\d+)?/g);
    if (numbers && numbers.length > 1) {
      // Multiple numbers found - take the maximum (usually the actual fee, not upfront)
      const values = numbers.map(n => parseFloat(n));
      return Math.max(...values);
    }

    // Handle single number
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  /**
   * Create ApexCharts bar chart from table data
   * Uses directive-based rendering for interactive charts
   * SECURITY: Sanitizes all labels and values to prevent XSS
   */
  private createBarChart(chartText: string): string {
    const lines = chartText.trim().split('\n').filter(l => l.trim());

    // Find the separator row (markdown table structure: |---|---|)
    const separatorIndex = lines.findIndex(l => l.match(/^\|[-\s|]+\|$/));

    // If separator found, start from the row after it; otherwise start from row 1 (skip CHART:BAR)
    const startIndex = separatorIndex >= 0 ? separatorIndex + 1 : 1;
    const dataRows = lines.slice(startIndex);

    if (dataRows.length === 0) return chartText;

    let chartData: {label: string, value: number, displayValue: string}[] = [];

    dataRows.forEach((row, index) => {
      const cells = row.split('|').map(c => c.trim()).filter(c => c);
      if (cells.length >= 2) {
        const label = cells[0];
        const displayValue = cells[1]; // Keep original formatted text
        const value = this.parseChartValue(cells[1]); // Parse for calculations

        // FALLBACK: If no separator was found and this is the first row with value=0, check if it's a header
        if (separatorIndex < 0 && index === 0 && value === 0) {
          // Check if next row has a value > 0 to confirm this is a header
          if (dataRows.length > 1) {
            const nextRow = dataRows[1];
            const nextCells = nextRow.split('|').map(c => c.trim()).filter(c => c);
            if (nextCells.length >= 2) {
              const nextValue = this.parseChartValue(nextCells[1]);
              if (nextValue > 0) {
                return; // Skip this row as it's a header
              }
            }
          }
        }

        chartData.push({label, value, displayValue});
      }
    });

    if (chartData.length === 0) return chartText;

    // Validate: Check if all values are 0 (indicates text data being parsed as numbers)
    const allZero = chartData.every(item => item.value === 0);
    if (allZero) {
      // Convert invalid bar chart back to table format
      return this.convertChartToTable(chartText);
    }

    // SECURITY: Limit data size to prevent DoS
    chartData = this.chartSecurity.limitDataSize(chartData);

    // SECURITY: Sanitize data before creating config
    const sanitizedData = chartData.map(item => ({
      label: this.chartSecurity.sanitizeLabel(item.label),
      value: this.chartSecurity.sanitizeValue(item.value),
      displayValue: this.chartSecurity.sanitizeLabel(item.displayValue)
    }));

    // Prepare data for ApexCharts with sanitized values
    const config = {
      type: 'bar',
      title: this.chartSecurity.sanitizeLabel('Comparison Chart'),
      subtitle: this.chartSecurity.sanitizeLabel('Visual representation of comparative data'),
      data: sanitizedData,
      labels: sanitizedData.map(item => item.label)
    };

    const configJson = JSON.stringify(config).replace(/"/g, '&quot;');

    return `<div class="card border-0 shadow my-3" style="border-radius: 10px; overflow: hidden;"><div class="card-body p-3"><div data-chart="${configJson}" style="min-height: 320px;"></div></div></div>`;
  }

  /**
   * Create ApexCharts pie/donut chart from percentage list
   * Uses directive-based rendering for interactive charts
   * SECURITY: Sanitizes labels and validates percentages
   */
  private createPieChart(chartText: string): string {
    const lines = chartText.trim().split('\n').filter(l => l.trim() && !l.match(/^CHART:PIE/i));
    let chartData: {label: string, percentage: number}[] = [];

    lines.forEach(line => {
      const match = line.match(/[-*]\s+([^:]+):\s*(\d+)%/);
      if (match) {
        chartData.push({
          label: match[1].trim(),
          percentage: parseInt(match[2])
        });
      }
    });

    if (chartData.length === 0) return chartText;

    // SECURITY: Limit data size to prevent DoS
    chartData = this.chartSecurity.limitDataSize(chartData);

    // SECURITY: Sanitize labels and validate percentages (0-100 range)
    const sanitizedData = chartData.map(item => ({
      label: this.chartSecurity.sanitizeLabel(item.label),
      percentage: this.chartSecurity.sanitizePercentage(item.percentage)
    }));

    // Prepare data for ApexCharts with sanitized values
    const config = {
      type: 'donut',
      title: this.chartSecurity.sanitizeLabel('Distribution Chart'),
      subtitle: this.chartSecurity.sanitizeLabel('Percentage breakdown by category'),
      data: sanitizedData.map(item => item.percentage),
      labels: sanitizedData.map(item => item.label)
    };

    const configJson = JSON.stringify(config).replace(/"/g, '&quot;');

    return `<div class="card border-0 shadow my-3" style="border-radius: 10px; overflow: hidden;"><div class="card-body p-3"><div data-chart="${configJson}" style="min-height: 380px;"></div></div></div>`;
  }

  /**
   * Create ApexCharts line chart from year/value pairs
   * Uses directive-based rendering for interactive charts
   * SECURITY: Sanitizes labels and validates numeric values
   */
  private createLineChart(chartText: string): string {
    const lines = chartText.trim().split('\n').filter(l => l.trim() && !l.match(/^CHART:LINE/i));
    const titleLine = lines.find(l => !l.match(/^\d{4}:/) && !l.match(/^CHART:LINE/i));
    const dataLines = lines.filter(l => l.match(/^\d{4}:/));

    let chartData: {year: string, value: number, displayValue: string}[] = [];

    dataLines.forEach(line => {
      const match = line.match(/^(\d{4}):\s*(.+)$/);
      if (match) {
        const year = match[1];
        const displayValue = match[2].trim(); // Keep original formatted text
        const value = this.parseChartValue(match[2]); // Parse for calculations
        chartData.push({year, value, displayValue});
      }
    });

    if (chartData.length === 0) return chartText;

    // SECURITY: Limit data size to prevent DoS
    chartData = this.chartSecurity.limitDataSize(chartData);

    // SECURITY: Sanitize year labels and values
    const sanitizedData = chartData.map(item => ({
      year: this.chartSecurity.sanitizeLabel(item.year),
      value: this.chartSecurity.sanitizeValue(item.value)
    }));

    // Prepare data for ApexCharts with sanitized values
    const config = {
      type: 'line',
      title: this.chartSecurity.sanitizeLabel(titleLine && titleLine.trim() ? titleLine : 'Trend Chart'),
      subtitle: this.chartSecurity.sanitizeLabel('Trend analysis over time'),
      data: sanitizedData.map(item => item.value),
      labels: sanitizedData.map(item => item.year)
    };

    const configJson = JSON.stringify(config).replace(/"/g, '&quot;');

    return `<div class="card border-0 shadow my-3" style="border-radius: 10px; overflow: hidden;"><div class="card-body p-3"><div data-chart="${configJson}" style="min-height: 320px;"></div></div></div>`;
  }

  private convertMarkdownToHtml(text: string): string {
    // REMOVE STRAY BACKTICKS (formatting artifacts from AI responses)
    text = text.replace(/^`\s*/gm, ''); // Backticks at start of lines
    text = text.replace(/`{3,}/g, ''); // Triple+ backticks not in code blocks (already handled by inline code)

    // Convert timelines FIRST (before tables and other markdown)
    text = this.convertTimelinesToHtml(text);

    // Convert charts SECOND (before tables to avoid conflicts)
    text = this.convertChartsToHtml(text);

    // Convert tables THIRD (before other markdown processing)
    text = this.convertTablesToHtml(text);

    // Headers (must be done before other conversions)
    // Handle both normal markdown (## Header) and spaced hashtags (# # Header)
    // Process spaced versions FIRST, then normal versions to avoid conflicts

    // H6 - spaced and normal
    text = text.replace(/^#\s+#\s+#\s+#\s+#\s+#\s+(.*$)/gim, '<h6 style="margin-top: 1.5rem;">$1</h6>');
    text = text.replace(/^#{6}\s+(.*$)/gim, '<h6 style="margin-top: 1.5rem;">$1</h6>');

    // H5 - spaced and normal
    text = text.replace(/^#\s+#\s+#\s+#\s+#\s+(.*$)/gim, '<h5 style="margin-top: 1.5rem;">$1</h5>');
    text = text.replace(/^#{5}\s+(.*$)/gim, '<h5 style="margin-top: 1.5rem;">$1</h5>');

    // H4 - spaced and normal
    text = text.replace(/^#\s+#\s+#\s+#\s+(.*$)/gim, '<h4 style="margin-top: 1.75rem;">$1</h4>');
    text = text.replace(/^#{4}\s+(.*$)/gim, '<h4 style="margin-top: 1.75rem;">$1</h4>');

    // H3 - spaced and normal
    text = text.replace(/^#\s+#\s+#\s+(.*$)/gim, '<h3 style="margin-top: 2rem;">$1</h3>');
    text = text.replace(/^#{3}\s+(.*$)/gim, '<h3 style="margin-top: 2rem;">$1</h3>');

    // H2 - spaced and normal
    text = text.replace(/^#\s+#\s+(.*$)/gim, '<h2 style="margin-top: 2.25rem;">$1</h2>');
    text = text.replace(/^#{2}\s+(.*$)/gim, '<h2 style="margin-top: 2.25rem;">$1</h2>');

    // H1 - single # followed by space and NOT another # (do this last to avoid matching other levels)
    text = text.replace(/^#\s+(?!#)(.*$)/gim, '<h1 style="margin-top: 0.15rem;">$1</h1>');

    // Blockquotes
    text = text.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');

    // Bold and italic (must be done before lists)
    text = text.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Inline code
    text = text.replace(/`(.*?)`/g, '<code>$1</code>');

    // Links (with target="_blank" to open in new tab)
    // Using .+? for lazy matching to handle complex link text (e.g., with dashes or special chars)
    text = text.replace(/\[(.+?)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Horizontal rules
    text = text.replace(/^\-\-\-$/gim, '<hr>');
    text = text.replace(/^\*\*\*$/gim, '<hr>');

    // Lists - Process multi-line lists
    // Ordered lists
    text = text.replace(/^(\d+)\.\s+(.+)$/gim, '<li>$2</li>');
    text = text.replace(/(<li>.*<\/li>)/gim, function(match) {
      if (!match.includes('<ol>')) {
        return '<ol>' + match + '</ol>';
      }
      return match;
    });
    // Clean up multiple ol tags
    text = text.replace(/<\/ol>\s*<ol>/g, '');

    // Unordered lists
    text = text.replace(/^[\*\-]\s+(.+)$/gim, '<li>$1</li>');
    text = text.replace(/(<li>.*<\/li>)/gim, function(match) {
      if (!match.includes('<ul>') && !match.includes('<ol>')) {
        return '<ul>' + match + '</ul>';
      }
      return match;
    });
    // Clean up multiple ul tags
    text = text.replace(/<\/ul>\s*<ul>/g, '');

    // Paragraphs - Wrap text that isn't already in tags
    const lines = text.split('\n');
    const processedLines = lines.map(line => {
      const trimmed = line.trim();
      // Skip if empty or already wrapped in a tag
      if (!trimmed || trimmed.match(/^<[^>]+>/)) {
        return line;
      }
      return '<p>' + trimmed + '</p>';
    });
    text = processedLines.join('\n');

    // Line breaks - Convert remaining newlines to <br>
    text = text.replace(/\n/g, '<br>');

    // Clean up extra <br> tags around block elements
    text = text.replace(/<br>\s*<(h[1-6]|p|ul|ol|li|blockquote|hr)/gi, '<$1');
    text = text.replace(/<\/(h[1-6]|p|ul|ol|li|blockquote|hr)>\s*<br>/gi, '</$1>');

    return text;
  }
}