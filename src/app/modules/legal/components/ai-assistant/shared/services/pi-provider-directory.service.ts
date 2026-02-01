import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../../../../../environments/environment';

/**
 * Provider directory entry
 */
export interface ProviderDirectory {
  id?: number;
  organizationId?: number;
  providerName: string;
  providerType?: string;
  npi?: string;
  mainPhone?: string;
  mainEmail?: string;
  mainFax?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  recordsContactName?: string;
  recordsPhone?: string;
  recordsEmail?: string;
  recordsFax?: string;
  billingContactName?: string;
  billingPhone?: string;
  billingEmail?: string;
  billingFax?: string;
  baseFee?: number;
  perPageFee?: number;
  rushFee?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: number;
  createdByName?: string;
  fullAddress?: string;
  hasRecordsContact?: boolean;
  hasBillingContact?: boolean;
}

/**
 * Provider statistics
 */
export interface ProviderStats {
  totalProviders: number;
  withRecordsContact: number;
  withBillingContact: number;
}

/**
 * Service for PI Provider Directory operations.
 * CRUD operations for managing medical provider contact information.
 */
@Injectable({
  providedIn: 'root'
})
export class PIProviderDirectoryService {

  private baseUrl = `${environment.apiUrl}/api/pi/provider-directory`;

  constructor(private http: HttpClient) {}

  /**
   * Get all providers for the organization.
   */
  getAllProviders(): Observable<ProviderDirectory[]> {
    return this.http.get<any>(this.baseUrl).pipe(
      map(response => response.providers)
    );
  }

  /**
   * Search providers by name, address, or NPI.
   */
  searchProviders(search: string): Observable<ProviderDirectory[]> {
    return this.http.get<any>(`${this.baseUrl}?search=${encodeURIComponent(search)}`).pipe(
      map(response => response.providers)
    );
  }

  /**
   * Get providers by type.
   */
  getProvidersByType(type: string): Observable<ProviderDirectory[]> {
    return this.http.get<any>(`${this.baseUrl}?type=${encodeURIComponent(type)}`).pipe(
      map(response => response.providers)
    );
  }

  /**
   * Get a specific provider by ID.
   */
  getProviderById(id: number): Observable<ProviderDirectory> {
    return this.http.get<any>(`${this.baseUrl}/${id}`).pipe(
      map(response => response.provider)
    );
  }

  /**
   * Create a new provider.
   */
  createProvider(provider: ProviderDirectory): Observable<ProviderDirectory> {
    return this.http.post<any>(this.baseUrl, provider).pipe(
      map(response => response.provider)
    );
  }

  /**
   * Update an existing provider.
   */
  updateProvider(id: number, provider: ProviderDirectory): Observable<ProviderDirectory> {
    return this.http.put<any>(`${this.baseUrl}/${id}`, provider).pipe(
      map(response => response.provider)
    );
  }

  /**
   * Delete a provider.
   */
  deleteProvider(id: number): Observable<void> {
    return this.http.delete<any>(`${this.baseUrl}/${id}`).pipe(
      map(() => undefined)
    );
  }

  /**
   * Get providers with records department contact info.
   */
  getProvidersWithRecordsContact(): Observable<ProviderDirectory[]> {
    return this.http.get<any>(`${this.baseUrl}/with-records-contact`).pipe(
      map(response => response.providers)
    );
  }

  /**
   * Get providers with billing department contact info.
   */
  getProvidersWithBillingContact(): Observable<ProviderDirectory[]> {
    return this.http.get<any>(`${this.baseUrl}/with-billing-contact`).pipe(
      map(response => response.providers)
    );
  }

  /**
   * Save provider from medical record data.
   */
  saveProviderFromMedicalRecord(medicalRecordId: number): Observable<ProviderDirectory> {
    return this.http.post<any>(`${this.baseUrl}/from-medical-record/${medicalRecordId}`, {}).pipe(
      map(response => response.provider)
    );
  }

  /**
   * Get provider statistics.
   */
  getProviderStats(): Observable<ProviderStats> {
    return this.http.get<any>(`${this.baseUrl}/stats`).pipe(
      map(response => response.stats)
    );
  }

  // ========================
  // Helper Methods
  // ========================

  /**
   * Provider types for dropdown
   */
  getProviderTypes(): { value: string; label: string }[] {
    return [
      { value: 'HOSPITAL', label: 'Hospital' },
      { value: 'CLINIC', label: 'Clinic' },
      { value: 'SPECIALIST', label: 'Specialist Office' },
      { value: 'IMAGING', label: 'Imaging Center' },
      { value: 'PHYSICAL_THERAPY', label: 'Physical Therapy' },
      { value: 'CHIROPRACTIC', label: 'Chiropractic' },
      { value: 'PHARMACY', label: 'Pharmacy' },
      { value: 'LABORATORY', label: 'Laboratory' },
      { value: 'SURGERY_CENTER', label: 'Surgery Center' },
      { value: 'OTHER', label: 'Other' }
    ];
  }

  /**
   * Get provider type label
   */
  getProviderTypeLabel(type: string): string {
    const found = this.getProviderTypes().find(t => t.value === type);
    return found?.label || type;
  }

  /**
   * Format phone number for display
   */
  formatPhone(phone: string | null | undefined): string {
    if (!phone) return '';
    // Remove non-digits
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    if (digits.length === 11 && digits.startsWith('1')) {
      return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return phone;
  }
}
