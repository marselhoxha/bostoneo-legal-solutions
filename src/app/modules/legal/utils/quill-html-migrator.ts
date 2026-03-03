/**
 * quill-html-migrator.ts
 *
 * Backward-compatibility utility for documents stored with Quill-specific HTML.
 * Converts Quill markup into standard HTML that CKEditor 5 can render natively.
 *
 * Handles:
 * - <pre class="ql-syntax"> containing pipe-delimited table content → <table>
 * - ql-indent-* classes → standard CSS margin
 * - ql-align-* classes → text-align styles
 * - ql-font-* / ql-size-* classes → inline font styles
 */

export class QuillHtmlMigrator {

  /**
   * Migrate Quill-specific HTML to standard HTML compatible with CKEditor 5.
   * Safe to call on non-Quill HTML — it only transforms known Quill patterns.
   */
  static migrate(html: string): string {
    if (!html) return html;

    // 1. Convert <pre class="ql-syntax"> table blocks to real <table> HTML
    html = QuillHtmlMigrator.convertPreTablesToHtml(html);

    // 2. Convert ql-indent-* classes to inline margin
    html = QuillHtmlMigrator.convertIndentClasses(html);

    // 3. Convert ql-align-* classes to text-align styles
    html = QuillHtmlMigrator.convertAlignClasses(html);

    // 4. Convert ql-font-* classes to inline font-family
    html = QuillHtmlMigrator.convertFontClasses(html);

    // 5. Convert ql-size-* classes to inline font-size
    html = QuillHtmlMigrator.convertSizeClasses(html);

    // 6. Remove any remaining ql-* classes that CKEditor won't recognize
    html = QuillHtmlMigrator.removeOrphanedQuillClasses(html);

    return html;
  }

  /**
   * Detect if HTML contains Quill-specific markup that needs migration.
   */
  static needsMigration(html: string): boolean {
    if (!html) return false;
    return /class="[^"]*ql-/.test(html) || /<pre\s+class="ql-syntax"/.test(html);
  }

  /**
   * Convert <pre class="ql-syntax"> blocks that contain pipe-delimited text
   * back into proper HTML <table> elements.
   */
  private static convertPreTablesToHtml(html: string): string {
    // Match <pre class="ql-syntax">...</pre> blocks
    return html.replace(/<pre\s+class="ql-syntax">([\s\S]*?)<\/pre>/gi, (match, content) => {
      // Check if content looks like a pipe-delimited table
      const lines = content.split('\n').filter((line: string) => line.trim().length > 0);

      if (lines.length < 2) return match; // Not a table

      // Check if lines contain pipe separators
      const hasPipes = lines.some((line: string) => line.includes('|'));
      if (!hasPipes) return match; // Not a table, keep as code block

      // Parse the table lines
      const rows: string[][] = [];
      let headerRowIndex = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Skip separator rows (---+--- or ---|---)
        if (/^[-\s|+]+$/.test(line) && line.includes('-')) {
          headerRowIndex = i;
          continue;
        }

        // Parse cells from pipe-delimited row
        const cells = line.split('|')
          .map((cell: string) => cell.trim())
          .filter((cell: string) => cell.length > 0);

        if (cells.length > 0) {
          rows.push(cells);
        }
      }

      if (rows.length === 0) return match;

      // Build HTML table
      let tableHtml = '<figure class="table"><table><thead><tr>';

      // First row is header
      const headerRow = rows[0];
      for (const cell of headerRow) {
        tableHtml += `<th>${QuillHtmlMigrator.escapeHtml(cell)}</th>`;
      }
      tableHtml += '</tr></thead><tbody>';

      // Data rows
      for (let i = 1; i < rows.length; i++) {
        tableHtml += '<tr>';
        for (let c = 0; c < headerRow.length; c++) {
          const cell = rows[i][c] || '';
          tableHtml += `<td>${QuillHtmlMigrator.escapeHtml(cell)}</td>`;
        }
        tableHtml += '</tr>';
      }

      tableHtml += '</tbody></table></figure>';
      return tableHtml;
    });
  }

  /**
   * Convert ql-indent-N classes to inline margin-left styles.
   * Quill uses ql-indent-1 through ql-indent-8 (each level = 3em).
   */
  private static convertIndentClasses(html: string): string {
    return html.replace(/class="([^"]*ql-indent-(\d+)[^"]*)"/gi, (match, classes, level) => {
      const indentEm = parseInt(level, 10) * 3;
      const cleanedClasses = classes.replace(/ql-indent-\d+/g, '').trim();
      const classAttr = cleanedClasses ? ` class="${cleanedClasses}"` : '';
      return `${classAttr} style="margin-left: ${indentEm}em"`;
    });
  }

  /**
   * Convert ql-align-* classes to text-align inline styles.
   */
  private static convertAlignClasses(html: string): string {
    const alignments = ['center', 'right', 'justify'];

    for (const align of alignments) {
      const regex = new RegExp(`class="([^"]*ql-align-${align}[^"]*)"`, 'gi');
      html = html.replace(regex, (match, classes) => {
        const cleanedClasses = classes.replace(new RegExp(`ql-align-${align}`, 'g'), '').trim();
        const classAttr = cleanedClasses ? ` class="${cleanedClasses}"` : '';
        return `${classAttr} style="text-align: ${align}"`;
      });
    }

    return html;
  }

  /**
   * Convert ql-font-* classes to inline font-family styles.
   */
  private static convertFontClasses(html: string): string {
    const fontMap: Record<string, string> = {
      'serif': 'Georgia, Times New Roman, serif',
      'monospace': 'Courier New, Courier, monospace',
      'sans-serif': 'Rubik, Arial, sans-serif'
    };

    return html.replace(/class="([^"]*ql-font-(\w+)[^"]*)"/gi, (match, classes, font) => {
      const fontFamily = fontMap[font] || font;
      const cleanedClasses = classes.replace(/ql-font-\w+/g, '').trim();
      const classAttr = cleanedClasses ? ` class="${cleanedClasses}"` : '';
      return `${classAttr} style="font-family: ${fontFamily}"`;
    });
  }

  /**
   * Convert ql-size-* classes to inline font-size styles.
   */
  private static convertSizeClasses(html: string): string {
    const sizeMap: Record<string, string> = {
      'small': '0.75em',
      'large': '1.5em',
      'huge': '2.5em'
    };

    return html.replace(/class="([^"]*ql-size-(\w+)[^"]*)"/gi, (match, classes, size) => {
      const fontSize = sizeMap[size] || size;
      const cleanedClasses = classes.replace(/ql-size-\w+/g, '').trim();
      const classAttr = cleanedClasses ? ` class="${cleanedClasses}"` : '';
      return `${classAttr} style="font-size: ${fontSize}"`;
    });
  }

  /**
   * Remove any remaining ql-* classes that weren't converted.
   * This prevents CKEditor from seeing unknown classes.
   */
  private static removeOrphanedQuillClasses(html: string): string {
    return html.replace(/class="([^"]*)"/gi, (match, classes) => {
      const cleaned = classes
        .split(/\s+/)
        .filter((cls: string) => !cls.startsWith('ql-'))
        .join(' ')
        .trim();
      return cleaned ? `class="${cleaned}"` : '';
    });
  }

  /** Escape HTML special characters */
  private static escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
