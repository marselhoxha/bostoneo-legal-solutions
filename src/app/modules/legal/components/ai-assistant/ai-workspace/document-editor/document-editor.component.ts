import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CKEditorModule } from '@ckeditor/ckeditor5-angular';
import {
  ClassicEditor,
  Essentials,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading,
  Paragraph,
  BlockQuote,
  HorizontalLine,
  Link,
  List,
  Table,
  TableToolbar,
  TableProperties,
  TableCellProperties,
  Alignment,
  Indent,
  IndentBlock,
  Font,
  FindAndReplace,
  Highlight,
  GeneralHtmlSupport,
  PasteFromOffice,
  RemoveFormat,
  Undo,
  type EditorConfig
} from 'ckeditor5';

export interface SelectionChangeEvent {
  range: { index: number; length: number } | null;
  oldRange: { index: number; length: number } | null;
  source: string;
}

export interface ContentChangeEvent {
  html: string;
  text: string;
  source: string;
}

@Component({
  selector: 'app-document-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, CKEditorModule],
  templateUrl: './document-editor.component.html',
  styleUrls: ['./document-editor.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None
})
export class DocumentEditorComponent {
  @Input() content: string = '';
  @Input() readOnly: boolean = false;
  @Input() placeholder: string = 'Start writing...';

  @Output() contentChange = new EventEmitter<string>();
  @Output() selectionChange = new EventEmitter<SelectionChangeEvent>();
  @Output() contentChanged = new EventEmitter<ContentChangeEvent>();
  @Output() editorReady = new EventEmitter<ClassicEditor>();

  public Editor = ClassicEditor;

  public editorConfig: EditorConfig = {
    licenseKey: 'GPL',
    plugins: [
      Essentials,
      Bold,
      Italic,
      Underline,
      Strikethrough,
      Heading,
      Paragraph,
      BlockQuote,
      HorizontalLine,
      Link,
      List,
      Table,
      TableToolbar,
      TableProperties,
      TableCellProperties,
      Alignment,
      Indent,
      IndentBlock,
      Font,
      FindAndReplace,
      Highlight,
      GeneralHtmlSupport,
      PasteFromOffice,
      RemoveFormat,
      Undo
    ],
    toolbar: {
      items: [
        'undo', 'redo',
        '|',
        'heading',
        '|',
        'bold', 'italic', 'underline', 'strikethrough',
        '|',
        'link',
        '|',
        'alignment',
        '|',
        'bulletedList', 'numberedList',
        '|',
        'insertTable',
        '|',
        'outdent', 'indent',
        '|',
        'removeFormat'
      ],
      shouldNotGroupWhenFull: false
    },
    heading: {
      options: [
        { model: 'paragraph', title: 'Paragraph', class: 'ck-heading_paragraph' },
        { model: 'heading1', view: 'h1', title: 'Heading 1', class: 'ck-heading_heading1' },
        { model: 'heading2', view: 'h2', title: 'Heading 2', class: 'ck-heading_heading2' },
        { model: 'heading3', view: 'h3', title: 'Heading 3', class: 'ck-heading_heading3' },
        { model: 'heading4', view: 'h4', title: 'Heading 4', class: 'ck-heading_heading4' }
      ]
    },
    table: {
      contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells', 'tableProperties', 'tableCellProperties']
    },
    link: {
      defaultProtocol: 'https://',
      decorators: {
        openInNewTab: {
          mode: 'manual',
          label: 'Open in new tab',
          defaultValue: true,
          attributes: {
            target: '_blank',
            rel: 'noopener noreferrer'
          }
        }
      }
    },
    highlight: {
      options: [
        { model: 'greenMarker', class: 'marker-green', title: 'Green marker', color: '#d4edda', type: 'marker' as const },
        { model: 'yellowMarker', class: 'marker-yellow', title: 'Yellow marker', color: '#fff3cd', type: 'marker' as const }
      ]
    },
    htmlSupport: {
      allow: [
        { name: 'span', classes: true, styles: true, attributes: true },
        { name: 'a', classes: true, attributes: true, styles: true },
        { name: /^(div|section|article)$/, classes: true, styles: true, attributes: true },
        { name: /^(table|thead|tbody|tr|th|td)$/, classes: true, styles: true, attributes: true },
        { name: /^(h[1-6]|p|blockquote|pre|ul|ol|li)$/, classes: true, styles: true, attributes: true },
        { name: 'figure', classes: true, styles: true, attributes: true },
        { name: 'mark', classes: true, styles: true, attributes: true },
        { name: 'strong', classes: true, styles: true, attributes: true },
        { name: 'em', classes: true, styles: true, attributes: true }
      ]
    },
    placeholder: this.placeholder
  };

  private editorInstance: ClassicEditor | null = null;

  onReady(editor: ClassicEditor): void {
    this.editorInstance = editor;
    this.editorReady.emit(editor);

    // Set initial content if provided
    if (this.content) {
      editor.setData(this.content);
    }

    // Handle read-only mode
    if (this.readOnly) {
      editor.enableReadOnlyMode('document-editor-readonly');
    }
  }

  onChange({ editor }: any): void {
    const data = editor.getData();
    this.contentChange.emit(data);

    // Get plain text for word counting
    const viewRoot = editor.editing.view.document.getRoot();
    const plainText = viewRoot ? this.extractText(viewRoot) : '';

    this.contentChanged.emit({
      html: data,
      text: plainText,
      source: 'user'
    });
  }

  onSelectionChange({ editor }: any): void {
    if (!editor) return;

    const selection = editor.model.document.selection;
    const range = selection.getFirstRange();

    if (range && !range.isCollapsed) {
      // Extract selected text length
      let text = '';
      for (const item of range.getItems()) {
        if (item.is('$text') || item.is('$textProxy')) {
          text += item.data;
        }
      }

      // Convert to offset-based range for compatibility
      const offsets = this.getSelectionOffsets(editor, range);
      if (offsets) {
        this.selectionChange.emit({
          range: offsets,
          oldRange: null,
          source: 'user'
        });
      }
    } else {
      this.selectionChange.emit({
        range: null,
        oldRange: null,
        source: 'user'
      });
    }
  }

  getEditorInstance(): ClassicEditor | null {
    return this.editorInstance;
  }

  /** Extract plain text from a view element tree */
  private extractText(element: any): string {
    let text = '';
    for (const child of element.getChildren()) {
      if (child.is('$text') || child.is('text')) {
        text += child.data;
      } else if (child.is('element')) {
        const blockElements = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'tr', 'div', 'blockquote'];
        if (blockElements.includes(child.name) && text.length > 0 && !text.endsWith('\n')) {
          text += '\n';
        }
        text += this.extractText(child);
        if (blockElements.includes(child.name) && !text.endsWith('\n')) {
          text += '\n';
        }
      }
    }
    return text;
  }

  /** Convert model range to text offsets */
  private getSelectionOffsets(editor: any, range: any): { index: number; length: number } | null {
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

    let startIndex = -1;
    let endIndex = -1;

    for (const entry of textNodes) {
      const node = entry.node;
      if (startIndex === -1 && range.start.parent === node.parent) {
        const nodeStart = node.startOffset;
        if (range.start.offset >= nodeStart && range.start.offset <= nodeStart + entry.text.length) {
          startIndex = entry.offset + (range.start.offset - nodeStart);
        }
      }
      if (endIndex === -1 && range.end.parent === node.parent) {
        const nodeStart = node.startOffset;
        if (range.end.offset >= nodeStart && range.end.offset <= nodeStart + entry.text.length) {
          endIndex = entry.offset + (range.end.offset - nodeStart);
        }
      }
    }

    if (startIndex === -1 || endIndex === -1) return null;
    return { index: startIndex, length: endIndex - startIndex };
  }
}
