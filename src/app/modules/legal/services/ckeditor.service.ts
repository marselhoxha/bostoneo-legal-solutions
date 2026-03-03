import { Injectable } from '@angular/core';

/**
 * CKEditorService — drop-in replacement for QuillEditorService.
 *
 * CKEditor 5 uses a tree-based model (not flat character indices), so this
 * service provides helpers to bridge between the text-offset world used by
 * the diff-based transformation feature and CKEditor's model positions.
 *
 * Every public method mirrors the QuillEditorService API surface.
 */

export interface EditorSelection {
  index: number;
  length: number;
}

@Injectable({
  providedIn: 'root'
})
export class CKEditorService {

  // ── Plain text & HTML ──────────────────────────────

  /** Get plain text content from the editor */
  getPlainText(editor: any): string {
    if (!editor) return '';
    // Get text content from the editing view's root element
    const viewRoot = editor.editing.view.document.getRoot();
    if (!viewRoot) return '';
    return this.extractTextFromViewElement(viewRoot);
  }

  /** Get HTML content from the editor */
  getHtmlContent(editor: any): string {
    if (!editor) return '';
    return editor.getData();
  }

  /** Get selected text from the editor */
  getSelectedText(editor: any, selection?: EditorSelection): string {
    if (!editor) return '';

    // If a selection range is provided, extract text by offset
    if (selection && selection.length > 0) {
      const fullText = this.getPlainText(editor);
      return fullText.substring(selection.index, selection.index + selection.length);
    }

    // Otherwise use the model's current selection
    const modelSelection = editor.model.document.selection;
    const range = modelSelection.getFirstRange();
    if (!range || range.isCollapsed) return '';

    let text = '';
    for (const item of range.getItems()) {
      if (item.is('$text') || item.is('$textProxy')) {
        text += item.data;
      }
    }
    return text;
  }

  // ── Content manipulation ───────────────────────────

  /** Replace text at specific position by text offset */
  replaceText(editor: any, index: number, length: number, newText: string): void {
    if (!editor) return;

    const fullText = this.getPlainText(editor);
    const findStr = fullText.substring(index, index + length);
    if (!findStr) return;

    editor.model.change((writer: any) => {
      const root = editor.model.document.getRoot();
      const range = this.findTextInModel(editor, findStr, root);
      if (range) {
        const parent = range.start.parent;
        const startOffset = range.start.offset;
        writer.remove(range);
        writer.insertText(newText, writer.createPositionAt(parent, startOffset));
      }
    });
  }

  /** Replace text with temporary highlight.
   *  @param textToFind  Optional — the exact text to search for in the model.
   *                     When provided, bypasses the index-based lookup (which can
   *                     fail due to view-vs-model offset mismatches with newlines).
   */
  replaceTextWithHighlight(
    editor: any,
    index: number,
    length: number,
    newText: string,
    highlightColor: string = '#d4edda',
    highlightDuration: number = 4000,
    textToFind?: string
  ): void {
    if (!editor) return;

    let findStr: string;
    if (textToFind) {
      findStr = textToFind;
    } else {
      const fullText = this.getPlainText(editor);
      findStr = fullText.substring(index, index + length);
    }
    if (!findStr) return;

    editor.model.change((writer: any) => {
      const root = editor.model.document.getRoot();
      const range = this.findTextInModel(editor, findStr, root);
      if (range) {
        // Capture stable references BEFORE removal — range.start becomes stale
        // after writer.remove() because CKEditor post-fixers can merge empty
        // blocks into adjacent headings, making range.start point to the wrong element.
        const parent = range.start.parent;
        const startOffset = range.start.offset;

        writer.remove(range);

        // Create fresh positions from the saved parent + offset
        const insertPos = writer.createPositionAt(parent, startOffset);
        writer.insertText(newText, insertPos);

        // Apply highlight marker using fresh positions
        const hlStart = writer.createPositionAt(parent, startOffset);
        const hlEnd = writer.createPositionAt(parent, startOffset + newText.length);
        const highlightRange = writer.createRange(hlStart, hlEnd);
        writer.setAttribute('highlight', 'greenMarker', highlightRange);
      }
    });

    // Remove highlight after duration (0 = persistent, controlled externally)
    if (highlightDuration > 0) {
      setTimeout(() => {
        this.removeAllHighlights(editor);
      }, highlightDuration);
    }
  }

