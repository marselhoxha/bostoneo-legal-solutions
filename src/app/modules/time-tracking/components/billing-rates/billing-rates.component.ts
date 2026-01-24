import { Component, OnInit, OnDestroy, ChangeDetectorRef, AfterViewInit, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { BillingRateService, BillingRate } from '../../services/billing-rate.service';
import { UserService } from '../../../../service/user.service';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';

interface RateCard {
  id?: number;
  type: string;
  amount: number;
  description: string;
  usage: number;
  change: number;
  isActive: boolean;
  lastUsed: string;
  totalBilled: number;
  effectiveDate: string;
}

interface RateAnalytics {
  averageRate: number;
  totalEntries: number;
  activeRates: number;
  totalBilled: number;
}

@Component({
  selector: 'app-billing-rates',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule],
  templateUrl: './billing-rates.component.html',
  styleUrls: ['./billing-rates.component.scss']
})
export class BillingRatesComponent implements OnInit, OnDestroy, AfterViewInit {
  // Core data
  rateCards: RateCard[] = [];
  billingRates: BillingRate[] = [];
  analytics: RateAnalytics = {
    averageRate: 0,
    totalEntries: 0,
    activeRates: 0,
    totalBilled: 0
  };
  
  // Real usage data from time tracking integration
  realUsageData: { [rateId: number]: any } = {};

  // UI state
  loading = true;
  error: string | null = null;
  showRateModal = false;
  showEditModal = false;
  isProcessing = false;

  // Forms
  rateForm: FormGroup;
  editingRate: BillingRate | null = null;

  // Filters
  statusFilter = 'all';
  searchTerm = '';
  


  private subscriptions: Subscription[] = [];

  constructor(
    private billingRateService: BillingRateService,
    private userService: UserService,
    private fb: FormBuilder,
    private changeDetectorRef: ChangeDetectorRef,
    private elementRef: ElementRef
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.initializeUserAndLoadData();
  }

  ngAfterViewInit(): void {
    this.neutralizeBootstrapModals();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    document.body.classList.remove('modal-open');
    this.restoreBootstrapModals();
  }

  private neutralizeBootstrapModals(): void {
    // Disable Bootstrap modal functionality to prevent conflicts
    if (typeof (window as any).bootstrap !== 'undefined' && (window as any).bootstrap.Modal) {
      (this as any)._originalBootstrapModal = (window as any).bootstrap.Modal;
      (window as any).bootstrap.Modal = class DummyModal {
        constructor() { return this; }
        static getInstance() { return null; }
        static getOrCreateInstance() { return null; }
        show() { }
        hide() { }
      };
    }

    // Remove Bootstrap modal attributes
    const elements = this.elementRef.nativeElement.querySelectorAll('[data-bs-toggle], [data-toggle]');
    elements.forEach((element: HTMLElement) => {
      element.removeAttribute('data-bs-toggle');
      element.removeAttribute('data-toggle');
      element.removeAttribute('data-bs-target');
      element.removeAttribute('data-target');
    });
  }

  private restoreBootstrapModals(): void {
    if ((this as any)._originalBootstrapModal) {
      (window as any).bootstrap.Modal = (this as any)._originalBootstrapModal;
    }
  }

  private initializeForm(): void {
    this.rateForm = this.fb.group({
      rateType: ['STANDARD', Validators.required],
      rateAmount: ['', [Validators.required, Validators.min(1), Validators.max(2000)]],
      effectiveDate: [new Date().toISOString().split('T')[0], Validators.required],
      endDate: [''],
      isActive: [true],
      description: ['']
    });
  }

