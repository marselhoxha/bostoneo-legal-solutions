import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  PIDocumentRequestService,
  BulkRequestPreview,
  RecipientGroup,
  UnresolvedItem,
  BulkRequestSubmit,
  RecipientOverride,
  BulkSendResult
} from '../../services/pi-document-request.service';

interface ManualRecipient {
  checklistItemId: number;
  name: string;
  email: string;
  phone: string;
}

@Component({
  selector: 'app-bulk-request-wizard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bulk-request-wizard.component.html',
  styleUrls: ['./bulk-request-wizard.component.scss']
})
export class BulkRequestWizardComponent implements OnInit {
  @Input() caseId!: number;
  @Input() selectedItemIds: number[] = [];

  @Output() completed = new EventEmitter<BulkSendResult>();
  @Output() cancelled = new EventEmitter<void>();

  // Wizard state
  currentStep: number = 1;
  isLoading: boolean = false;
  isSending: boolean = false;
  error: string | null = null;

  // Preview data
  preview: BulkRequestPreview | null = null;

  // User selections
  channelOverrides: { [groupKey: string]: string } = {};
  manualRecipients: { [checklistItemId: number]: ManualRecipient } = {};
  skippedItems: Set<number> = new Set();

  // Expanded groups
  expandedGroups: Set<string> = new Set();

  constructor(private documentRequestService: PIDocumentRequestService) {}

  ngOnInit(): void {
    this.loadPreview();
  }

  loadPreview(): void {
    if (!this.caseId || this.selectedItemIds.length === 0) return;

    this.isLoading = true;
    this.error = null;

    this.documentRequestService.previewBulkRequests(this.caseId, this.selectedItemIds).subscribe({
      next: (preview) => {
        this.preview = preview;
        this.isLoading = false;

        // Initialize channel overrides with suggested channels
        preview.recipientGroups.forEach(group => {
          this.channelOverrides[group.groupKey] = group.suggestedChannel;
        });

        // Initialize manual recipients for unresolved items
        preview.unresolvedItems.forEach(item => {
          this.manualRecipients[item.checklistItemId] = {
            checklistItemId: item.checklistItemId,
            name: item.suggestedName || '',
            email: '',
            phone: ''
          };
        });

        // Expand first group by default
        if (preview.recipientGroups.length > 0) {
          this.expandedGroups.add(preview.recipientGroups[0].groupKey);
        }
      },
      error: (err) => {
        console.error('Error loading preview:', err);
        this.error = 'Failed to analyze selected items. Please try again.';
        this.isLoading = false;
      }
    });
  }

  // Navigation
  nextStep(): void {
    if (this.currentStep < 3) {
      this.currentStep++;
    }
  }

  prevStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  // Group management
  toggleGroup(groupKey: string): void {
    if (this.expandedGroups.has(groupKey)) {
      this.expandedGroups.delete(groupKey);
    } else {
      this.expandedGroups.add(groupKey);
    }
  }

  isGroupExpanded(groupKey: string): boolean {
    return this.expandedGroups.has(groupKey);
  }

  // Skip management
  toggleSkipItem(itemId: number): void {
    if (this.skippedItems.has(itemId)) {
      this.skippedItems.delete(itemId);
    } else {
      this.skippedItems.add(itemId);
    }
  }

  isItemSkipped(itemId: number): boolean {
    return this.skippedItems.has(itemId);
  }

  // Channel selection
  getChannel(groupKey: string): string {
    return this.channelOverrides[groupKey] || 'EMAIL';
  }

  setChannel(groupKey: string, channel: string): void {
    this.channelOverrides[groupKey] = channel;
  }

  // Manual recipient validation
  isManualRecipientValid(itemId: number): boolean {
    const recipient = this.manualRecipients[itemId];
    if (!recipient) return false;
    return recipient.name.trim() !== '' && (recipient.email.trim() !== '' || recipient.phone.trim() !== '');
  }

