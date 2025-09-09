import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface Lead {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  source: string;
  status: string;
  priority: string;
  assignedTo?: number;
  leadScore: number;
  notes?: string;
  initialInquiry?: string;
  estimatedCaseValue?: number;
  practiceArea: string;
  referralSource?: string;
  marketingCampaign?: string;
  consultationDate?: Date;
  followUpDate?: Date;
  lostReason?: string;
  urgencyLevel: string;
  leadQuality: string;
  referralQualityScore: number;
  clientBudgetRange?: string;
  competitorFirms?: string;
  geographicLocation?: string;
  communicationPreference: string;
  bestContactTime?: string;
  caseComplexity: string;
  createdAt: Date;
  updatedAt: Date;
  convertedAt?: Date;
  assignedUser?: {
    id: number;
    firstName: string;
    lastName: string;
  };
}

export interface PipelineStage {
  id: number;
  name: string;
  description?: string;
  stageOrder: number;
  isActive: boolean;
  color: string;
  icon: string;
  isInitial: boolean;
  isFinal: boolean;
  autoActions?: any;
  requiredFields?: any;
  estimatedDays: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeadActivity {
  id: number;
  leadId: number;
  activityType: string;
  title: string;
  description?: string;
  activityDate: Date;
  durationMinutes?: number;
  outcome?: string;
  followUpDate?: Date;
  isBillable: boolean;
  billableRate?: number;
  relatedDocumentId?: number;
  externalId?: string;
  metadata?: any;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
  creator?: {
    id: number;
    firstName: string;
    lastName: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class LeadService {
  private apiUrl = `${environment.apiUrl}/api/crm/leads`;

  constructor(private http: HttpClient) {}

  // Lead CRUD operations
  getLeads(params?: any): Observable<Lead[]> {
    return this.http.get<Lead[]>(this.apiUrl, { params });
  }

  getLeadById(id: number): Observable<Lead> {
    return this.http.get<Lead>(`${this.apiUrl}/${id}`);
  }

  createLead(lead: Partial<Lead>): Observable<Lead> {
    return this.http.post<Lead>(this.apiUrl, lead);
  }

  updateLead(id: number, lead: Partial<Lead>): Observable<Lead> {
    return this.http.put<Lead>(`${this.apiUrl}/${id}`, lead);
  }

  deleteLead(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  // Pipeline operations
  getPipelineStages(): Observable<PipelineStage[]> {
    return this.http.get<PipelineStage[]>(`${this.apiUrl}/pipeline-stages`);
  }

  moveLeadToStage(leadId: number, stageId: number, notes?: string): Observable<Lead> {
    return this.http.post<Lead>(`${this.apiUrl}/${leadId}/move-to-stage`, {
      stageId,
      notes
    });
  }

  getLeadsByStage(stageId: number): Observable<Lead[]> {
    return this.http.get<Lead[]>(`${this.apiUrl}/by-stage/${stageId}`);
  }

  getPipelineOverview(): Observable<{ [key: string]: Lead[] }> {
    return this.http.get<{ [key: string]: Lead[] }>(`${this.apiUrl}/pipeline-overview`);
  }

  // Lead assignment
  assignLead(leadId: number, assignedTo: number, notes?: string): Observable<Lead> {
    return this.http.post<Lead>(`${this.apiUrl}/${leadId}/assign`, {
      assignedTo,
      notes
    });
  }

  bulkAssign(leadIds: number[], assignedTo: number, notes?: string): Observable<Lead[]> {
    return this.http.post<Lead[]>(`${this.apiUrl}/bulk/assign`, {
      leadIds,
      assignedTo,
      notes
    });
  }

  // Lead activities
  getLeadActivities(leadId: number): Observable<LeadActivity[]> {
    return this.http.get<LeadActivity[]>(`${this.apiUrl}/${leadId}/activities`);
  }

  addLeadActivity(leadId: number, activity: Partial<LeadActivity>): Observable<LeadActivity> {
    return this.http.post<LeadActivity>(`${this.apiUrl}/${leadId}/activities`, activity);
  }

  updateLeadActivity(leadId: number, activityId: number, activity: Partial<LeadActivity>): Observable<LeadActivity> {
    return this.http.put<LeadActivity>(`${this.apiUrl}/${leadId}/activities/${activityId}`, activity);
  }

  deleteLeadActivity(leadId: number, activityId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${leadId}/activities/${activityId}`);
  }

  // Lead scoring
  calculateLeadScore(leadId: number): Observable<{ leadId: number; score: number; factors: any }> {
    return this.http.post<{ leadId: number; score: number; factors: any }>(`${this.apiUrl}/${leadId}/calculate-score`, {});
  }

  updateLeadScore(leadId: number, score: number): Observable<Lead> {
    return this.http.put<Lead>(`${this.apiUrl}/${leadId}/score`, { score });
  }

  // Lead conversion
  convertToClient(leadId: number, clientData: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${leadId}/convert/client`, clientData);
  }

  convertToMatter(leadId: number, matterData: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${leadId}/convert/matter`, matterData);
  }

  convertToClientAndMatter(leadId: number, clientData: any, matterData: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/${leadId}/convert/client-and-matter`, {
      clientData,
      matterData
    });
  }

  // Analytics
  getLeadAnalytics(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/analytics`);
  }

  getConversionFunnel(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/analytics/conversion-funnel`);
  }

  getLeadSourceAnalytics(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/analytics/lead-sources`);
  }
}