  private initializeUserAndLoadData(): void {
    // First check if user is authenticated
    if (!this.userService.isAuthenticated()) {
      this.error = 'Please log in to access billing rates';
      this.loading = false;
      return;
    }

    // Check if user data is already available
    const currentUser = this.getCurrentUserId();
    if (currentUser) {
      this.loadData();
    } else {
      // Load user profile first, then load data
      this.userService.profile$().subscribe({
        next: (response) => {
          if (response?.data?.user) {
            this.loadData();
          } else {
            this.error = 'Failed to load user profile';
            this.loading = false;
          }
        },
        error: (error) => {
          console.error('Error loading user profile:', error);
          this.error = 'Please log in to access billing rates';
          this.loading = false;
        }
      });
    }
  }

  loadData(): void {
    this.loading = true;
    this.error = null;

    const currentUserId = this.getCurrentUserId();
    if (!currentUserId) {
      this.error = 'Please log in to view billing rates';
      this.loading = false;
      return;
    }

    this.loadBillingRates(currentUserId).then(() => {
      return this.loadAnalytics(currentUserId);
    }).then(() => {
      this.loading = false;
      this.changeDetectorRef.detectChanges();
    }).catch(error => {
      console.error('Error loading data:', error);
      // Don't override specific error messages
      if (!this.error) {
        this.error = 'Failed to load billing rates data';
      }
      this.loading = false;
      this.changeDetectorRef.detectChanges();
    });
  }

