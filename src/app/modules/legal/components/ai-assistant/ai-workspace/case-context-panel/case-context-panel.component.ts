import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

/**
 * Sprint 4a — Right-rail Case Context summary shown inside focused LegiDraft mode.
 * Renders an empty state when no case is linked, or a compact case summary when one is.
 * Accepts a permissive `any` type so both the rich LegalCase interface and the slimmer
 * shape surfaced by ai-workspace's userCases array are supported.
 */
@Component({
  selector: 'app-case-context-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './case-context-panel.component.html',
  styleUrls: ['./case-context-panel.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CaseContextPanelComponent {
  @Input() case: any | null = null;
  @Input() availableCases: any[] = [];

  @Output() linkCase = new EventEmitter<void>();
  @Output() caseSelected = new EventEmitter<any | null>();

  pickerOpen = false;
  selectedPickerId: number | null = null;

  constructor(private router: Router) {}

  openPicker(): void {
    this.pickerOpen = true;
    this.linkCase.emit();
  }

  onPick(idRaw: string | number | null): void {
    const id = Number(idRaw);
    if (!id) return;
    const picked = this.availableCases.find(c => c.id === id) || null;
    this.caseSelected.emit(picked);
    this.pickerOpen = false;
    this.selectedPickerId = null;
  }

  cancelPicker(): void {
    this.pickerOpen = false;
    this.selectedPickerId = null;
  }

  get caseTitle(): string {
    return this.case?.title || this.case?.caseName || (this.case ? `Case #${this.case.id}` : '');
  }

  get clientFullName(): string | null {
    const c = this.case;
    if (!c) return null;
    if (c.clientName) return c.clientName;
    if (c.client?.firstName || c.client?.lastName) {
      return `${c.client.firstName ?? ''} ${c.client.lastName ?? ''}`.trim();
    }
    return null;
  }

  get hasClientInsurance(): boolean {
    return !!this.case?.clientInsuranceCompany;
  }

  get hasDefendantInsurance(): boolean {
    return !!this.case?.insuranceCompany;
  }

  get incidentDate(): Date | string | null {
    // PI cases expose injuryDate; fall back to custom fields that other practice areas use.
    return this.case?.injuryDate || this.case?.incidentDate || null;
  }

  get filingDate(): Date | string | null {
    return this.case?.importantDates?.filingDate || this.case?.filingDate || null;
  }

  openCase(): void {
    if (!this.case?.id) return;
    this.router.navigate(['/legal/cases', this.case.id]);
  }
}
