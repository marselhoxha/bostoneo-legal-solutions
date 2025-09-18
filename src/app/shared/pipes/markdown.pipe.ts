import { Pipe, PipeTransform } from '@angular/core';
import { marked } from 'marked';

@Pipe({
  name: 'markdown'
})
export class MarkdownPipe implements PipeTransform {
  
  constructor() {
    // Configure marked options for better rendering
    marked.setOptions({
      breaks: true,
      gfm: true
    });
  }

  transform(value: string): string {
    if (!value) return '';
    
    try {
      return marked.parse(value) as string;
    } catch (error) {
      console.error('Markdown parsing error:', error);
      return value; // Return original text if parsing fails
    }
  }
}