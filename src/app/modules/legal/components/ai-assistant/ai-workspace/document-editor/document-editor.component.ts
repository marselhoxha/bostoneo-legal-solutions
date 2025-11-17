import { Component, Input, Output, EventEmitter, ViewChild, ChangeDetectionStrategy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QuillModule } from 'ngx-quill';
import Quill from 'quill';

export interface SelectionChangeEvent {
  range: { index: number; length: number } | null;
  oldRange: { index: number; length: number } | null;
  source: string;
}

export interface ContentChangeEvent {
  delta: any;
  oldContents: any;
  source: string;
}

@Component({
  selector: 'app-document-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, QuillModule],
  templateUrl: './document-editor.component.html',
  styleUrls: ['./document-editor.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentEditorComponent implements AfterViewInit {
  @Input() content: string = '';
  @Input() readOnly: boolean = false;
  @Input() placeholder: string = 'Start writing...';

  @Output() contentChange = new EventEmitter<string>();
  @Output() selectionChange = new EventEmitter<SelectionChangeEvent>();
  @Output() contentChanged = new EventEmitter<ContentChangeEvent>();
  @Output() editorReady = new EventEmitter<Quill>();

  @ViewChild('editor') editor?: any;

  quillModules = {
    toolbar: [
      [{ 'font': ['sans-serif', 'serif', 'monospace'] }],
      [{ 'size': ['small', false, 'large', 'huge'] }],
      ['bold', 'italic', 'underline'],
      [{ 'header': [1, 2, 3, false] }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'align': [] }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      ['link'],
      ['clean']
    ]
  };

  quillFormats = [
    'font', 'size',
    'bold', 'italic', 'underline',
    'header',
    'list', 'bullet',
    'align', 'indent',
    'link'
  ];

  ngAfterViewInit(): void {
    if (this.editor?.quillEditor) {
      this.editorReady.emit(this.editor.quillEditor);
    }
  }

  onContentChanged(event: any): void {
    this.contentChange.emit(this.content);
    this.contentChanged.emit(event);
  }

  onSelectionChanged(event: any): void {
    this.selectionChange.emit(event);
  }

  getQuillEditor(): Quill | null {
    return this.editor?.quillEditor || null;
  }
}
