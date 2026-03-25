import { Injectable, inject } from '@angular/core';
import { ChartSecurityService } from './chart-security.service';

/**
 * Service for converting Markdown to HTML with legal-specific enhancements
 * Extracted from MarkdownToHtmlPipe for reusability in Quill editor and other components
 */
@Injectable({
  providedIn: 'root'
})
export class MarkdownConverterService {
  private chartSecurity = inject(ChartSecurityService);

  /**
   * Convert Markdown text to HTML with full legal formatting
   * Includes: headers, bold, lists, tables, timelines, charts, citations, legal highlighting
   */
  convert(markdown: string): string {
    if (!markdown) {
      return '';
    }

    // STEP 1: Process checkmark citations BEFORE markdown conversion
    let text = this.processCheckmarkCitations(markdown);

    // STEP 2: Convert markdown to HTML
    let html = this.convertMarkdownToHtml(text);

    // STEP 3: Create citation links (emergency fix - backend not injecting URLs)
    html = this.createCitationLinks(html);

    // STEP 4: Apply legal highlighting to the HTML output
    html = this.highlightLegalTerms(html);

    return html;
  }

  /**
   * Process checkmark citations BEFORE markdown-to-HTML conversion
   * This ensures the checkmark and link stay together in one HTML element
   */
  private processCheckmarkCitations(markdown: string): string {
    return markdown.replace(/✓\s*\[([^\]]+?)\]\(([^)]+)\)/gi,
      (_match, linkText, url) => {
        const cleanText = linkText.replace(/\s*-\s*View\s*→\s*$/i, '').trim();
        return `<span class="citation-verified">✓ <a href="${url}" target="_blank" rel="noopener noreferrer">${cleanText}</a></span>`;
      });
  }

  /**
   * Create links directly in frontend since backend isn't injecting them
   */
  private createCitationLinks(html: string): string {
    // IRC citations
    html = html.replace(/(?:✓\s*)?\bIRC\s*§\s*(\d+)(?:\s*\([^)]+\))*(?![<\w])/gi,
      (match, section) => {
        let url = `https://www.law.cornell.edu/uscode/text/26/${section}`;
        const firstSubsection = match.match(/\(([a-zA-Z0-9]+)\)/);
        if (firstSubsection) {
          url += `#${firstSubsection[1]}`;
        }
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="legal-link">${match}</a>`;
      });

    // Treasury Regulations
    html = html.replace(/(?:✓\s*)?\b(?:Treas(?:ury)?\.?\s*(?:Reg\.|Regulation))\s*§\s*[\d.]+[A-Za-z]*(?:-[\d]+[A-Za-z]*)*(?:\s*\([^)]+\))*(?![<\w])/gi,
      (match) => {
        const regMatch = match.match(/§\s*([\d.]+[A-Za-z]*(?:-[\d]+[A-Za-z]*)*)/);
        const regNumber = regMatch ? regMatch[1].trim() : '';
        return `<a href="https://www.law.cornell.edu/cfr/text/26/${regNumber}" target="_blank" rel="noopener noreferrer" class="legal-link">${match}</a>`;
      });

    // M.G.L. citations
    html = html.replace(/(?:✓\s*)?\bM\.G\.L\.\s*c\.\s*(\d+[AB]?)(?:,?\s*§\s*(\w+(?:\s*\([^)]+\))*))?(?![<\w])/gi,
      (match, chapter, section) => {
        if (section) {
          return `<a href="https://malegislature.gov/Laws/GeneralLaws/Chapter${chapter}/Section${section}" target="_blank" rel="noopener noreferrer" class="legal-link">${match}</a>`;
        } else {
          return `<a href="https://malegislature.gov/Laws/GeneralLaws/Chapter${chapter}" target="_blank" rel="noopener noreferrer" class="legal-link">${match}</a>`;
        }
      });

    // Federal Rules
    html = html.replace(/(?:✓\s*)?\bFed\.\s*R\.\s*Civ\.\s*P\.\s*(\d+)(?:\s*\([^)]+\))*(?![<\w])/gi,
      (match, rule) => {
        return `<a href="https://www.law.cornell.edu/rules/frcp/rule_${rule}" target="_blank" rel="noopener noreferrer" class="legal-link">${match}</a>`;
      });

    html = html.replace(/(?:✓\s*)?\bFed\.\s*R\.\s*Crim\.\s*P\.\s*(\d+)(?:\s*\([^)]+\))*(?![<\w])/gi,
      (match, rule) => {
        return `<a href="https://www.law.cornell.edu/rules/frcrmp/rule_${rule}" target="_blank" rel="noopener noreferrer" class="legal-link">${match}</a>`;
      });

    return html;
  }

  /**
   * Apply legal term highlighting to HTML
   */
  private highlightLegalTerms(html: string): string {
    let result = html;
    const parts = result.split(/(<[^>]*>)/);

    for (let i = 0; i < parts.length; i++) {
      if (parts[i].startsWith('<')) continue;

      let text = parts[i];

      // Warning assumption badges
      text = text.replace(/⚠️\s*\*\*Assumption\*\*:/g,
        `<span class="assumption-badge">⚠️ <strong>Assumption</strong>:</span>`);

      // Judge and doctor names
      text = text.replace(/\b((?:Hon\.|Dr\.|Judge|Justice)\s+[A-Z][a-z]+(?:\s+[A-Z]'?[A-Z]?[a-z]+)*(?:'s)?)\b/g, (match) =>
        `<span class="legal-judge">${match}</span>`);

      // Dollar amounts
      text = text.replace(/\$\d+(?:\.\d+)?(?:,\d{3})*(?:K|M|B)?(?:\s*-\s*\$?\d+(?:\.\d+)?(?:,\d{3})*(?:K|M|B)?)?/gi, (match) =>
        `<span class="legal-amount">${match}</span>`);

      // Dates
      text = text.replace(/\b((?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+\d{1,2},?\s+\d{4})\b/g, (match) =>
        `<span class="legal-date">${match}</span>`);

      // Year ranges
      text = text.replace(/\b(\d{4}-\d{4})\b/g, (match) =>
        `<span class="legal-date">${match}</span>`);

      // Legal terms
      text = text.replace(/\b(spoliation|adverse\s+inference|trade\s+secret)\b/gi, (match) =>
        `<span class="legal-term">${match}</span>`);

      parts[i] = text;
    }

    return parts.join('');
  }

  /**
   * Convert Markdown to HTML
   * Handles: headers, bold, italic, lists, links, tables, paragraphs
   * CKEditor 5 preserves custom classes via GeneralHtmlSupport plugin.
   */
  private convertMarkdownToHtml(text: string): string {
    // Convert court caption blocks FIRST (§ column alignment) — before any markdown conversion
    text = this.convertCaptionBlocksToHtml(text);

    // REMOVE STRAY BACKTICKS (formatting artifacts from AI responses)
    text = text.replace(/^`\s*/gm, ''); // Backticks at start of lines
    text = text.replace(/`{3,}/g, ''); // Triple+ backticks not in code blocks

    // Convert tables
    text = this.convertTablesToHtml(text);

    // Headers - native HTML only (H6 to H1, order matters)
    text = text.replace(/^#{6}\s+(.*$)/gim, '<h6>$1</h6>');
    text = text.replace(/^#{5}\s+(.*$)/gim, '<h5>$1</h5>');
    text = text.replace(/^#{4}\s+(.*$)/gim, '<h4>$1</h4>');
    text = text.replace(/^#{3}\s+(.*$)/gim, '<h3>$1</h3>');
    text = text.replace(/^#{2}\s+(.*$)/gim, '<h2>$1</h2>');
    text = text.replace(/^#\s+(?!#)(.*$)/gim, '<h1>$1</h1>');

    // Blockquotes - native HTML only
    text = text.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');

    // Bold and italic
    text = text.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');

    // Inline code - native HTML only
    text = text.replace(/`(.*?)`/g, '<code>$1</code>');

    // Links - native HTML only
    text = text.replace(/\[(.+?)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Horizontal rules - native HTML only
    text = text.replace(/^\-\-\-$/gim, '<hr>');
    text = text.replace(/^\*\*\*$/gim, '<hr>');

    // Lists - Process line by line to properly group consecutive items
    text = this.processListsLineByLine(text);

    // Paragraphs - native HTML only
    const lines = text.split('\n');
    const processedLines = lines.map(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.match(/^<[^>]+>/)) {
        return line;
      }
      return '<p>' + trimmed + '</p>';
    });
    text = processedLines.join('\n');

    // Line breaks
    text = text.replace(/\n/g, '<br>');

    // Clean up extra <br> tags around block elements (including table-related elements)
    text = text.replace(/<br>\s*<(h[1-6]|p|ul|ol|li|blockquote|hr|figure|table|thead|tbody|tr)/gi, '<$1');
    text = text.replace(/<\/(h[1-6]|p|ul|ol|li|blockquote|hr|figure|table|thead|tbody|tr)>\s*<br>/gi, '</$1>');

    // Clean up excessive line breaks (more than 2 consecutive)
    text = text.replace(/(<br>\s*){3,}/g, '<br><br>');

    return text;
  }

  /**
   * Process lists line by line to properly group consecutive items
   * This ensures clean HTML structure that Quill can parse correctly
   */
  private processListsLineByLine(text: string): string {
    const lines = text.split('\n');
    const result: string[] = [];
    let currentList: { type: 'ul' | 'ol' | null; items: string[] } = { type: null, items: [] };

    for (const line of lines) {
      // Check for unordered list (bullet points)
      const bulletMatch = line.match(/^[\*\-]\s+(.+)$/);
      // Check for ordered list (numbered)
      const numberedMatch = line.match(/^(\d+)\.\s+(.+)$/);

      if (bulletMatch) {
        // Found a bullet list item
        if (currentList.type === 'ol') {
          // Flush previous ordered list before starting unordered
          result.push(`<ol>${currentList.items.map(item => `<li>${item}</li>`).join('')}</ol>`);
          currentList = { type: 'ul', items: [bulletMatch[1]] };
        } else {
          // Continue or start unordered list
          if (currentList.type !== 'ul') {
            currentList.type = 'ul';
          }
          currentList.items.push(bulletMatch[1]);
        }
      } else if (numberedMatch) {
        // Found a numbered list item
        if (currentList.type === 'ul') {
          // Flush previous unordered list before starting ordered
          result.push(`<ul>${currentList.items.map(item => `<li>${item}</li>`).join('')}</ul>`);
          currentList = { type: 'ol', items: [numberedMatch[2]] };
        } else {
          // Continue or start ordered list
          if (currentList.type !== 'ol') {
            currentList.type = 'ol';
          }
          currentList.items.push(numberedMatch[2]);
        }
      } else {
        // Not a list item - flush any pending list first
        if (currentList.type) {
          const tag = currentList.type;
          result.push(`<${tag}>${currentList.items.map(item => `<li>${item}</li>`).join('')}</${tag}>`);
          currentList = { type: null, items: [] };
        }
        // Add the non-list line
        result.push(line);
      }
    }

    // Flush any remaining list at the end
    if (currentList.type) {
      const tag = currentList.type;
      result.push(`<${tag}>${currentList.items.map(item => `<li>${item}</li>`).join('')}</${tag}>`);
    }

    return result.join('\n');
  }

  /**
   * Convert markdown tables to HTML tables
   */
  private convertTablesToHtml(text: string): string {
    const lines = text.split('\n');
    const result: string[] = [];
    let tableRows: string[] = [];
    let inTable = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('|') && line.endsWith('|')) {
        if (/^\|[\s\-|]+\|$/.test(line)) {
          inTable = true;
          continue;
        }

        tableRows.push(line);
        inTable = true;
      } else {
        if (inTable && tableRows.length > 0) {
          result.push(this.formatTableRows(tableRows));
          tableRows = [];
          inTable = false;
        }
        result.push(lines[i]);
      }
    }

    if (tableRows.length > 0) {
      result.push(this.formatTableRows(tableRows));
    }

    return result.join('\n');
  }

  /**
   * Format table rows into HTML table structure
   */
  private formatTableRows(rows: string[]): string {
    if (rows.length === 0) return '';

    // CKEditor 5 expects <figure class="table"><table>...</table></figure>
    let html = '<figure class="table"><table><thead><tr>';

    const headerCells = this.parseTableRow(rows[0]);
    headerCells.forEach(cell => {
      html += `<th>${cell}</th>`;
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

    html += '</table></figure>';
    return html;
  }

  /**
   * Parse a markdown table row into individual cells
   */
  private parseTableRow(row: string): string[] {
    const trimmed = row.trim().replace(/^\|/, '').replace(/\|$/, '');
    return trimmed.split('|').map(cell => cell.trim());
  }

  // ========================================
  // Court Caption Block Processing (§ alignment)
  // ========================================

  /**
   * Convert court caption blocks (lines with § column separators) to aligned HTML tables.
   * Detects clusters of 3+ lines containing § and converts them to a borderless table.
   * Also cleans up duplicate preamble (court name, county, cause no.) above the caption.
   */
  private convertCaptionBlocksToHtml(text: string): string {
    const lines = text.split('\n');
    const result: string[] = [];
    let i = 0;

    while (i < lines.length) {
      if (lines[i].includes('§') && this.isCaptionSectionLine(lines[i])) {
        const blockStart = i;
        const sectionLines: string[] = [];
        let consecutiveGap = 0;

        while (i < lines.length && consecutiveGap <= 2) {
          if (lines[i].includes('§') && this.isCaptionSectionLine(lines[i])) {
            sectionLines.push(lines[i]);
            consecutiveGap = 0;
          } else if (lines[i].trim() === '') {
            consecutiveGap++;
          } else {
            break;
          }
          i++;
        }

        if (sectionLines.length >= 3) {
          // Valid caption block — clean preamble above
          let causeNoText = '';
          let relocatedTitle = '';

          const preamblePatterns = [
            /CAUSE\s+NO/i,
            /\bDISTRICT\s+COURT\b/i,
            /\bCOURT\s+AT\s+LAW\b/i,
            /\bCOUNTY\s+COURT\b/i,
            /\bCIRCUIT\s+COURT\b/i,
            /\bSUPERIOR\s+COURT\b/i,
            /^STATE\s+OF\s+/i,
            /^COMMONWEALTH\s+OF\s+/i,
            /COUNTY,?\s+\w+/i,
          ];

          const titleKeywords = /MOTION|PETITION|BRIEF|COMPLAINT|APPLICATION|RESPONSE|REPLY|MEMORANDUM|OBJECTION/i;

          const scanStart = Math.max(0, result.length - 12);
          for (let k = result.length - 1; k >= scanStart; k--) {
            const raw = result[k].trim();
            if (raw === '') continue;
            const stripped = raw.replace(/[#*_]/g, '').trim();

            if (/CAUSE\s+NO/i.test(stripped) && !causeNoText) {
              causeNoText = stripped;
              result.splice(k, 1);
              continue;
            }

            if (preamblePatterns.some(p => p.test(stripped))) {
              result.splice(k, 1);
              continue;
            }

            const isHeading = /^#{1,3}\s+/.test(raw);
            const isAllCapsBold = /^\*\*[A-Z0-9\s,.'():;!&\-]+\*\*$/.test(raw);
            if ((isHeading || isAllCapsBold) && titleKeywords.test(stripped) && !relocatedTitle) {
              relocatedTitle = raw;
              result.splice(k, 1);
              continue;
            }
          }

          // Remove trailing blanks and stray horizontal rules before caption
          while (result.length > 0 && (result[result.length - 1].trim() === '' || result[result.length - 1].trim() === '---')) {
            result.pop();
          }

          result.push(this.buildCaptionHtml(sectionLines, causeNoText));

          if (relocatedTitle) {
            result.push('');
            result.push(relocatedTitle);
          }
        } else {
          for (let j = blockStart; j < i; j++) {
            result.push(lines[j]);
          }
        }
      } else {
        result.push(lines[i]);
        i++;
      }
    }

    return result.join('\n');
  }

  /**
   * Check if a line uses § as a caption column separator (not an inline legal citation).
   */
  private isCaptionSectionLine(line: string): boolean {
    const trimmed = line.trim();
    if (!trimmed.includes('§')) return false;
    if (trimmed === '§') return true;
    if (/^§\s*\d/.test(trimmed)) return false;
    if (/[,.\s]§\s*\d/.test(trimmed)) return false;
    if (trimmed.length > 120) return false;
    return true;
  }

  /**
   * Build an aligned HTML caption table from § lines.
   * Uses BOTH inline styles AND HTML attributes for maximum compatibility:
   * - Inline styles: work in CKEditor and in-app display
   * - HTML attributes: survive cleanHtmlForExport() and work in iText PDF converter
   * Output is a SINGLE LINE to prevent <br> injection from \n→<br> conversion.
   */
  private buildCaptionHtml(sectionLines: string[], causeNoText: string): string {
    let html = '';

    if (causeNoText) {
      const cleanCause = causeNoText.replace(/\|/g, '').replace(/\*\*/g, '').trim();
      html += `<div style="text-align:center;margin-bottom:10px;" align="center"><strong>${cleanCause}</strong></div>`;
    }

    html += `<table style="width:85%;margin:0 auto 20px;border-collapse:collapse;border:none;" border="0" width="85%" align="center" cellpadding="2" cellspacing="0">`;

    for (const line of sectionLines) {
      const sectionIdx = line.indexOf('§');
      let left = line.substring(0, sectionIdx).replace(/\|/g, '').trim();
      let right = line.substring(sectionIdx + 1).replace(/\|/g, '').trim();
      // Convert markdown bold/italic to HTML
      left = left.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');
      right = right.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');

      html += `<tr>`;
      html += `<td style="width:40%;border:none;padding:2px 0;vertical-align:top;" width="40%" valign="top">${left}</td>`;
      html += `<td style="width:8%;border:none;padding:2px 0;text-align:center;vertical-align:top;" width="8%" align="center" valign="top">§</td>`;
      html += `<td style="width:52%;border:none;padding:2px 0;vertical-align:top;" width="52%" valign="top">${right}</td>`;
      html += `</tr>`;
    }

    html += `</table>`;
    return html;
  }
}
