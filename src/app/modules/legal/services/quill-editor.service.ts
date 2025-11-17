import { Injectable } from '@angular/core';
import Quill from 'quill';

export interface QuillSelection {
  index: number;
  length: number;
}

@Injectable({
  providedIn: 'root'
})
export class QuillEditorService {

  /**
   * Get plain text from Quill editor
   */
  getPlainText(quill: Quill): string {
    return quill.getText();
  }

  /**
   * Get HTML content from Quill editor
   */
  getHtmlContent(quill: Quill): string {
    return quill.root.innerHTML;
  }

  /**
   * Get selected text from Quill editor
   */
  getSelectedText(quill: Quill, selection: QuillSelection): string {
    return quill.getText(selection.index, selection.length);
  }

  /**
   * Replace text at specific position using Quill operations
   */
  replaceText(
    quill: Quill,
    index: number,
    length: number,
    newText: string
  ): void {
    // Delete old text
    quill.deleteText(index, length);
    // Insert new text at same position
    quill.insertText(index, newText);
  }

  /**
   * Replace text with temporary highlight
   */
  replaceTextWithHighlight(
    quill: Quill,
    index: number,
    length: number,
    newText: string,
    highlightColor: string = '#d4edda',
    highlightDuration: number = 4000
  ): void {
    // Replace text
    this.replaceText(quill, index, length, newText);

    // Apply highlight
    this.highlightText(quill, index, newText.length, highlightColor);

    // Remove highlight after duration
    setTimeout(() => {
      this.removeHighlight(quill, index, newText.length);
    }, highlightDuration);
  }

  /**
   * Highlight text with background color
   */
  highlightText(
    quill: Quill,
    index: number,
    length: number,
    color: string
  ): void {
    quill.formatText(index, length, {
      'background': color
    });
  }

  /**
   * Remove highlight from text
   */
  removeHighlight(quill: Quill, index: number, length: number): void {
    quill.formatText(index, length, {
      'background': false
    });
  }

  /**
   * Set editor content from HTML
   */
  setContentFromHtml(quill: Quill, htmlContent: string): void {
    const delta = quill.clipboard.convert({ html: htmlContent });
    quill.setContents(delta);
  }

  /**
   * Set editor content from plain text
   */
  setContentFromText(quill: Quill, text: string): void {
    quill.setText(text);
  }

  /**
   * Clear editor content
   */
  clearContent(quill: Quill): void {
    quill.setText('');
  }

  /**
   * Count words in Quill editor
   */
  countWords(quill: Quill): number {
    const text = quill.getText().trim();
    if (!text) return 0;
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Get current selection range
   */
  getSelection(quill: Quill): QuillSelection | null {
    const selection = quill.getSelection();
    return selection ? { index: selection.index, length: selection.length } : null;
  }

  /**
   * Set selection range
   */
  setSelection(quill: Quill, index: number, length: number = 0): void {
    quill.setSelection(index, length);
  }

  /**
   * Focus editor
   */
  focus(quill: Quill): void {
    quill.focus();
  }

  /**
   * Disable editor
   */
  disable(quill: Quill): void {
    quill.enable(false);
  }

  /**
   * Enable editor
   */
  enable(quill: Quill): void {
    quill.enable(true);
  }

  /**
   * Apply text size to editor
   */
  applyTextSize(quill: Quill, fontSize: number): void {
    const editorElement = quill.root;
    editorElement.style.fontSize = `${fontSize}px`;
  }
}
