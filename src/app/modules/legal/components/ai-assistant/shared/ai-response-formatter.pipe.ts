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

    // Check if content is already HTML (from AI Workspace)
    const isHtml = formatted.includes('<p>') || formatted.includes('<h1>') || formatted.includes('<div');

    if (isHtml) {
      // Content is HTML - convert markdown tables embedded within
      formatted = this.convertTablesInHtml(formatted);
      return this.sanitizer.bypassSecurityTrustHtml(formatted);
    }

    // First, convert literal \n\n to actual line breaks
    formatted = formatted.replace(/\\n\\n/g, '\n\n');
    formatted = formatted.replace(/\\n/g, '\n');

    // Convert markdown tables to HTML tables FIRST (before other processing)
    formatted = this.convertAllTables(formatted);

    // Headers
    formatted = formatted.replace(/### (.+)/g, '<h4 class="mt-3 mb-2 fw-bold">$1</h4>');
    formatted = formatted.replace(/## (.+)/g, '<h3 class="mt-3 mb-2 fw-bold">$1</h3>');
    formatted = formatted.replace(/# (.+)/g, '<h2 class="mt-3 mb-2 fw-bold">$1</h2>');

    // Bold and italic
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Process lists using a more robust method
    formatted = this.processLists(formatted);

    // Line breaks and paragraphs (skip if already contains HTML elements)
    formatted = formatted.split('\n\n').map(para => {
      if (para.trim() &&
          !para.includes('<h') &&
          !para.includes('<ul') &&
          !para.includes('<ol') &&
          !para.includes('<li') &&
          !para.includes('<table') &&
          !para.includes('<div') &&
          !para.includes('</ul>') &&
          !para.includes('</ol>')) {
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
    formatted = formatted.replace(/<\/ul>\n<ul class="ai-list">/g, '');

    return this.sanitizer.bypassSecurityTrustHtml(formatted);
  }

  /**
   * Process markdown lists (both ordered and unordered) into HTML
   * Handles emoji-prefixed items and treats all indented items as flat list items
   */
  private processLists(text: string): string {
    const lines = text.split('\n');
    const result: string[] = [];
    let inUnorderedList = false;
    let inOrderedList = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Trim whitespace to handle indented list items as flat items
      const trimmedLine = line.trim();

      // Skip empty lines but close lists first
      if (!trimmedLine) {
        if (inUnorderedList) {
          result.push('</ul>');
          inUnorderedList = false;
        }
        if (inOrderedList) {
          result.push('</ol>');
          inOrderedList = false;
        }
        result.push(line);
        continue;
      }

      // Check for unordered list item (- or * at start)
      // Handle both "- item" and "  - item" (indented) as flat list items
      const unorderedMatch = trimmedLine.match(/^[-*]\s+(.+)$/);
      // Check for ordered list item (number. at start)
      const orderedMatch = trimmedLine.match(/^(\d+)\.\s+(.+)$/);

      if (unorderedMatch) {
        // Start unordered list if not already in one
        if (!inUnorderedList) {
          if (inOrderedList) {
            result.push('</ol>');
            inOrderedList = false;
          }
          result.push('<ul class="ai-list">');
          inUnorderedList = true;
        }
        result.push(`<li>${unorderedMatch[1]}</li>`);
      } else if (orderedMatch) {
        const content = orderedMatch[2];
        // Check if this is a section header (ALL CAPS or ends with colon)
        const isAllCaps = /^[A-Z][A-Z\s&]+$/.test(content);
        const endsWithColon = /^[A-Z][A-Za-z\s&]+:$/.test(content);

        if (isAllCaps || endsWithColon) {
          // Close any open lists first
          if (inUnorderedList) {
            result.push('</ul>');
            inUnorderedList = false;
          }
          if (inOrderedList) {
            result.push('</ol>');
            inOrderedList = false;
          }
          // Render as section header
          const title = content.replace(/:$/, '');
          result.push(`<div class="ai-section-header"><span class="section-number">${orderedMatch[1]}</span><span class="section-title">${title}</span></div>`);
        } else {
          // Regular ordered list item
          if (!inOrderedList) {
            if (inUnorderedList) {
              result.push('</ul>');
              inUnorderedList = false;
            }
            result.push('<ol class="ai-ordered-list">');
            inOrderedList = true;
          }
          result.push(`<li>${content}</li>`);
        }
      } else {
        // Not a list item - close any open lists
        if (inUnorderedList) {
          result.push('</ul>');
          inUnorderedList = false;
        }
        if (inOrderedList) {
          result.push('</ol>');
          inOrderedList = false;
        }
        result.push(line);
      }
    }

    // Close any remaining open lists
    if (inUnorderedList) {
      result.push('</ul>');
    }
    if (inOrderedList) {
      result.push('</ol>');
    }

    return result.join('\n');
  }

  /**
   * Convert markdown tables embedded within HTML content.
   * Uses a position-tracking approach to preserve all content around tables.
   */
  private convertTablesInHtml(html: string): string {
    const pTagRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let result = '';
    let lastIndex = 0;
    let tableRows: string[] = [];
    let tableStartIndex = -1;
    let match: RegExpExecArray | null;

    while ((match = pTagRegex.exec(html)) !== null) {
      const fullMatch = match[0];
      const innerContent = match[1];
      const matchStart = match.index;
      const matchEnd = pTagRegex.lastIndex;

      // Strip HTML tags to check for pipes (handles <strong>|</strong> cases)
      const textOnly = innerContent.replace(/<[^>]*>/g, '').trim();
      const hasPipes = textOnly.includes('|') && textOnly.split('|').length >= 2;
      const isSeparator = /^[\s\|\-:]+$/.test(textOnly) && textOnly.includes('-');

      if (hasPipes || isSeparator) {
        if (tableStartIndex === -1) {
          // Save content before table
          result += html.substring(lastIndex, matchStart);
          tableStartIndex = matchStart;
        }
        if (!isSeparator) {
          tableRows.push(textOnly);
        }
        lastIndex = matchEnd;
      } else {
        // Flush any collected table
        if (tableRows.length > 0) {
          result += this.buildHtmlTable(tableRows);
          tableRows = [];
          tableStartIndex = -1;
        }
        // Add content up to and including this non-table paragraph
        result += html.substring(lastIndex, matchEnd);
        lastIndex = matchEnd;
      }
    }

    // Flush remaining table
    if (tableRows.length > 0) {
      result += this.buildHtmlTable(tableRows);
    }

    // Add remaining content
    if (lastIndex < html.length) {
      result += html.substring(lastIndex);
    }

    return result;
  }

  /**
   * Convert all markdown tables to HTML
   */
  private convertAllTables(text: string): string {
    // Step 1: Normalize - remove ALL whitespace-only lines between pipe lines
    let lines = text.split('\n');

    let normalized: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      // Skip empty lines that are between pipe lines
      if (trimmed === '') {
        const prevHasPipe = normalized.length > 0 && normalized[normalized.length - 1].includes('|');
        let nextHasPipe = false;
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].trim() !== '') {
            nextHasPipe = lines[j].includes('|');
            break;
          }
        }
        if (prevHasPipe && nextHasPipe) {
          continue; // Skip this empty line
        }
      }
      normalized.push(lines[i]);
    }

    // Step 2: Process normalized lines
    const result: string[] = [];
    let i = 0;

    while (i < normalized.length) {
      const line = normalized[i].trim();

      // Detect table: line contains | and has multiple cells
      if (line.includes('|') && line.split('|').length >= 3) {
        const tableRows: string[] = [];
        let hasSeparator = false;
        let j = i;

        while (j < normalized.length) {
          const curr = normalized[j].trim();

          if (curr === '') {
            j++;
            continue;
          }

          if (!curr.includes('|')) {
            break;
          }

          // Is this a separator? Check if it has dashes and pipes but no letters/numbers
          const withoutPipesAndDashes = curr.replace(/[\|\-:\s]/g, '');
          const isSep = withoutPipesAndDashes === '' && curr.includes('-');

          if (isSep) {
            hasSeparator = true;
          } else {
            tableRows.push(curr);
          }
          j++;
        }

        if (hasSeparator && tableRows.length >= 1) {
          result.push(this.buildHtmlTable(tableRows));
        } else {
          for (let k = i; k < j; k++) {
            result.push(normalized[k]);
          }
        }
        i = j;
      } else {
        result.push(normalized[i]);
        i++;
      }
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