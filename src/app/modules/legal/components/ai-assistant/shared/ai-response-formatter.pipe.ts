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

    // Line breaks and paragraphs
    formatted = formatted.split('\n\n').map(para => {
      if (para.trim() && !para.includes('<h') && !para.includes('<ul') && !para.includes('<li')) {
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
}