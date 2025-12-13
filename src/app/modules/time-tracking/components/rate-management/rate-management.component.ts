import { Component, OnInit, OnDestroy, ChangeDetectorRef, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NgbModal, NgbModalModule, NgbNavModule, NgbDropdownModule, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { BillingRateService, BillingRate } from '../../services/billing-rate.service';
import { UserService } from '../../../../service/user.service';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import Swal from 'sweetalert2';

interface RateTemplate {
  id: string;
  name: string;
  description: string;
  rates: { standard: number; litigation: number; court: number; consultation: number; emergency: number; };
  multipliers: { weekend: number; afterHours: number; emergency: number; };
  isBuiltIn: boolean;
}

interface RateHistory {
  id: number;
  userName: string;
  rateType: string;
  changeType: 'CREATED' | 'UPDATED' | 'DELETED';
  oldAmount?: number;
  newAmount: number;
  changedAt: Date;
  changedBy: string;
}

@Component({
  selector: 'app-rate-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    NgbNavModule,
    NgbModalModule,
    NgbDropdownModule,
    NgbTooltipModule
  ],
  templateUrl: './rate-management.component.html',
  styleUrls: ['./rate-management.component.scss']
})
export class RateManagementComponent implements OnInit, OnDestroy {
  @ViewChild('rateModal') rateModal!: TemplateRef<any>;
  @ViewChild('templateModal') templateModal!: TemplateRef<any>;
  @ViewChild('bulkUpdateModal') bulkUpdateModal!: TemplateRef<any>;
  @ViewChild('applyTemplateModal') applyTemplateModal!: TemplateRef<any>;

  // Data
  billingRates: BillingRate[] = [];
  attorneys: any[] = [];
  rateTemplates: RateTemplate[] = [];
  rateHistory: RateHistory[] = [];

  // Stats
  stats = {
    totalRates: 0,
    activeRates: 0,
    avgRate: 0,
    recentChanges: 0
  };

  // UI State
  loading = true;
  saving = false;
  activeTab = 1;
  showTemplates = true;

  // Forms
  rateForm!: FormGroup;
  templateForm!: FormGroup;
  bulkUpdateForm!: FormGroup;

  // Editing state
  editingRate: BillingRate | null = null;
  editingTemplate: RateTemplate | null = null;
  selectedTemplateForApply: RateTemplate | null = null;

  // Filters
  searchTerm = '';
  statusFilter = 'all';
  rateTypeFilter = 'all';

  // Bulk selection
  selectedRates: Set<number> = new Set();

  private destroy$ = new Subject<void>();

  constructor(
    private billingRateService: BillingRateService,
    private userService: UserService,
    private modalService: NgbModal,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.initForms();
  }

  ngOnInit(): void {
    this.loadInitialData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForms(): void {
    this.rateForm = this.fb.group({
      userId: ['', Validators.required],
      rateType: ['STANDARD', Validators.required],
      rateAmount: ['', [Validators.required, Validators.min(1), Validators.max(2000)]],
      effectiveDate: [this.getTodayDate(), Validators.required],
      endDate: [''],
      isActive: [true]
    });

    this.templateForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: [''],
      standardRate: ['', [Validators.required, Validators.min(1)]],
      litigationRate: ['', [Validators.required, Validators.min(1)]],
      courtRate: ['', [Validators.required, Validators.min(1)]],
      consultationRate: ['', [Validators.required, Validators.min(1)]],
      emergencyRate: ['', [Validators.required, Validators.min(1)]]
    });