  /** Highlight text by offset range */
  highlightText(editor: any, index: number, length: number, _color: string): void {
    if (!editor) return;

    const fullText = this.getPlainText(editor);
    const findStr = fullText.substring(index, index + length);
    if (!findStr) return;

    editor.model.change((writer: any) => {
      const root = editor.model.document.getRoot();
      const range = this.findTextInModel(editor, findStr, root);
      if (range) {
        writer.setAttribute('highlight', 'greenMarker', range);
      }
    });
  }

  /** Remove highlight from text by offset range */
  removeHighlight(editor: any, index: number, length: number): void {
    if (!editor) return;

    const fullText = this.getPlainText(editor);
    const findStr = fullText.substring(index, index + length);
    if (!findStr) return;

    editor.model.change((writer: any) => {
      const root = editor.model.document.getRoot();
      const range = this.findTextInModel(editor, findStr, root);
      if (range) {
        writer.removeAttribute('highlight', range);
      }
    });
  }

  /** Remove all highlights from entire document */
  removeAllHighlights(editor: any): void {
    if (!editor) return;

    editor.model.change((writer: any) => {
      const root = editor.model.document.getRoot();
      const fullRange = writer.createRangeIn(root);
      writer.removeAttribute('highlight', fullRange);
    });
  }

  // ── Content setting ────────────────────────────────

  /** Set editor content from HTML */
  setContentFromHtml(editor: any, htmlContent: string): void {
    if (!editor) return;
    editor.setData(htmlContent);
  }

  /** Set editor content from plain text */
  setContentFromText(editor: any, text: string): void {
    if (!editor) return;
    editor.setData(`<p>${text}</p>`);
  }

  /** Clear editor content */
  clearContent(editor: any): void {
    if (!editor) return;
    editor.setData('');
  }

  // ── Word count ─────────────────────────────────────

  /** Count words in editor content */
  countWords(editor: any): number {
    const text = this.getPlainText(editor).trim();
    if (!text) return 0;
    return text.split(/\s+/).filter((word: string) => word.length > 0).length;
  }

  // ── Selection ──────────────────────────────────────

  /** Get current selection as text offsets */
  getSelection(editor: any): EditorSelection | null {
    if (!editor) return null;

    const modelSelection = editor.model.document.selection;
    const range = modelSelection.getFirstRange();
    if (!range || range.isCollapsed) return null;

    // Convert model range to text offsets
    const offsets = this.modelRangeToTextOffsets(editor, range);
    return offsets;
  }

  /** Focus editor */
  focus(editor: any): void {
    if (!editor) return;
    editor.editing.view.focus();
  }

  // ── Read-only mode ─────────────────────────────────

  /** Disable editor (read-only) */
  disable(editor: any): void {
    if (!editor) return;
    editor.enableReadOnlyMode('ckeditor-service-lock');
  }

  /** Enable editor */
  enable(editor: any): void {
    if (!editor) return;
    editor.disableReadOnlyMode('ckeditor-service-lock');
  }

  // ── Font size ──────────────────────────────────────

  /** Apply text size to editor container */
  applyTextSize(editor: any, fontSize: number): void {
    if (!editor) return;
    const editableElement = editor.editing.view.getDomRoot();
    if (editableElement) {
      editableElement.style.fontSize = `${fontSize}px`;
    }
  }

  // ── Private helpers ────────────────────────────────

