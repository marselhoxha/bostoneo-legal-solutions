import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'markdownToHtml',
  standalone: true
})
export class MarkdownToHtmlPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(value: string): SafeHtml {
    if (!value) return '';

    // Convert markdown to HTML
    let html = value;

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h5 class="text-primary mt-4 mb-3">$1</h5>');
    html = html.replace(/^## (.*$)/gim, '<h4 class="text-dark mt-4 mb-3 fw-bold">$1</h4>');
    html = html.replace(/^# (.*$)/gim, '<h3 class="text-dark mt-4 mb-3 fw-bold">$1</h3>');

    // Bold text
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic text
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Lists
    html = html.replace(/^\* (.+)$/gim, '<li class="mb-2">$1</li>');
    html = html.replace(/^- (.+)$/gim, '<li class="mb-2">$1</li>');
    html = html.replace(/^\d+\. (.+)$/gim, '<li class="mb-2">$1</li>');

    // Wrap consecutive list items
    html = html.replace(/(<li class="mb-2">.*<\/li>\n?)+/g, function(match) {
      return '<ul class="list-unstyled ps-3">' + match + '</ul>';
    });

    // Paragraphs
    html = html.replace(/\n\n/g, '</p><p class="mb-3">');
    html = '<p class="mb-3">' + html + '</p>';

    // Clean up
    html = html.replace(/<p class="mb-3"><\/p>/g, '');
    html = html.replace(/<p class="mb-3">(<h[1-6])/g, '$1');
    html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');
    html = html.replace(/<p class="mb-3">(<ul)/g, '$1');
    html = html.replace(/(<\/ul>)<\/p>/g, '$1');

    // Horizontal rule
    html = html.replace(/^---$/gim, '<hr class="my-4">');

    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
}