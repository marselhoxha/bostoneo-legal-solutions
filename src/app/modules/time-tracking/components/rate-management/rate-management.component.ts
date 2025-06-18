import { Component, OnInit, OnDestroy, ChangeDetectorRef, AfterViewInit, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { BillingRateService, BillingRate } from '../../services/billing-rate.service';
import { UserService } from '../../../../service/user.service';
import { LegalCaseService } from '../../../legal/services/legal-case.service';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';

interface RateTemplate {
  id: string;
  name: string;
  description: string;
  rates: {
    standard: number;
    litigation: number;
    court: number;
    consultation: number;
    emergency: number;
  };
  multipliers: {
    weekend: number;
    afterHours: number;
    emergency: number;
  };
}

interface AttorneyRate {
  userId: number;
  userName: string;
  userEmail: string;
  position: string;
  rates: BillingRate[];
  isActive: boolean;
  lastUpdated: Date;
}

interface RateAnalytics {
  totalRates: number;
  activeRates: number;
  averageRate: number;
  totalBilled: number;
  rateDistribution: { [key: string]: number };
  recentChanges: number;
}

@Component({
  selector: 'app-rate-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './rate-management.component.html',
  styleUrls: ['./rate-management.component.scss']
})
export class RateManagementComponent implements OnInit, OnDestroy, AfterViewInit {
  // Core data
  attorneyRates: AttorneyRate[] = [];
  billingRates: BillingRate[] = [];
  rateTemplates: RateTemplate[] = [];
  analytics: RateAnalytics = {
    totalRates: 0,
    activeRates: 0,
    averageRate: 0,
    totalBilled: 0,
    rateDistribution: {},
    recentChanges: 0
  };

  // UI state
  loading = true;
  error: string | null = null;
  activeTab = 'attorney-rates';
  showRateModal = false;
  showTemplateModal = false;
  showBulkUpdateModal = false;
  isProcessing = false;

  // Forms
  rateForm: FormGroup;
  templateForm: FormGroup;
  bulkUpdateForm: FormGroup;

  // Filters and search
  searchTerm = '';
  statusFilter = 'all';
  rateTypeFilter = 'all';
  sortBy = 'userName';
  sortDirection = 'asc';

  // Selection for bulk operations
  selectedRates: number[] = [];
  selectAll = false;

  // Pagination
  currentPage = 1;
  pageSize = 10;
  totalItems = 0;

  private subscriptions: Subscription[] = [];

  constructor(
    private billingRateService: BillingRateService,
    private userService: UserService,
    private legalCaseService: LegalCaseService,
    private fb: FormBuilder,
    private changeDetectorRef: ChangeDetectorRef,
    private elementRef: ElementRef
  ) {
    this.initializeForms();
    this.loadRateTemplates();
  }

  ngOnInit(): void {
    this.loadData();
  }

  ngAfterViewInit(): void {
    // Aggressively disable Bootstrap modal functionality
    this.neutralizeBootstrapModals();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    // Clean up modal classes
    document.body.classList.remove('modal-open');
    // Clean up event listeners
    if ((this as any)._bootstrapEventHandler) {
      document.removeEventListener('click', (this as any)._bootstrapEventHandler, true);
      document.removeEventListener('keydown', (this as any)._bootstrapEventHandler, true);
    }
    // Restore Bootstrap functionality
    this.restoreBootstrapModals();
  }

  private neutralizeBootstrapModals(): void {
    console.log('Neutralizing Bootstrap modals...');
    
    // 1. Completely replace Bootstrap Modal constructor
    if (typeof (window as any).bootstrap !== 'undefined' && (window as any).bootstrap.Modal) {
      console.log('Replacing Bootstrap Modal constructor');
      (this as any)._originalBootstrapModal = (window as any).bootstrap.Modal;
      
      (window as any).bootstrap.Modal = class DummyModal {
        constructor(element: any, options: any) {
          console.log('Bootstrap Modal constructor intercepted and neutralized');
          return this;
        }
        static getInstance() { return null; }
        static getOrCreateInstance() { return null; }
        show() { console.log('Bootstrap Modal show() blocked'); }
        hide() { console.log('Bootstrap Modal hide() blocked'); }
        toggle() { console.log('Bootstrap Modal toggle() blocked'); }
        dispose() { console.log('Bootstrap Modal dispose() blocked'); }
      };
    }

    // 2. Block all Bootstrap modal-related events
    const eventHandler = (event: Event) => {
      const target = event.target as HTMLElement;
      if (target) {
        // Check for Bootstrap modal triggers
        const hasModalToggle = target.hasAttribute('data-bs-toggle') || 
                              target.hasAttribute('data-toggle') ||
                              target.closest('[data-bs-toggle="modal"]') ||
                              target.closest('[data-toggle="modal"]');
        
        if (hasModalToggle) {
          console.log('Blocking Bootstrap modal trigger event');
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          return false;
        }
      }
    };

    // Add comprehensive event blocking
    document.addEventListener('click', eventHandler, true);
    document.addEventListener('keydown', eventHandler, true);
    document.addEventListener('focus', eventHandler, true);
    document.addEventListener('mousedown', eventHandler, true);
    
    (this as any)._bootstrapEventHandler = eventHandler;

    // 3. Remove all Bootstrap modal attributes from DOM
    this.removeBootstrapModalAttributes();

    // 4. Continuously monitor and remove attributes
    const observer = new MutationObserver(() => {
      this.removeBootstrapModalAttributes();
    });
    
    observer.observe(this.elementRef.nativeElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-bs-toggle', 'data-toggle', 'data-bs-target', 'data-target']
    });
    
    (this as any)._mutationObserver = observer;
  }

  private removeBootstrapModalAttributes(): void {
    // Remove from buttons and triggers
    const triggers = this.elementRef.nativeElement.querySelectorAll('[data-bs-toggle], [data-toggle], [data-bs-target], [data-target]');
    triggers.forEach((element: HTMLElement) => {
      element.removeAttribute('data-bs-toggle');
      element.removeAttribute('data-toggle');
      element.removeAttribute('data-bs-target');
      element.removeAttribute('data-target');
    });

    // Remove from modal elements
    const modals = this.elementRef.nativeElement.querySelectorAll('.modal, .custom-modal');
    modals.forEach((modal: HTMLElement) => {
      modal.removeAttribute('data-bs-backdrop');
      modal.removeAttribute('data-bs-keyboard');
      modal.removeAttribute('data-backdrop');
      modal.removeAttribute('data-keyboard');
    });
  }

  private restoreBootstrapModals(): void {
    // Restore original Bootstrap Modal constructor
    if ((this as any)._originalBootstrapModal) {
      (window as any).bootstrap.Modal = (this as any)._originalBootstrapModal;
    }
    
    // Clean up mutation observer
    if ((this as any)._mutationObserver) {
      (this as any)._mutationObserver.disconnect();
    }

    // Remove our event handlers
    if ((this as any)._bootstrapEventHandler) {
      document.removeEventListener('click', (this as any)._bootstrapEventHandler, true);
      document.removeEventListener('keydown', (this as any)._bootstrapEventHandler, true);
    }
  }

  private initializeForms(): void {
    this.rateForm = this.fb.group({
      userId: ['', Validators.required],
      rateType: ['STANDARD', Validators.required],
      rateAmount: ['', [Validators.required, Validators.min(1), Validators.max(2000)]],
      effectiveDate: [new Date().toISOString().split('T')[0], Validators.required],
      endDate: [''],
      isActive: [true],
      description: ['']
    });

    this.templateForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', Validators.required],
      standardRate: ['', [Validators.required, Validators.min(1)]],
      litigationRate: ['', [Validators.required, Validators.min(1)]],
      courtRate: ['', [Validators.required, Validators.min(1)]],
      consultationRate: ['', [Validators.required, Validators.min(1)]],
      emergencyRate: ['', [Validators.required, Validators.min(1)]],
      weekendMultiplier: [1.5, [Validators.required, Validators.min(1)]],
      afterHoursMultiplier: [1.25, [Validators.required, Validators.min(1)]],
      emergencyMultiplier: [2.0, [Validators.required, Validators.min(1)]]
    });

    this.bulkUpdateForm = this.fb.group({
      updateType: ['percentage', Validators.required],
      percentage: ['', Validators.required],
      fixedAmount: [''],
      effectiveDate: [new Date().toISOString().split('T')[0], Validators.required],
      reason: ['', Validators.required]
    });
  }

  private loadData(): Promise<void> {
    return new Promise((resolve) => {
      console.log('Starting to load rate management data...');
      this.loading = true;
      this.error = null;

      Promise.all([
        this.loadBillingRates(),
        this.loadAttorneyRates(),
        this.loadAnalytics()
      ]).then(() => {
        console.log('Rate management data loaded successfully');
        console.log('Billing rates:', this.billingRates.length);
        console.log('Attorney rates:', this.attorneyRates.length);
        console.log('Analytics:', this.analytics);
        this.loading = false;
        this.changeDetectorRef.detectChanges();
        resolve();
      }).catch(error => {
        console.error('Error loading rate management data:', error);
        this.error = 'Failed to load rate management data. Please try again.';
        this.loading = false;
        this.changeDetectorRef.detectChanges();
        resolve();
      });
    });
  }

  private loadBillingRates(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('Loading billing rates...');
      
      // Try to load from service first, but fallback to mock data if it fails
      const sub = this.billingRateService.getBillingRates(this.currentPage - 1, this.pageSize).subscribe({
        next: (response) => {
          console.log('Billing rates response:', response);
          this.billingRates = response.content || [];
          this.totalItems = response.totalElements || 0;
          console.log('Loaded billing rates:', this.billingRates.length);
          resolve();
        },
        error: (error) => {
          console.error('Error loading billing rates from service:', error);
          console.log('Using mock billing rates data...');
          
          // Use mock data for testing
          this.billingRates = [
            {
              id: 1,
              userId: 1,
              userName: 'John Smith',
              userEmail: 'john.smith@law.com',
              rateType: 'STANDARD',
              rateAmount: 350,
              effectiveDate: '2024-01-01',
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date()
            },
            {
              id: 2,
              userId: 1,
              userName: 'John Smith',
              userEmail: 'john.smith@law.com',
              rateType: 'PREMIUM',
              rateAmount: 450,
              effectiveDate: '2024-01-01',
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date()
            },
            {
              id: 3,
              userId: 2,
              userName: 'Sarah Johnson',
              userEmail: 'sarah.johnson@law.com',
              rateType: 'STANDARD',
              rateAmount: 275,
              effectiveDate: '2024-01-01',
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          ];
          this.totalItems = this.billingRates.length;
          console.log('Mock billing rates loaded:', this.billingRates.length);
          resolve();
        }
      });
      this.subscriptions.push(sub);
    });
  }

  private loadAttorneyRates(): Promise<void> {
    return new Promise((resolve) => {
      // Group billing rates by user
      const userRatesMap = new Map<number, BillingRate[]>();
      
      this.billingRates.forEach(rate => {
        if (!userRatesMap.has(rate.userId)) {
          userRatesMap.set(rate.userId, []);
        }
        userRatesMap.get(rate.userId)!.push(rate);
      });

      this.attorneyRates = Array.from(userRatesMap.entries()).map(([userId, rates]) => {
        const firstRate = rates[0];
        return {
          userId,
          userName: firstRate.userName || `User ${userId}`,
          userEmail: firstRate.userEmail || '',
          position: this.getUserPosition(firstRate.userName || ''),
          rates,
          isActive: rates.some(r => r.isActive),
          lastUpdated: new Date(Math.max(...rates.map(r => new Date(r.updatedAt || r.createdAt || new Date()).getTime())))
        };
      });

      resolve();
    });
  }

  private loadAnalytics(): Promise<void> {
    return new Promise((resolve) => {
      const activeRates = this.billingRates.filter(r => r.isActive);
      
      this.analytics = {
        totalRates: this.billingRates.length,
        activeRates: activeRates.length,
        averageRate: activeRates.length > 0 ? 
          activeRates.reduce((sum, r) => sum + r.rateAmount, 0) / activeRates.length : 0,
        totalBilled: 0, // TODO: Calculate from time entries
        rateDistribution: this.calculateRateDistribution(),
        recentChanges: this.billingRates.filter(r => 
          new Date(r.updatedAt || r.createdAt || new Date()).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000
        ).length
      };

      resolve();
    });
  }

  private calculateRateDistribution(): { [key: string]: number } {
    const distribution: { [key: string]: number } = {};
    
    this.billingRates.forEach(rate => {
      const type = rate.rateType;
      distribution[type] = (distribution[type] || 0) + 1;
    });

    return distribution;
  }

  private getUserPosition(userName: string): string {
    // Simple logic to determine position based on name or other criteria
    if (userName.toLowerCase().includes('partner')) return 'Partner';
    if (userName.toLowerCase().includes('associate')) return 'Associate';
    if (userName.toLowerCase().includes('counsel')) return 'Of Counsel';
    if (userName.toLowerCase().includes('paralegal')) return 'Paralegal';
    return 'Attorney';
  }

  private loadRateTemplates(): void {
    // Load predefined rate templates
    this.rateTemplates = [
      {
        id: 'partner-standard',
        name: 'Partner Standard',
        description: 'Standard rate structure for partners',
        rates: {
          standard: 450,
          litigation: 550,
          court: 600,
          consultation: 400,
          emergency: 750
        },
        multipliers: {
          weekend: 1.5,
          afterHours: 1.25,
          emergency: 2.0
        }
      },
      {
        id: 'associate-standard',
        name: 'Associate Standard',
        description: 'Standard rate structure for associates',
        rates: {
          standard: 275,
          litigation: 325,
          court: 375,
          consultation: 225,
          emergency: 450
        },
        multipliers: {
          weekend: 1.5,
          afterHours: 1.25,
          emergency: 2.0
        }
      },
      {
        id: 'paralegal-standard',
        name: 'Paralegal Standard',
        description: 'Standard rate structure for paralegals',
        rates: {
          standard: 125,
          litigation: 150,
          court: 175,
          consultation: 100,
          emergency: 200
        },
        multipliers: {
          weekend: 1.3,
          afterHours: 1.15,
          emergency: 1.5
        }
      }
    ];
  }

  // Tab management
  setActiveTab(tab: string): void {
    this.activeTab = tab;
  }

  // Rate CRUD operations
  openRateModal(rate?: BillingRate, event?: Event): void {
    // Prevent any Bootstrap event handling
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
    
    console.log('Opening rate modal', rate);
    if (rate) {
      this.rateForm.patchValue({
        userId: rate.userId,
        rateType: rate.rateType,
        rateAmount: rate.rateAmount,
        effectiveDate: rate.effectiveDate,
        endDate: rate.endDate || '',
        isActive: rate.isActive,
        description: ''
      });
    } else {
      this.rateForm.reset({
        rateType: 'STANDARD',
        effectiveDate: new Date().toISOString().split('T')[0],
        isActive: true
      });
    }
    this.showRateModal = true;
    document.body.classList.add('modal-open');
    console.log('Rate modal should be visible:', this.showRateModal);
    this.changeDetectorRef.detectChanges();
  }

  closeRateModal(): void {
    console.log('Closing rate modal');
    this.showRateModal = false;
    document.body.classList.remove('modal-open');
    this.rateForm.reset();
    this.changeDetectorRef.detectChanges();
  }

  saveRate(): void {
    if (this.rateForm.invalid || this.isProcessing) return;

    this.isProcessing = true;
    const formValue = this.rateForm.value;

    const billingRate: BillingRate = {
      userId: formValue.userId,
      rateType: formValue.rateType,
      rateAmount: formValue.rateAmount,
      effectiveDate: formValue.effectiveDate,
      endDate: formValue.endDate || undefined,
      isActive: formValue.isActive
    };

    const sub = this.billingRateService.createBillingRate(billingRate).subscribe({
      next: (createdRate) => {
        this.showSuccessMessage('Rate created successfully');
        this.closeRateModal();
        this.loadData();
        this.isProcessing = false;
      },
      error: (error) => {
        console.error('Error creating rate:', error);
        this.showErrorMessage('Failed to create rate. Please try again.');
        this.isProcessing = false;
      }
    });
    this.subscriptions.push(sub);
  }

  editRate(rate: BillingRate): void {
    this.openRateModal(rate);
  }

  deleteRate(rate: BillingRate): void {
    Swal.fire({
      title: 'Delete Rate',
      text: `Are you sure you want to delete this ${rate.rateType} rate?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc3545'
    }).then((result) => {
      if (result.isConfirmed && rate.id) {
        const sub = this.billingRateService.deleteBillingRate(rate.id).subscribe({
          next: () => {
            this.showSuccessMessage('Rate deleted successfully');
            this.loadData();
          },
          error: (error) => {
            console.error('Error deleting rate:', error);
            this.showErrorMessage('Failed to delete rate. Please try again.');
          }
        });
        this.subscriptions.push(sub);
      }
    });
  }

  // Template management
  openTemplateModal(event?: Event): void {
    // Prevent any Bootstrap event handling
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
    
    console.log('Opening template modal');
    this.templateForm.reset();
    this.showTemplateModal = true;
    document.body.classList.add('modal-open');
    console.log('Template modal should be visible:', this.showTemplateModal);
    this.changeDetectorRef.detectChanges();
  }

  closeTemplateModal(): void {
    console.log('Closing template modal');
    this.showTemplateModal = false;
    document.body.classList.remove('modal-open');
    this.templateForm.reset();
    this.changeDetectorRef.detectChanges();
  }

  saveTemplate(): void {
    if (this.templateForm.invalid || this.isProcessing) return;

    this.isProcessing = true;
    const formValue = this.templateForm.value;

    const template: RateTemplate = {
      id: `custom-${Date.now()}`,
      name: formValue.name,
      description: formValue.description,
      rates: {
        standard: formValue.standardRate,
        litigation: formValue.litigationRate,
        court: formValue.courtRate,
        consultation: formValue.consultationRate,
        emergency: formValue.emergencyRate
      },
      multipliers: {
        weekend: formValue.weekendMultiplier,
        afterHours: formValue.afterHoursMultiplier,
        emergency: formValue.emergencyMultiplier
      }
    };

    this.rateTemplates.push(template);
    this.showSuccessMessage('Rate template created successfully');
    this.closeTemplateModal();
    this.isProcessing = false;
  }

  applyTemplate(template: RateTemplate, userId: number): void {
    Swal.fire({
      title: 'Apply Rate Template',
      text: `Apply "${template.name}" template to this attorney?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Apply Template',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        this.createRatesFromTemplate(template, userId);
      }
    });
  }

  private createRatesFromTemplate(template: RateTemplate, userId: number): void {
    const rateTypes: (keyof typeof template.rates)[] = ['standard', 'litigation', 'court', 'consultation', 'emergency'];
    const ratesToCreate: BillingRate[] = [];

    rateTypes.forEach(type => {
      const rateType = type.toUpperCase() as BillingRate['rateType'];
      if (rateType === 'STANDARD' || rateType === 'PREMIUM' || rateType === 'EMERGENCY') {
        ratesToCreate.push({
          userId,
          rateType,
          rateAmount: template.rates[type],
          effectiveDate: new Date().toISOString().split('T')[0],
          isActive: true
        });
      }
    });

    Promise.all(ratesToCreate.map(rate => 
      this.billingRateService.createBillingRate(rate).toPromise()
    )).then(() => {
      this.showSuccessMessage('Template applied successfully');
      this.loadData();
    }).catch(error => {
      console.error('Error applying template:', error);
      this.showErrorMessage('Failed to apply template. Please try again.');
    });
  }

  // Bulk operations
  openBulkUpdateModal(event?: Event): void {
    // Prevent any Bootstrap event handling
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
    
    if (this.selectedRates.length === 0) {
      this.showErrorMessage('Please select rates to update');
      return;
    }
    
    console.log('Opening bulk update modal');
    this.bulkUpdateForm.reset({
      updateType: 'percentage',
      effectiveDate: new Date().toISOString().split('T')[0]
    });
    this.showBulkUpdateModal = true;
    document.body.classList.add('modal-open');
    console.log('Bulk update modal should be visible:', this.showBulkUpdateModal);
    this.changeDetectorRef.detectChanges();
  }

  closeBulkUpdateModal(): void {
    this.showBulkUpdateModal = false;
    document.body.classList.remove('modal-open');
    this.bulkUpdateForm.reset();
  }

  applyBulkUpdate(): void {
    if (this.bulkUpdateForm.invalid || this.isProcessing) return;

    this.isProcessing = true;
    const formValue = this.bulkUpdateForm.value;

    Swal.fire({
      title: 'Confirm Bulk Update',
      text: `Update ${this.selectedRates.length} selected rates?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Update Rates',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        this.performBulkUpdate(formValue);
      } else {
        this.isProcessing = false;
      }
    });
  }

  private performBulkUpdate(updateData: any): void {
    const selectedBillingRates = this.billingRates.filter(rate => 
      this.selectedRates.includes(rate.id!)
    );

    const updatePromises = selectedBillingRates.map(rate => {
      let newAmount = rate.rateAmount;
      
      if (updateData.updateType === 'percentage') {
        newAmount = rate.rateAmount * (1 + updateData.percentage / 100);
      } else {
        newAmount = updateData.fixedAmount;
      }

      const updatedRate: BillingRate = {
        ...rate,
        rateAmount: Math.round(newAmount * 100) / 100,
        effectiveDate: updateData.effectiveDate
      };

      return this.billingRateService.updateBillingRate(rate.id!, updatedRate).toPromise();
    });

    Promise.all(updatePromises).then(() => {
      this.showSuccessMessage(`Successfully updated ${this.selectedRates.length} rates`);
      this.selectedRates = [];
      this.selectAll = false;
      this.closeBulkUpdateModal();
      this.loadData();
      this.isProcessing = false;
    }).catch(error => {
      console.error('Error performing bulk update:', error);
      this.showErrorMessage('Failed to update rates. Please try again.');
      this.isProcessing = false;
    });
  }

  // Selection management
  toggleSelectAll(): void {
    if (this.selectAll) {
      this.selectedRates = this.billingRates.map(rate => rate.id!);
    } else {
      this.selectedRates = [];
    }
  }

  toggleRateSelection(rateId: number): void {
    const index = this.selectedRates.indexOf(rateId);
    if (index > -1) {
      this.selectedRates.splice(index, 1);
    } else {
      this.selectedRates.push(rateId);
    }
    this.selectAll = this.selectedRates.length === this.billingRates.length;
  }

  isRateSelected(rateId: number): boolean {
    return this.selectedRates.includes(rateId);
  }

  // Filtering and sorting
  get filteredRates(): BillingRate[] {
    let filtered = [...this.billingRates];

    // Apply search filter
    if (this.searchTerm) {
      filtered = filtered.filter(rate => 
        rate.userName?.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        rate.rateType.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(rate => 
        this.statusFilter === 'active' ? rate.isActive : !rate.isActive
      );
    }

    // Apply rate type filter
    if (this.rateTypeFilter !== 'all') {
      filtered = filtered.filter(rate => rate.rateType === this.rateTypeFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any = a[this.sortBy as keyof BillingRate];
      let bValue: any = b[this.sortBy as keyof BillingRate];

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (this.sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }

  setSortBy(field: string): void {
    if (this.sortBy === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = field;
      this.sortDirection = 'asc';
    }
  }

  // Utility methods
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  formatRateType(rateType: string): string {
    return rateType.replace('_', ' ').toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  getRatesByType(attorneyRate: AttorneyRate, type: string): BillingRate | undefined {
    return attorneyRate.rates.find(rate => rate.rateType === type && rate.isActive);
  }

  private showSuccessMessage(message: string): void {
    Swal.fire({
      icon: 'success',
      title: 'Success',
      text: message,
      timer: 3000,
      showConfirmButton: false
    });
  }

  private showErrorMessage(message: string): void {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: message
    });
  }

  // Export functionality
  exportRates(): void {
    const csvData = this.billingRates.map(rate => ({
      'Attorney': rate.userName,
      'Rate Type': rate.rateType,
      'Amount': rate.rateAmount,
      'Effective Date': rate.effectiveDate,
      'Status': rate.isActive ? 'Active' : 'Inactive'
    }));

    this.downloadCSV(csvData, 'billing-rates.csv');
  }

  private downloadCSV(data: any[], filename: string): void {
    const csvContent = this.convertToCSV(data);
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          return typeof value === 'string' && value.includes(',') 
            ? `"${value}"` 
            : value;
        }).join(',')
      )
    ];

    return csvRows.join('\n');
  }

  // TrackBy function for performance
  trackByRateId(index: number, rate: BillingRate): number {
    return rate.id || index;
  }
} 