  // Summary calculations
  get totalToSend(): number {
    if (!this.preview) return 0;

    // Count resolved items that aren't skipped
    let count = 0;
    this.preview.recipientGroups.forEach(group => {
      group.items.forEach(item => {
        if (!this.skippedItems.has(item.checklistItemId)) {
          count++;
        }
      });
    });

    // Add valid manual recipients that aren't skipped
    this.preview.unresolvedItems.forEach(item => {
      if (!this.skippedItems.has(item.checklistItemId) && this.isManualRecipientValid(item.checklistItemId)) {
        count++;
      }
    });

    return count;
  }

  get totalSkipped(): number {
    return this.skippedItems.size;
  }

  get totalEmails(): number {
    if (!this.preview) return 0;
    return this.preview.recipientGroups.filter(g =>
      this.getChannel(g.groupKey) === 'EMAIL' &&
      g.items.some(item => !this.skippedItems.has(item.checklistItemId))
    ).length;
  }

  get totalSms(): number {
    if (!this.preview) return 0;
    return this.preview.recipientGroups.filter(g =>
      this.getChannel(g.groupKey) === 'SMS' &&
      g.items.some(item => !this.skippedItems.has(item.checklistItemId))
    ).length;
  }

  // Submit
  sendRequests(): void {
    if (!this.preview || !this.caseId) return;

    this.isSending = true;
    this.error = null;

    // Build the submit request
    const request: BulkRequestSubmit = {
      checklistItemIds: this.selectedItemIds,
      skipItemIds: Array.from(this.skippedItems),
      channelOverrides: this.channelOverrides,
      defaultChannel: 'EMAIL',
      recipientOverrides: []
    };

    // Add manual recipients as overrides
    Object.values(this.manualRecipients).forEach(manual => {
      if (this.isManualRecipientValid(manual.checklistItemId) && !this.skippedItems.has(manual.checklistItemId)) {
        const unresolved = this.preview!.unresolvedItems.find(u => u.checklistItemId === manual.checklistItemId);
        request.recipientOverrides!.push({
          checklistItemId: manual.checklistItemId,
          recipientName: manual.name,
          email: manual.email || undefined,
          phone: manual.phone || undefined,
          recipientType: unresolved?.recipientType
        });
      }
    });

    this.documentRequestService.sendConfirmedBulkRequests(this.caseId, request).subscribe({
      next: (result) => {
        this.isSending = false;
        this.completed.emit(result);
      },
      error: (err) => {
        console.error('Error sending bulk requests:', err);
        this.error = 'Failed to send requests. Please try again.';
        this.isSending = false;
      }
    });
  }

  cancel(): void {
    this.cancelled.emit();
  }

  // Group helpers
  isGroupAllSkipped(group: RecipientGroup): boolean {
    return group.items.every(item => this.isItemSkipped(item.checklistItemId));
  }

  getGroupActiveItemsCount(group: RecipientGroup): number {
    return group.items.filter(item => !this.isItemSkipped(item.checklistItemId)).length;
  }

  // Helpers
  getRecipientTypeLabel(type: string): string {
    const labels: { [key: string]: string } = {
      'MEDICAL_PROVIDER': 'Medical Provider',
      'BILLING_DEPT': 'Billing Department',
      'INSURANCE_ADJUSTER': 'Insurance Adjuster',
      'EMPLOYER_HR': 'Employer HR',
      'POLICE_DEPT': 'Police Department',
      'CLIENT': 'Client',
      'WITNESS': 'Witness'
    };
    return labels[type] || type;
  }

  getDocumentTypeLabel(type: string): string {
    const labels: { [key: string]: string } = {
      'MEDICAL_RECORDS': 'Medical Records',
      'MEDICAL_BILLS': 'Medical Bills',
      'INSURANCE': 'Insurance Documents',
      'WAGE_DOCUMENTATION': 'Wage Documentation',
      'POLICE_REPORT': 'Police Report',
      'PHOTOGRAPHS': 'Photographs',
      'CLIENT_DOCUMENTS': 'Client Documents',
      'WITNESS': 'Witness Statement'
    };
    return labels[type] || type;
  }

  getChannelIcon(channel: string): string {
    const icons: { [key: string]: string } = {
      'EMAIL': 'ri-mail-line',
      'SMS': 'ri-smartphone-line',
      'FAX': 'ri-printer-line'
    };
    return icons[channel] || 'ri-send-plane-line';
  }
}