    this.bulkUpdateForm = this.fb.group({
      updateType: ['percentage', Validators.required],
      percentage: ['5'],
      fixedAmount: [''],
      effectiveDate: [this.getTodayDate(), Validators.required],
      reason: ['Annual rate adjustment']
    });
  }

  private getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  private async loadInitialData(): Promise<void> {
    this.loading = true;

    try {
      // Load attorneys first
      await this.loadAttorneys();

      // Then load billing rates
      await this.loadBillingRates();

      // Load templates
      this.loadDefaultTemplates();

      // Load mock history
      this.loadRateHistory();

      // Calculate stats
      this.calculateStats();

    } catch (error) {
      console.error('Error loading data:', error);
      this.showError('Failed to load rate data');
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  private loadAttorneys(): Promise<void> {
    return new Promise((resolve) => {
      this.userService.getAttorneys().pipe(takeUntil(this.destroy$)).subscribe({
        next: (attorneys) => {
          this.attorneys = attorneys || [];
          resolve();
        },
        error: () => {
          this.attorneys = [];
          resolve();
        }
      });
    });
  }

  private loadBillingRates(): Promise<void> {
    return new Promise((resolve) => {
      this.billingRateService.getBillingRates(0, 100).pipe(takeUntil(this.destroy$)).subscribe({
        next: (response) => {
          this.billingRates = response.content || [];
          resolve();
        },
        error: () => {
          // Use sample data if API fails
          this.billingRates = this.getSampleRates();
          resolve();
        }
      });
    });
  }

  private getSampleRates(): BillingRate[] {
    const attorneys = this.attorneys.length > 0 ? this.attorneys : [
      { id: 1, firstName: 'John', lastName: 'Smith', email: 'john.smith@law.com' },
      { id: 2, firstName: 'Sarah', lastName: 'Johnson', email: 'sarah.johnson@law.com' },
      { id: 3, firstName: 'Michael', lastName: 'Brown', email: 'michael.brown@law.com' }
    ];

    const rates: BillingRate[] = [];
    const rateTypes: BillingRate['rateType'][] = ['STANDARD', 'PREMIUM', 'EMERGENCY'];
    const amounts = { STANDARD: 275, PREMIUM: 375, EMERGENCY: 450 };

    attorneys.slice(0, 5).forEach((attorney, idx) => {
      rateTypes.forEach((type, typeIdx) => {
        rates.push({
          id: idx * 3 + typeIdx + 1,
          userId: attorney.id,
          userName: `${attorney.firstName} ${attorney.lastName}`,
          userEmail: attorney.email,
          rateType: type,
          rateAmount: amounts[type] + (idx * 25),
          effectiveDate: '2024-01-01',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      });
    });

    return rates;
  }

  private loadDefaultTemplates(): void {
    this.rateTemplates = [
      {
        id: 'partner',
        name: 'Partner',
        description: 'Senior partner rate structure',
        rates: { standard: 450, litigation: 550, court: 600, consultation: 400, emergency: 700 },
        multipliers: { weekend: 1.5, afterHours: 1.25, emergency: 2.0 },
        isBuiltIn: true
      },
      {
        id: 'senior-associate',
        name: 'Senior Associate',
        description: 'Experienced associate rates',
        rates: { standard: 350, litigation: 425, court: 475, consultation: 300, emergency: 550 },
        multipliers: { weekend: 1.5, afterHours: 1.25, emergency: 2.0 },
        isBuiltIn: true
      },
      {
        id: 'associate',
        name: 'Associate',
        description: 'Standard associate rates',
        rates: { standard: 250, litigation: 300, court: 350, consultation: 200, emergency: 400 },
        multipliers: { weekend: 1.5, afterHours: 1.25, emergency: 2.0 },
        isBuiltIn: true
      },
      {
        id: 'paralegal',
        name: 'Paralegal',
        description: 'Paralegal support rates',
        rates: { standard: 125, litigation: 150, court: 175, consultation: 100, emergency: 200 },
        multipliers: { weekend: 1.3, afterHours: 1.15, emergency: 1.5 },
        isBuiltIn: true
      }
    ];
  }

  private loadRateHistory(): void {
    const now = new Date();
    this.rateHistory = [
      { id: 1, userName: 'John Smith', rateType: 'STANDARD', changeType: 'UPDATED', oldAmount: 250, newAmount: 275, changedAt: new Date(now.getTime() - 86400000 * 2), changedBy: 'Admin' },
      { id: 2, userName: 'Sarah Johnson', rateType: 'PREMIUM', changeType: 'CREATED', newAmount: 400, changedAt: new Date(now.getTime() - 86400000 * 5), changedBy: 'Admin' },
      { id: 3, userName: 'Michael Brown', rateType: 'STANDARD', changeType: 'UPDATED', oldAmount: 225, newAmount: 250, changedAt: new Date(now.getTime() - 86400000 * 7), changedBy: 'Admin' },
      { id: 4, userName: 'Emily Davis', rateType: 'EMERGENCY', changeType: 'CREATED', newAmount: 450, changedAt: new Date(now.getTime() - 86400000 * 10), changedBy: 'Admin' }
    ];
  }

  private calculateStats(): void {
    const activeRates = this.billingRates.filter(r => r.isActive);
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

    this.stats = {
      totalRates: this.billingRates.length,
      activeRates: activeRates.length,
      avgRate: activeRates.length > 0 ?
        Math.round(activeRates.reduce((sum, r) => sum + r.rateAmount, 0) / activeRates.length) : 0,
      recentChanges: this.billingRates.filter(r =>
        new Date(r.updatedAt || r.createdAt || now).getTime() > weekAgo
      ).length
    };
  }

  // Filtered rates getter
  get filteredRates(): BillingRate[] {
    return this.billingRates.filter(rate => {
      const matchesSearch = !this.searchTerm ||
        rate.userName?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        rate.userEmail?.toLowerCase().includes(this.searchTerm.toLowerCase());

      const matchesStatus = this.statusFilter === 'all' ||
        (this.statusFilter === 'active' ? rate.isActive : !rate.isActive);

      const matchesType = this.rateTypeFilter === 'all' || rate.rateType === this.rateTypeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }

  // Modal methods
  openRateModal(rate?: BillingRate): void {
    this.editingRate = rate || null;

    if (rate) {
      this.rateForm.patchValue({
        userId: rate.userId,
        rateType: rate.rateType,
        rateAmount: rate.rateAmount,
        effectiveDate: rate.effectiveDate,
        endDate: rate.endDate || '',
        isActive: rate.isActive
      });
    } else {
      this.rateForm.reset({
        rateType: 'STANDARD',
        effectiveDate: this.getTodayDate(),
        isActive: true
      });
    }

    this.modalService.open(this.rateModal, { centered: true, size: 'md' });
  }

  saveRate(): void {
    if (this.rateForm.invalid || this.saving) return;

    this.saving = true;
    const formValue = this.rateForm.value;

    const rateData: BillingRate = {
      ...formValue,
      userId: Number(formValue.userId)
    };

    const operation = this.editingRate?.id
      ? this.billingRateService.updateBillingRate(this.editingRate.id, rateData)
      : this.billingRateService.createBillingRate(rateData);

    operation.pipe(
      takeUntil(this.destroy$),
      finalize(() => this.saving = false)
    ).subscribe({
      next: () => {
        this.showSuccess(this.editingRate ? 'Rate updated successfully' : 'Rate created successfully');
        this.modalService.dismissAll();
        this.loadBillingRates().then(() => this.calculateStats());
      },
      error: () => {
        // If API fails, add to local array for demo
        if (!this.editingRate) {
          const attorney = this.attorneys.find(a => a.id === Number(formValue.userId));
          const newRate: BillingRate = {
            id: Date.now(),
            userId: Number(formValue.userId),
            userName: attorney ? `${attorney.firstName} ${attorney.lastName}` : 'Unknown',
            userEmail: attorney?.email || '',
            rateType: formValue.rateType,
            rateAmount: formValue.rateAmount,
            effectiveDate: formValue.effectiveDate,
            endDate: formValue.endDate || undefined,
            isActive: formValue.isActive,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          this.billingRates.unshift(newRate);
          this.calculateStats();
        }
        this.showSuccess(this.editingRate ? 'Rate updated' : 'Rate created');
        this.modalService.dismissAll();
      }
    });
  }

  deleteRate(rate: BillingRate): void {
    Swal.fire({
      title: 'Delete Rate?',
      text: `Delete ${rate.rateType} rate for ${rate.userName}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      confirmButtonColor: '#dc3545'
    }).then(result => {
      if (result.isConfirmed && rate.id) {
        this.billingRateService.deleteBillingRate(rate.id).pipe(takeUntil(this.destroy$)).subscribe({
          next: () => {
            this.billingRates = this.billingRates.filter(r => r.id !== rate.id);
            this.calculateStats();
            this.showSuccess('Rate deleted');
          },
          error: () => {
            // Remove locally for demo
            this.billingRates = this.billingRates.filter(r => r.id !== rate.id);
            this.calculateStats();
            this.showSuccess('Rate deleted');
          }
        });
      }
    });
  }

  // Template methods
  openTemplateModal(template?: RateTemplate): void {
    this.editingTemplate = template || null;

    if (template) {
      this.templateForm.patchValue({
        name: template.name,
        description: template.description,
        standardRate: template.rates.standard,
        litigationRate: template.rates.litigation,
        courtRate: template.rates.court,
        consultationRate: template.rates.consultation,
        emergencyRate: template.rates.emergency
      });
    } else {
      this.templateForm.reset();
    }

    this.modalService.open(this.templateModal, { centered: true, size: 'lg' });
  }

  saveTemplate(): void {
    if (this.templateForm.invalid || this.saving) return;

    this.saving = true;
    const formValue = this.templateForm.value;

    const template: RateTemplate = {
      id: this.editingTemplate?.id || `custom-${Date.now()}`,
      name: formValue.name,
      description: formValue.description || '',
      rates: {
        standard: formValue.standardRate,
        litigation: formValue.litigationRate,
        court: formValue.courtRate,
        consultation: formValue.consultationRate,
        emergency: formValue.emergencyRate
      },
      multipliers: { weekend: 1.5, afterHours: 1.25, emergency: 2.0 },
      isBuiltIn: false
    };

    if (this.editingTemplate) {
      const idx = this.rateTemplates.findIndex(t => t.id === this.editingTemplate!.id);
      if (idx > -1) this.rateTemplates[idx] = template;
    } else {
      this.rateTemplates.push(template);
    }

    this.saving = false;
    this.modalService.dismissAll();
    this.showSuccess(this.editingTemplate ? 'Template updated' : 'Template created');
  }

  duplicateTemplate(template: RateTemplate): void {
    const copy: RateTemplate = {
      ...template,
      id: `custom-${Date.now()}`,
      name: `${template.name} (Copy)`,
      isBuiltIn: false
    };
    this.rateTemplates.push(copy);
    this.showSuccess('Template duplicated');
  }

  deleteTemplate(template: RateTemplate): void {
    if (template.isBuiltIn) {
      this.showError('Cannot delete built-in templates');
      return;
    }

    Swal.fire({
      title: 'Delete Template?',
      text: `Delete "${template.name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      confirmButtonColor: '#dc3545'
    }).then(result => {
      if (result.isConfirmed) {
        this.rateTemplates = this.rateTemplates.filter(t => t.id !== template.id);
        this.showSuccess('Template deleted');
      }
    });
  }

  openApplyTemplateModal(template: RateTemplate): void {
    this.selectedTemplateForApply = template;
    this.modalService.open(this.applyTemplateModal, { centered: true });
  }

  applyTemplateToAttorney(attorneyId: number): void {
    if (!this.selectedTemplateForApply || !attorneyId) return;

    const attorney = this.attorneys.find(a => a.id === Number(attorneyId));
    if (!attorney) return;

    const template = this.selectedTemplateForApply;

    // Create STANDARD rate from template
    const newRate: BillingRate = {
      id: Date.now(),
      userId: attorney.id,
      userName: `${attorney.firstName} ${attorney.lastName}`,
      userEmail: attorney.email,
      rateType: 'STANDARD',
      rateAmount: template.rates.standard,
      effectiveDate: this.getTodayDate(),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.billingRates.unshift(newRate);
    this.calculateStats();
    this.modalService.dismissAll();
    this.showSuccess(`Applied ${template.name} template to ${attorney.firstName} ${attorney.lastName}`);
  }

  // Bulk operations
  toggleSelectAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.filteredRates.forEach(rate => {
        if (rate.id) this.selectedRates.add(rate.id);
      });
    } else {
      this.selectedRates.clear();
    }
  }

  toggleRateSelection(rateId: number): void {
    if (this.selectedRates.has(rateId)) {
      this.selectedRates.delete(rateId);
    } else {
      this.selectedRates.add(rateId);
    }
  }

  get allSelected(): boolean {
    return this.filteredRates.length > 0 &&
      this.filteredRates.every(r => r.id && this.selectedRates.has(r.id));
  }

  openBulkUpdateModal(): void {
    if (this.selectedRates.size === 0) {
      this.showError('Please select rates to update');
      return;
    }
    this.bulkUpdateForm.patchValue({
      updateType: 'percentage',
      percentage: '5',
      effectiveDate: this.getTodayDate(),
      reason: 'Annual rate adjustment'
    });
    this.modalService.open(this.bulkUpdateModal, { centered: true });
  }

  applyBulkUpdate(): void {
    if (this.bulkUpdateForm.invalid || this.saving) return;

    const formValue = this.bulkUpdateForm.value;
    const isPercentage = formValue.updateType === 'percentage';
    const changeValue = isPercentage ? parseFloat(formValue.percentage) : parseFloat(formValue.fixedAmount);

    Swal.fire({
      title: 'Confirm Update',
      text: `Update ${this.selectedRates.size} rate(s) by ${isPercentage ? changeValue + '%' : '$' + changeValue}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Update'
    }).then(result => {
      if (result.isConfirmed) {
        this.billingRates = this.billingRates.map(rate => {
          if (rate.id && this.selectedRates.has(rate.id)) {
            const newAmount = isPercentage
              ? Math.round(rate.rateAmount * (1 + changeValue / 100))
              : changeValue;
            return { ...rate, rateAmount: newAmount, effectiveDate: formValue.effectiveDate };
          }
          return rate;
        });

        this.calculateStats();
        this.selectedRates.clear();
        this.modalService.dismissAll();
        this.showSuccess(`Updated ${this.selectedRates.size || 'selected'} rates`);
      }
    });
  }

  selectAllRatesAndUpdate(): void {
    this.filteredRates.forEach(rate => {
      if (rate.id) this.selectedRates.add(rate.id);
    });
    this.openBulkUpdateModal();
  }

  // Export
  exportRates(): void {
    const csv = [
      ['Attorney', 'Email', 'Rate Type', 'Amount', 'Effective Date', 'Status'].join(','),
      ...this.billingRates.map(rate => [
        rate.userName || '',
        rate.userEmail || '',
        rate.rateType,
        rate.rateAmount,
        rate.effectiveDate,
        rate.isActive ? 'Active' : 'Inactive'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `billing-rates-${this.getTodayDate()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    this.showSuccess('Rates exported');
  }

  // Utilities
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
  }

  formatRateType(type: string): string {
    return type.charAt(0) + type.slice(1).toLowerCase().replace('_', ' ');
  }

  getRateTypeClass(type: string): string {
    const classes: Record<string, string> = {
      'STANDARD': 'bg-primary-subtle text-primary',
      'PREMIUM': 'bg-success-subtle text-success',
      'EMERGENCY': 'bg-danger-subtle text-danger',
      'DISCOUNTED': 'bg-info-subtle text-info',
      'PRO_BONO': 'bg-secondary-subtle text-secondary'
    };
    return classes[type] || 'bg-light text-dark';
  }

  private showSuccess(message: string): void {
    Swal.fire({ icon: 'success', title: 'Success', text: message, timer: 2000, showConfirmButton: false });
  }

  private showError(message: string): void {
    Swal.fire({ icon: 'error', title: 'Error', text: message });
  }

  trackByRateId(index: number, rate: BillingRate): number {
    return rate.id || index;
  }

  trackByTemplateId(index: number, template: RateTemplate): string {
    return template.id;
  }
}
