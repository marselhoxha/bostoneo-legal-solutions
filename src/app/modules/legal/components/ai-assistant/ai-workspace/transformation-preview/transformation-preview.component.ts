import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MarkdownToHtmlPipe } from '../../../../pipes/markdown-to-html.pipe';

export interface TransformationData {
  oldContent: string;
  newContent: string;
  transformationType: string;
  scope: 'FULL_DOCUMENT' | 'SELECTION';
  fullDocumentContent?: string;
  selectionRange?: { index: number; length: number };
}

@Component({
  selector: 'app-transformation-preview',
  standalone: true,
  imports: [CommonModule, MarkdownToHtmlPipe],
  templateUrl: './transformation-preview.component.html',
  styleUrls: ['./transformation-preview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TransformationPreviewComponent {
  @Input() transformation!: TransformationData;
  @Input() messageId!: string;

  @Output() accept = new EventEmitter<string>();
  @Output() reject = new EventEmitter<string>();

  showContext = false;

  onAccept(): void {
    this.accept.emit(this.messageId);
  }

  onReject(): void {
    this.reject.emit(this.messageId);
  }

  toggleContext(): void {
    this.showContext = !this.showContext;
  }

  highlightSelectionInContext(fullDocument: string, selectedText: string): string {
    if (!fullDocument || !selectedText) {
      return fullDocument;
    }

    const escapedSelection = selectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedSelection})`, 'i');
    return fullDocument.replace(regex, '<mark class="text-selection-highlight">$1</mark>');
  }
}
