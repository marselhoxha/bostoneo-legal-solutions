import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

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

    // SECURITY: Strip dangerous tags before bypassing Angular sanitizer.
    // For full protection, integrate DOMPurify: npm install dompurify @types/dompurify
    const stripped = value
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/javascript\s*:/gi, '');
    return this.sanitizer.bypassSecurityTrustHtml(stripped);
  }
} 