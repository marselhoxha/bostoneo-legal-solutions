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
   * Note: No custom classes - Quill strips them. Style native HTML elements directly.
   */
  private convertMarkdownToHtml(text: string): string {
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

    // Lists - Ordered (native HTML only)
    text = text.replace(/^(\d+)\.\s+(.+)$/gim, '<li>$2</li>');
    text = text.replace(/(<li>.*<\/li>)/gim, function(match) {
      if (!match.includes('<ol>')) {
        return '<ol>' + match + '</ol>';
      }
      return match;
    });
    text = text.replace(/<\/ol>\s*<ol>/g, '');

    // Lists - Unordered (native HTML only)
    text = text.replace(/^[\*\-]\s+(.+)$/gim, '<li>$1</li>');
    text = text.replace(/(<li>.*<\/li>)/gim, function(match) {
      if (!match.includes('<ul>') && !match.includes('<ol>')) {
        return '<ul>' + match + '</ul>';
      }
      return match;
    });
    text = text.replace(/<\/ul>\s*<ul>/g, '');

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

    // Clean up extra <br> tags around block elements
    text = text.replace(/<br>\s*<(h[1-6]|p|ul|ol|li|blockquote|hr)/gi, '<$1');
    text = text.replace(/<\/(h[1-6]|p|ul|ol|li|blockquote|hr)>\s*<br>/gi, '</$1>');

    // Clean up excessive line breaks (more than 2 consecutive)
    text = text.replace(/(<br>\s*){3,}/g, '<br><br>');

    return text;
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
   */
  private parseTableRow(row: string): string[] {
    const trimmed = row.trim().replace(/^\|/, '').replace(/\|$/, '');
    return trimmed.split('|').map(cell => cell.trim());
  }
}
