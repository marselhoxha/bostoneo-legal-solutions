import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'markdownToHtml',
  standalone: true
})
export class MarkdownToHtmlPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(value: string): SafeHtml {
    if (!value) {
      return '';
    }

    // DEBUG: Check what we're receiving for links
    if (value.includes('[IRC') || value.includes('[USC') || value.includes('[26 U.S.C')) {
      console.log('📝 Markdown input contains citations:', value.substring(0, 300));
      // Log specific citation patterns
      const citationMatch = value.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (citationMatch) {
        console.log('🔗 Found markdown link:', citationMatch[0]);
      }
    }

    // STEP 1: Process checkmark citations BEFORE markdown conversion (while still markdown syntax)
    let markdown = this.processCheckmarkCitations(value);

    // STEP 2: Convert markdown to HTML
    let html = this.convertMarkdownToHtml(markdown);

    // DEBUG: Check conversion result
    if (value.includes('[IRC') || value.includes('[USC')) {
      console.log('🔄 After markdown conversion:', html.substring(0, 500));
      // Check if links were converted
      if (html.includes('<a href=')) {
        console.log('✅ Links converted to HTML');
      } else {
        console.log('❌ Links NOT converted to HTML');
      }
    }

    // STEP 3: CREATE LINKS DIRECTLY (emergency fix - backend not injecting URLs)
    html = this.createCitationLinks(html);

    // STEP 4: Apply legal highlighting to the HTML output (NOT checkmarks - already processed)
    html = this.highlightLegalTerms(html);

    // DEBUG: Log a sample of the output to verify highlighting is applied
    if (html.includes('Hon.') || html.includes('M.G.L.')) {
      console.log('🔍 Legal highlighting applied. Sample:', html.substring(0, 500));
    }

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
      (match, linkText, url) => {
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

    return parts.join('');
  }

  private convertMarkdownToHtml(text: string): string {
    // Headers (must be done before other conversions)
    text = text.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
    text = text.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    text = text.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    text = text.replace(/^# (.*$)/gim, '<h1>$1</h1>');

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