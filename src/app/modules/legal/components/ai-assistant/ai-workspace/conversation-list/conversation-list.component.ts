import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Conversation, GroupedConversations } from '../../../../models/conversation.model';
import { ConversationType } from '../../../../models/enums/conversation-type.enum';

@Component({
  selector: 'app-conversation-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './conversation-list.component.html',
  styleUrls: ['./conversation-list.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ConversationListComponent {
  @Input() conversations: Conversation[] = [];
  @Input() groupedConversations!: GroupedConversations;
  @Input() activeConversationId: string | null = null;
  @Input() selectedTask: ConversationType = ConversationType.Draft;
  @Input() searchQuery: string = '';

  @Output() conversationSelected = new EventEmitter<string>();
  @Output() conversationDeleted = new EventEmitter<string>();
  @Output() newConversation = new EventEmitter<void>();
  @Output() searchQueryChange = new EventEmitter<string>();

  // Expose enum to template
  ConversationType = ConversationType;

  /**
   * Filter out document analysis conversations (Upload/Summarize)
   * since they appear in Recent Documents section instead
   */
  get filteredConversations(): Conversation[] {
    // First filter out document analysis types
    const nonAnalysisConversations = this.conversations.filter(conv =>
      conv.type !== ConversationType.Upload && conv.type !== ConversationType.Summarize
    );

    if (!this.searchQuery.trim()) {
      return nonAnalysisConversations;
    }

    const query = this.searchQuery.toLowerCase();
    return nonAnalysisConversations.filter(conv =>
      conv.title.toLowerCase().includes(query)
    );
  }

  /**
   * Filtered grouped conversations (excluding document analysis types)
   */
  get filteredGroupedConversations(): GroupedConversations {
    if (!this.groupedConversations) {
      return { past90Days: [], older: [] };
    }

    const filterAnalysis = (convs: Conversation[]) =>
      convs.filter(conv =>
        conv.type !== ConversationType.Upload && conv.type !== ConversationType.Summarize
      );

    return {
      past90Days: filterAnalysis(this.groupedConversations.past90Days || []),
      older: filterAnalysis(this.groupedConversations.older || [])
    };
  }

  onConversationClick(conversation: Conversation): void {
    this.conversationSelected.emit(conversation.id);
  }

  onDeleteClick(event: Event, conversation: Conversation): void {
    event.stopPropagation();
    this.conversationDeleted.emit(conversation.id);
  }

  onNewConversation(): void {
    this.newConversation.emit();
  }

  onSearchChange(value: string): void {
    this.searchQueryChange.emit(value);
  }

  getConversationIcon(type: ConversationType): string {
    const icons: Record<ConversationType, string> = {
      [ConversationType.Question]: 'ri-question-line',
      [ConversationType.Draft]: 'ri-file-edit-line',
      [ConversationType.Summarize]: 'ri-file-list-3-line',
      [ConversationType.Upload]: 'ri-file-upload-line'
    };
    return icons[type] || 'ri-chat-3-line';
  }

  getRelativeTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} years ago`;
  }
}
