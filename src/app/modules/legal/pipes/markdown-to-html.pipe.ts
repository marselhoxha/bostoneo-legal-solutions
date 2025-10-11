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

    // Step 1: Convert markdown to HTML first
    let html = this.convertMarkdownToHtml(value);

    // Step 2: Apply legal highlighting to the HTML output
    html = this.highlightLegalTerms(html);

    // DEBUG: Log a sample of the output to verify highlighting is applied
    if (html.includes('Hon.') || html.includes('M.G.L.')) {
      console.log('🔍 Legal highlighting applied. Sample:', html.substring(0, 500));
    }

    // IMPORTANT: Use bypassSecurityTrustHtml to allow our custom HTML/CSS classes
    return this.sanitizer.bypassSecurityTrustHtml(html);
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

      // 1. Legal citations - specific patterns that appear in legal text
      text = text.replace(/Mass\.\s+R\.\s+Civ\.\s+P\.\s+\d+(?:\([a-z]\))?/gi, (match) =>
        `<span class="legal-citation">${match}</span>`);
      text = text.replace(/M\.G\.L\.\s+c\.\s+\d+B?/gi, (match) =>
        `<span class="legal-citation">${match}</span>`);

      // 2. Judge and doctor names (Hon., Dr., Judge, Justice + Name)
      text = text.replace(/\b((?:Hon\.|Dr\.|Judge|Justice)\s+[A-Z][a-z]+(?:\s+[A-Z]'?[A-Z]?[a-z]+)*(?:'s)?)\b/g, (match) =>
        `<span class="legal-judge">${match}</span>`);

      // 3. Dollar amounts with K suffix
      text = text.replace(/\$(\d{1,3}(?:,\d{3})*|\d+)K?\b/g, (match) =>
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

    // Links
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

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