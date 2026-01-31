import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'aiResponseFormatter',
  standalone: true
})
export class AiResponseFormatterPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(value: string): SafeHtml {
    if (!value) return '';

    // Convert markdown-like formatting to HTML
    let formatted = value;

    // First, convert literal \n\n to actual line breaks
    formatted = formatted.replace(/\\n\\n/g, '\n\n');
    formatted = formatted.replace(/\\n/g, '\n');

    // Convert markdown tables to HTML tables FIRST (before other processing)
    formatted = this.convertMarkdownTables(formatted);

    // Headers
    formatted = formatted.replace(/### (.+)/g, '<h4 class="mt-3 mb-2 fw-bold">$1</h4>');
    formatted = formatted.replace(/## (.+)/g, '<h3 class="mt-3 mb-2 fw-bold">$1</h3>');
    formatted = formatted.replace(/# (.+)/g, '<h2 class="mt-3 mb-2 fw-bold">$1</h2>');

    // Bold and italic
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Lists - unordered
    formatted = formatted.replace(/^\* (.+)$/gm, '<li>$1</li>');
    formatted = formatted.replace(/^\- (.+)$/gm, '<li>$1</li>');
    formatted = formatted.replace(/(<li>.*<\/li>)\n(?!<li>)/g, '$1</ul>\n');
    formatted = formatted.replace(/(?<!<\/ul>)\n(<li>)/g, '\n<ul class="ms-3">$1');

    // Lists - ordered
    formatted = formatted.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    // Line breaks and paragraphs (skip if already contains HTML table)
    formatted = formatted.split('\n\n').map(para => {
      if (para.trim() && !para.includes('<h') && !para.includes('<ul') && !para.includes('<li') && !para.includes('<table')) {
        return `<p class="mb-2">${para}</p>`;
      }
      return para;
    }).join('\n');

    // Code blocks
    formatted = formatted.replace(/```(.+?)```/gs, '<pre class="bg-light p-2 rounded">$1</pre>');
    formatted = formatted.replace(/`(.+?)`/g, '<code class="bg-light px-1">$1</code>');

    // Links
    formatted = formatted.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" class="text-primary">$1</a>');

    // Cleanup any remaining list tags
    formatted = formatted.replace(/<\/ul>\n<ul class="ms-3">/g, '');

    return this.sanitizer.bypassSecurityTrustHtml(formatted);
  }

  /**
   * Convert markdown tables to HTML tables
   * Supports standard markdown table format with | separators
   */
  private convertMarkdownTables(text: string): string {
    const lines = text.split('\n');
    let result: string[] = [];
    let inTable = false;
    let tableRows: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Check if this line is a table row (starts and ends with | or has multiple |)
      const isTableRow = line.includes('|') && (line.match(/\|/g) || []).length >= 2;
      const isSeparatorRow = /^\|?[\s\-:|]+\|?$/.test(line) && line.includes('-');

      if (isTableRow && !isSeparatorRow) {
        if (!inTable) {
          inTable = true;
          tableRows = [];
        }
        tableRows.push(line);
      } else if (isSeparatorRow && inTable) {
        // Skip separator row, it's just for markdown formatting
        continue;
      } else {
        // Not a table row - if we were in a table, close it
        if (inTable && tableRows.length > 0) {
          result.push(this.buildHtmlTable(tableRows));
          tableRows = [];
          inTable = false;
        }
        result.push(lines[i]); // Keep original line (not trimmed)
      }
    }

    // Handle table at end of text
    if (inTable && tableRows.length > 0) {
      result.push(this.buildHtmlTable(tableRows));
    }

    return result.join('\n');
  }

  /**
   * Build HTML table from markdown table rows
   */
  private buildHtmlTable(rows: string[]): string {
    if (rows.length === 0) return '';

    let html = '<div class="table-responsive"><table class="table table-sm table-hover table-bordered chronology-table">';

    rows.forEach((row, index) => {
      // Parse cells from the row
      const cells = row.split('|')
        .map(cell => cell.trim())
        .filter(cell => cell !== ''); // Remove empty strings from leading/trailing |

      if (cells.length === 0) return;

      if (index === 0) {
        // Header row
        html += '<thead class="table-light"><tr>';
        cells.forEach(cell => {
          html += `<th class="text-nowrap">${cell}</th>`;
        });
        html += '</tr></thead><tbody>';
      } else {
        // Data row
        html += '<tr>';
        cells.forEach((cell, cellIndex) => {
          // Apply special styling based on column
          let cellClass = '';
          if (cellIndex === 0) cellClass = 'text-nowrap'; // Date column
          if (cellIndex === 2) cellClass = 'text-center'; // Type column
          html += `<td class="${cellClass}">${cell}</td>`;
        });
        html += '</tr>';
      }
    });

    html += '</tbody></table></div>';
    return html;
  }
}