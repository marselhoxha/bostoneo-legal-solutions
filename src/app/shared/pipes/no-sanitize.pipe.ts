import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import DOMPurify from 'dompurify';

@Pipe({
  name: 'noSanitize',
  standalone: true
})
export class NoSanitizePipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(value: string): SafeHtml {
    if (!value) {
      return '';
    }

    // SECURITY: Sanitize with DOMPurify before bypassing Angular's sanitizer
    const clean = DOMPurify.sanitize(value, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div', 'table', 'thead',
        'tbody', 'tr', 'td', 'th', 'pre', 'code', 'blockquote', 'img', 'hr',
        'sup', 'sub', 'mark', 'del', 'ins'],
      ALLOWED_ATTR: ['href', 'target', 'class', 'style', 'src', 'alt', 'width',
        'height', 'colspan', 'rowspan']
    });
    return this.sanitizer.bypassSecurityTrustHtml(clean);
  }
}