  /**
   * Extract plain text from a CKEditor view element tree.
   * Walks all child nodes recursively, concatenating text nodes
   * and adding newlines for block-level boundaries.
   */
  private extractTextFromViewElement(element: any): string {
    let text = '';
    for (const child of element.getChildren()) {
      if (child.is('$text') || child.is('text')) {
        text += child.data;
      } else if (child.is('element')) {
        // Add newline before block elements
        const blockElements = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'tr', 'div', 'blockquote', 'pre'];
        if (blockElements.includes(child.name) && text.length > 0 && !text.endsWith('\n')) {
          text += '\n';
        }
        text += this.extractTextFromViewElement(child);
        // Add newline after block elements
        if (blockElements.includes(child.name) && !text.endsWith('\n')) {
          text += '\n';
        }
      }
    }
    return text;
  }

  /**
   * Find a text string in the model tree and return its range.
   * Walks all text nodes in document order to locate the string.
   */
  private findTextInModel(editor: any, searchStr: string, root: any): any {
    const model = editor.model;

    // Collect all text with position tracking
    const textNodes: Array<{ node: any; offset: number; text: string }> = [];
    let fullText = '';

    const treeWalker = model.createRangeIn(root).getWalker({ ignoreElementEnd: true });

    for (const value of treeWalker) {
      if (value.type === 'text') {
        textNodes.push({
          node: value.item,
          offset: fullText.length,
          text: value.item.data
        });
        fullText += value.item.data;
      }
    }

    // Find the search string position in concatenated text
    const textIndex = fullText.indexOf(searchStr);
    if (textIndex === -1) return null;

    // Map text index to model positions
    const startPos = this.textOffsetToModelPosition(model, textNodes, textIndex);
    const endPos = this.textOffsetToModelPosition(model, textNodes, textIndex + searchStr.length);

    if (!startPos || !endPos) return null;
    return model.createRange(startPos, endPos);
  }

  /**
   * Convert a flat text offset to a CKEditor model position.
   */
  private textOffsetToModelPosition(
    model: any,
    textNodes: Array<{ node: any; offset: number; text: string }>,
    targetOffset: number
  ): any {
    for (const entry of textNodes) {
      const entryEnd = entry.offset + entry.text.length;
      if (targetOffset >= entry.offset && targetOffset <= entryEnd) {
        const localOffset = targetOffset - entry.offset;
        // Create position relative to the parent element
        const parent = entry.node.parent;
        const nodeOffset = entry.node.startOffset;
        return model.createPositionAt(parent, nodeOffset + localOffset);
      }
    }
    return null;
  }

  /**
   * Convert a CKEditor model range back to flat text offsets.
   */
  private modelRangeToTextOffsets(editor: any, range: any): EditorSelection | null {
    const model = editor.model;
    const root = model.document.getRoot();

    const textNodes: Array<{ node: any; offset: number; text: string }> = [];
    let fullText = '';

    const treeWalker = model.createRangeIn(root).getWalker({ ignoreElementEnd: true });
    for (const value of treeWalker) {
      if (value.type === 'text') {
        textNodes.push({
          node: value.item,
          offset: fullText.length,
          text: value.item.data
        });
        fullText += value.item.data;
      }
    }

    // Find the start offset
    let startIndex = -1;
    let endIndex = -1;

    for (const entry of textNodes) {
      const node = entry.node;
      // Check if range start is in this text node
      if (startIndex === -1) {
        if (range.start.parent === node.parent) {
          const nodeStart = node.startOffset;
          if (range.start.offset >= nodeStart && range.start.offset <= nodeStart + entry.text.length) {
            startIndex = entry.offset + (range.start.offset - nodeStart);
          }
        }
      }
      // Check if range end is in this text node
      if (endIndex === -1) {
        if (range.end.parent === node.parent) {
          const nodeStart = node.startOffset;
          if (range.end.offset >= nodeStart && range.end.offset <= nodeStart + entry.text.length) {
            endIndex = entry.offset + (range.end.offset - nodeStart);
          }
        }
      }
    }

    if (startIndex === -1 || endIndex === -1) return null;
    return { index: startIndex, length: endIndex - startIndex };
  }
}
