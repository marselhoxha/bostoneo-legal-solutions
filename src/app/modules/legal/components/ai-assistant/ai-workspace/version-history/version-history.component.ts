import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DocumentVersion } from '../../../../models/document.model';

@Component({
  selector: 'app-version-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './version-history.component.html',
  styleUrls: ['./version-history.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VersionHistoryComponent {
  @Input() versions: DocumentVersion[] = [];
  @Input() currentVersionNumber: number | null = null;
  @Input() loading: boolean = false;

  @Output() versionPreview = new EventEmitter<DocumentVersion>();
  @Output() versionRestore = new EventEmitter<number>();
  @Output() close = new EventEmitter<void>();

  onPreview(version: DocumentVersion): void {
    this.versionPreview.emit(version);
  }

  onRestore(version: DocumentVersion): void {
    this.versionRestore.emit(version.versionNumber);
  }

  onClose(): void {
    this.close.emit();
  }

  getTransformationLabel(transformationType: string): string {
    const labels: Record<string, string> = {
      'INITIAL_GENERATION': 'Initial Draft',
      'SIMPLIFY': 'Simplified',
      'CONDENSE': 'Condensed',
      'EXPAND': 'Expanded',
      'FORMAL': 'Made Formal',
      'PERSUASIVE': 'Made Persuasive',
      'REDRAFT': 'Redrafted',
      'MANUAL_EDIT': 'Manual Edit',
      'RESTORE_VERSION': 'Version Restored'
    };
    return labels[transformationType] || transformationType;
  }

  getRelativeTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
    if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
    if (days < 7) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
    return new Date(date).toLocaleDateString();
  }
}