  private loadBillingRates(userId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const sub = this.billingRateService.getBillingRatesByUser(userId, 0, 50).subscribe({
      next: (response) => {
          this.billingRates = response.content || [];
        this.processRateCards();
          resolve();
      },
      error: (error) => {
        console.error('Error loading billing rates:', error);
          this.error = 'Failed to load billing rates: ' + (error.error?.message || error.message);
          this.billingRates = [];
          this.processRateCards();
          reject(error);
      }
      });
      this.subscriptions.push(sub);
    });
  }



  private processRateCards(): void {
    this.rateCards = this.billingRates.map(rate => {
      const realData = this.realUsageData[rate.id!];

      // Use real data from time tracking integration
      const totalHours = realData?.totalHours || 0;
      const totalBilled = realData?.totalBilled || 0;

      return {
        id: rate.id,
        type: this.formatRateType(rate.rateType),
        amount: rate.rateAmount,
        description: this.getRateDescription(rate.rateType),
        usage: Number(totalHours), // Keep as decimal to maintain precision
        change: this.calculateRateChange(rate),
        isActive: rate.isActive,
        lastUsed: this.formatLastUsed(rate.updatedAt || rate.createdAt),
        totalBilled: Number(totalBilled),
        effectiveDate: rate.effectiveDate
      };
    });
    
    // Adjust the last active rate to ensure the sum matches the analytics total
    const activeRateCards = this.rateCards.filter(rate => rate.isActive);
    const totalFromAnalytics = this.analytics.totalEntries;
    const currentSum = activeRateCards.reduce((sum, rate) => sum + rate.usage, 0);
    if (activeRateCards.length > 0 && currentSum !== totalFromAnalytics) {
      const lastActiveRate = activeRateCards[activeRateCards.length - 1];
      lastActiveRate.usage = lastActiveRate.usage + (totalFromAnalytics - currentSum);
    }
  }



  private calculateRateChange(rate: BillingRate): number {
    // In a real system, this would compare with previous rates
    // For now, return 0 as we don't have historical data
    return 0;
  }

  private formatLastUsed(date?: Date): string {
    if (!date) return 'Never';
    
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - new Date(date).getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  }

  private loadAnalytics(userId: number): Promise<void> {
    return new Promise((resolve) => {
      const activeRates = this.billingRates.filter(r => r.isActive);
      
      // Load real analytics from backend
      const averageRatePromise = this.billingRateService.getAverageRateByUser(userId).toPromise();
      const usageAnalyticsPromise = this.billingRateService.getBillingRateUsageAnalytics(userId).toPromise();
      const timeEntriesPromise = this.billingRateService.getTimeEntriesByBillingRate(userId).toPromise();
      
      Promise.all([averageRatePromise, usageAnalyticsPromise, timeEntriesPromise]).then(([averageRate, usageAnalytics, timeEntriesData]) => {
        // Store real usage data for individual rates
        if (timeEntriesData && timeEntriesData.rateGroups) {
          this.realUsageData = {};
          Object.keys(timeEntriesData.rateGroups).forEach(key => {
            const rateData = timeEntriesData.rateGroups[key];
            if (rateData.rateId) {
              this.realUsageData[rateData.rateId] = rateData;
            }
          });
        }
        
        // Use real analytics data
        this.analytics = {
          averageRate: averageRate || usageAnalytics?.averageRate || 0,
          totalEntries: Math.round(usageAnalytics?.usageStatistics?.totalHoursBilled || 0),
          activeRates: usageAnalytics?.activeRates || activeRates.length,
          totalBilled: timeEntriesData?.summary?.totalAmountBilled || usageAnalytics?.usageStatistics?.totalAmountBilled || 0
        };
        
        // Re-process rate cards now that we have real usage data
        this.processRateCards();

        resolve();
      }).catch((error) => {
        console.warn('Failed to load analytics, using fallback:', error);
        this.analytics = {
          averageRate: activeRates.length > 0 
            ? activeRates.reduce((sum, r) => sum + r.rateAmount, 0) / activeRates.length 
            : 0,
          totalEntries: 0,
          activeRates: activeRates.length,
          totalBilled: 0
        };
        
        // Still process rate cards even with fallback data
        this.processRateCards();
        
        resolve();
      });
    });
  }



  // Modal management
  openRateModal(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    this.rateForm.reset({
      rateType: 'STANDARD',
      effectiveDate: new Date().toISOString().split('T')[0],
      isActive: true
    });
    this.showRateModal = true;
    document.body.classList.add('modal-open');
    this.changeDetectorRef.detectChanges();
  }

  closeRateModal(): void {
    this.showRateModal = false;
    document.body.classList.remove('modal-open');
    this.rateForm.reset();
    this.changeDetectorRef.detectChanges();
  }

  openEditModal(rate: RateCard, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    this.editingRate = this.billingRates.find(r => r.id === rate.id) || null;
    if (this.editingRate) {
      this.rateForm.patchValue({
        rateType: this.editingRate.rateType,
        rateAmount: this.editingRate.rateAmount,
        effectiveDate: this.editingRate.effectiveDate,
        endDate: this.editingRate.endDate || '',
        isActive: this.editingRate.isActive,
        description: ''
      });
    }
    this.showEditModal = true;
    document.body.classList.add('modal-open');
    this.changeDetectorRef.detectChanges();
  }

  closeEditModal(): void {
    this.showEditModal = false;
    document.body.classList.remove('modal-open');
    this.editingRate = null;
    this.rateForm.reset();
    this.changeDetectorRef.detectChanges();
  }

  // CRUD operations
  saveRate(): void {
    if (this.rateForm.invalid || this.isProcessing) return;

    this.isProcessing = true;
    const formValue = this.rateForm.value;
    const currentUserId = this.getCurrentUserId();

    if (!currentUserId) {
      this.showErrorMessage('User authentication required');
      this.isProcessing = false;
      return;
    }

    const billingRate: BillingRate = {
      userId: currentUserId,
      rateType: formValue.rateType,
      rateAmount: formValue.rateAmount,
      effectiveDate: formValue.effectiveDate,
      endDate: formValue.endDate || undefined,
      isActive: formValue.isActive
    };

    const sub = this.billingRateService.createBillingRate(billingRate).subscribe({
      next: () => {
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

  updateRate(): void {
    if (this.rateForm.invalid || this.isProcessing || !this.editingRate) return;

    this.isProcessing = true;
    const formValue = this.rateForm.value;

    const updatedRate: BillingRate = {
      ...this.editingRate,
      rateType: formValue.rateType,
      rateAmount: formValue.rateAmount,
      effectiveDate: formValue.effectiveDate,
      endDate: formValue.endDate || undefined,
      isActive: formValue.isActive
    };

    const sub = this.billingRateService.updateBillingRate(this.editingRate.id!, updatedRate).subscribe({
      next: () => {
        this.showSuccessMessage('Rate updated successfully');
        this.closeEditModal();
        this.loadData();
        this.isProcessing = false;
      },
      error: (error) => {
        console.error('Error updating rate:', error);
        this.showErrorMessage('Failed to update rate. Please try again.');
        this.isProcessing = false;
      }
    });
    this.subscriptions.push(sub);
  }

  deleteRate(rate: RateCard): void {
    Swal.fire({
      title: 'Delete Rate',
      text: `Are you sure you want to delete the ${rate.type} rate?`,
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

  toggleRateStatus(rate: RateCard): void {
    const action = rate.isActive ? 'deactivate' : 'activate';
    Swal.fire({
      title: `${action.charAt(0).toUpperCase() + action.slice(1)} Rate`,
      text: `Are you sure you want to ${action} the ${rate.type} rate?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: action.charAt(0).toUpperCase() + action.slice(1),
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed && rate.id) {
        const billingRate = this.billingRates.find(r => r.id === rate.id);
        if (billingRate) {
          const updatedRate = { ...billingRate, isActive: !rate.isActive };
          const sub = this.billingRateService.updateBillingRate(rate.id, updatedRate).subscribe({
        next: () => {
              this.showSuccessMessage(`Rate ${action}d successfully`);
              this.loadData();
        },
        error: (error) => {
              console.error(`Error ${action}ing rate:`, error);
              this.showErrorMessage(`Failed to ${action} rate. Please try again.`);
        }
      });
          this.subscriptions.push(sub);
    }
  }
    });
  }

  // Utility methods
  get filteredRateCards(): RateCard[] {
    let filtered = [...this.rateCards];

    if (this.searchTerm) {
      filtered = filtered.filter(rate => 
        rate.type.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        rate.description.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    }

    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(rate => 
        this.statusFilter === 'active' ? rate.isActive : !rate.isActive
      );
    }

    return filtered;
  }

  exportRates(): void {
    const csvData = this.rateCards.map(rate => ({
      'Rate Type': rate.type,
      'Amount': rate.amount,
      'Status': rate.isActive ? 'Active' : 'Inactive',
      'Usage Count': rate.usage,
      'Total Billed': rate.totalBilled,
      'Effective Date': rate.effectiveDate
    }));

    const csv = this.convertToCSV(csvData);
    this.downloadCSV(csv, 'billing-rates.csv');
  }

  private convertToCSV(data: any[]): string {
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).join(','));
    return [headers, ...rows].join('\n');
  }

  private downloadCSV(csv: string, filename: string): void {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  private formatRateType(type: string): string {
    const types: { [key: string]: string } = {
      'STANDARD': 'Standard Rate',
      'PREMIUM': 'Premium Rate',
      'DISCOUNTED': 'Discounted Rate',
      'EMERGENCY': 'Emergency Rate',
      'PRO_BONO': 'Pro Bono'
    };
    return types[type] || type;
  }

  private getRateDescription(type: string): string {
    const descriptions: { [key: string]: string } = {
      'STANDARD': 'General legal work and consultation',
      'PREMIUM': 'Complex litigation and specialized work',
      'DISCOUNTED': 'Reduced rate for specific clients',
      'EMERGENCY': 'After-hours urgent work',
      'PRO_BONO': 'Charitable and community work'
    };
    return descriptions[type] || 'Custom rate type';
  }



  private getCurrentUserId(): number | null {
    const user = this.userService.getCurrentUser();
    return user ? user.id : null;
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

  // Utility methods for enhanced template
  trackByRateId(index: number, rate: RateCard): number | undefined {
    return rate.id;
  }

  getDateDifference(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 30) return `${diffDays} days ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  }

  getMaxUsage(): number {
    if (this.rateCards.length === 0) return 100;
    return Math.max(...this.rateCards.map(rate => rate.usage));
  }


} 