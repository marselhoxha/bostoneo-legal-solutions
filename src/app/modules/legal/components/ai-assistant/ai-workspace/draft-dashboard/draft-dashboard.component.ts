import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Conversation } from '../../../../models/conversation.model';
import { Template } from '../../../../services/template.service';
import { PRACTICE_AREAS } from '../../../../shared/legal-constants';

/**
 * Sprint 4c — LegiDraft Flow v2 arrival dashboard.
 *
 * Two tiles (AI path + template path) + recent drafts strip. Replaces the
 * Sprint-4a single-card empty-state. The component is purely presentational:
 * it emits semantic events and the parent (ai-workspace) routes them through
 * the draftMode state machine.
 */
@Component({
  selector: 'app-draft-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './draft-dashboard.component.html',
  styleUrls: ['./draft-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DraftDashboardComponent {
  @Input() hasLinkedCase = false;
  @Input() linkedCase: any | null = null;
  @Input() userName?: string;
  @Input() recentDrafts: Conversation[] = [];
  @Input() recentTemplates: Template[] = [];
  @Input() templatesCount = 0;

  @Output() newDraft = new EventEmitter<void>();
  @Output() pickTemplate = new EventEmitter<Template>();
  @Output() browseTemplates = new EventEmitter<void>();
  @Output() openDraft = new EventEmitter<string>();
  @Output() clearCase = new EventEmitter<void>();
  @Output() openCase = new EventEmitter<number>();

  // Velzon pill-class lookup for the template mini-cards. Map practice-area
  // slugs to the preview's color families. Unknown slugs fall back to `pi`.
  private static readonly PA_PILL_CLASS: Record<string, string> = {
    pi: 'pi',
    'personal injury': 'pi',
    family: 'fam',
    'family law': 'fam',
    criminal: 'crim',
    immigration: 'imm',
    civil: 'civ',
    'civil litigation': 'civ'
  };

  paPillClass(tpl: Template): string {
    const slug = (tpl?.practiceArea || '').toLowerCase().trim();
    return DraftDashboardComponent.PA_PILL_CLASS[slug] || 'pi';
  }

  paLabel(tpl: Template): string {
    const pa = (tpl?.practiceArea || '').trim();
    if (!pa) return 'General';
    const match = PRACTICE_AREAS.find(p => p.slug === pa.toLowerCase());
    return match ? match.name : pa;
  }

  stateLabel(tpl: Template): string {
    const j = (tpl?.jurisdiction || '').trim();
    return j.toUpperCase();
  }

  /**
   * Pretty eyebrow for a recent draft card. Uses `documentType` if available,
   * else derives from the conversation title (short prefix before first space
   * or dash). Falls back to "DRAFT".
   */
  draftEyebrow(conv: Conversation): string {
    if (conv?.documentType) {
      return this.toTitleCase(conv.documentType);
    }
    const title = (conv?.title || '').trim();
    if (!title) return 'DRAFT';
    // Try "Letter of Rep — Smith v. Hartford" pattern first.
    const firstSegment = title.split(/[—\-·|]/)[0].trim();
    return this.toTitleCase(firstSegment.length < 40 ? firstSegment : firstSegment.substring(0, 22));
  }

  /** Strip the eyebrow prefix if the title starts with it, else return as-is. */
  draftTitle(conv: Conversation): string {
    const title = (conv?.title || '').trim();
    if (!title) return 'Untitled draft';
    // Prefer the tail after the first separator, which tends to be the matter.
    const parts = title.split(/[—\-·|]/);
    if (parts.length > 1) {
      const tail = parts.slice(1).join(' — ').trim();
      if (tail.length > 2) return tail;
    }
    return title;
  }

  relativeTime(value: Date | string | undefined): string {
    if (!value) return '';
    const when = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(when.getTime())) return '';
    const diffMs = Date.now() - when.getTime();
    const mins = Math.round(diffMs / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.round(days / 7);
    if (weeks < 5) return `${weeks}w ago`;
    return when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  trackByTemplateId(_i: number, t: Template): number | undefined {
    return t?.id;
  }

  trackByConversationId(_i: number, c: Conversation): string {
    return c?.id;
  }

  private toTitleCase(s: string): string {
    return (s || '')
      .toLowerCase()
      .split(/\s+/)
      .map(w => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
      .join(' ');
  }

  onTileNewDraft(): void {
    this.newDraft.emit();
  }

  onPickTemplate(tpl: Template): void {
    if (!tpl) return;
    this.pickTemplate.emit(tpl);
  }

  onBrowseAll(): void {
    this.browseTemplates.emit();
  }

  onOpenDraft(conv: Conversation): void {
    if (!conv?.id) return;
    this.openDraft.emit(conv.id);
  }

  onClearCase(event: MouseEvent): void {
    event.stopPropagation();
    this.clearCase.emit();
  }

  onOpenCase(): void {
    const id = this.linkedCase?.id;
    if (id != null) this.openCase.emit(id);
  }

  /** Display label for the chip — prefers title, falls back to case number. */
  caseChipLabel(): string {
    const title = (this.linkedCase?.title || '').trim();
    if (title) return title;
    const num = (this.linkedCase?.caseNumber || '').trim();
    return num || 'Linked case';
  }

  /** Secondary line: case number + client name when available. */
  caseChipSubtitle(): string {
    const parts: string[] = [];
    const num = (this.linkedCase?.caseNumber || '').trim();
    if (num) parts.push(`#${num}`);
    const client = (this.linkedCase?.clientName || '').trim();
    if (client) parts.push(client);
    return parts.join(' · ');
  }

  /** Short state/jurisdiction token rendered as a sub-pill. */
  caseChipJurisdiction(): string {
    return (this.linkedCase?.jurisdiction || '').trim();
  }

  /** Practice-area slug → pill color class, reusing the mini-card palette. */
  caseChipAccent(): string {
    const pa = (this.linkedCase?.practiceArea || this.linkedCase?.type || '')
      .toString()
      .toLowerCase()
      .trim();
    return DraftDashboardComponent.PA_PILL_CLASS[pa] || 'pi';
  }
}
