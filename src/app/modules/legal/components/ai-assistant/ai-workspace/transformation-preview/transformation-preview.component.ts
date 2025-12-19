import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MarkdownToHtmlPipe } from '../../../../pipes/markdown-to-html.pipe';

/**
 * Represents a single diff change for token-efficient transformations
 */
export interface DocumentChange {
  find: string;
  replace: string;
  startIndex?: number;
  reason?: string;
}

export interface TransformationData {
  oldContent: string;
  newContent: string;
  transformationType: string;
  scope: 'FULL_DOCUMENT' | 'SELECTION';
  fullDocumentContent?: string;
  selectionRange?: { index: number; length: number };
  /**
   * For diff-based transformations - contains find/replace pairs
   */
  changes?: DocumentChange[];
  /**
   * Indicates whether diff-based transformation was used
   */
  useDiffMode?: boolean;
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

  // Original content is hidden by default
  showOriginal = false;

  onAccept(): void {
    this.accept.emit(this.messageId);
  }

  onReject(): void {
    this.reject.emit(this.messageId);
  }

  getTransformationLabel(): string {
    const type = this.transformation?.transformationType?.toLowerCase() || 'custom';

    switch (type) {
      case 'simplify':
        return 'Simplified Content';
      case 'condense':
        return 'Condensed Content';
      case 'expand':
        return 'Expanded Content';
      case 'redraft':
        return 'Redrafted Content';
      case 'custom':
        return 'Document Revision';
      default:
        return 'Transformed Content';
    }
  }

  /**
   * Check if this transformation uses diff mode
   */
  get isDiffMode(): boolean {
    return this.transformation?.useDiffMode === true &&
           Array.isArray(this.transformation?.changes) &&
           this.transformation.changes.length > 0;
  }

  /**
   * Get number of changes in diff mode
   */
  get changeCount(): number {
    return this.transformation?.changes?.length || 0;
  }
}
