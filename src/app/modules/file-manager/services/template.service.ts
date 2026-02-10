import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { FolderTemplate, PracticeArea, TemplateFolderStructure, CreateTemplateRequest, ApplyTemplateRequest, FirmTemplateCustomization, CreateFirmTemplateRequest } from '../models/template.model';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TemplateService {
  private readonly API_BASE = `${environment.apiUrl}/api/file-manager/templates`;

  constructor(private http: HttpClient) {}

  /**
   * Get all available templates
   */
  getTemplates(): Observable<FolderTemplate[]> {
    // Return predefined templates for now
    return of(this.getPredefinedTemplates());
  }

  /**
   * Get template by ID
   */
  getTemplate(templateId: string): Observable<FolderTemplate> {
    const templates = this.getPredefinedTemplates();
    const template = templates.find(t => t.id === templateId);
    return of(template!);
  }

  /**
   * Get templates by practice area
   */
  getTemplatesByPracticeArea(practiceArea: PracticeArea): Observable<FolderTemplate[]> {
    const templates = this.getPredefinedTemplates();
    return of(templates.filter(t => t.practiceArea === practiceArea));
  }

  /**
   * Create custom template
   */
  createTemplate(request: CreateTemplateRequest): Observable<FolderTemplate> {
    return this.http.post<FolderTemplate>(this.API_BASE, request);
  }

  /**
   * Apply template to case
   */
  applyTemplate(request: ApplyTemplateRequest): Observable<any> {
    return this.http.post(`${this.API_BASE}/apply`, request);
  }

  /**
   * Get firm-specific template customizations
   */
  getFirmTemplateCustomizations(firmId: string): Observable<FirmTemplateCustomization[]> {
    return this.http.get<FirmTemplateCustomization[]>(`${this.API_BASE}/firm/${firmId}/customizations`).pipe(
      catchError(() => {
        // Return empty array if API is not available
        return of([]);
      })
    );
  }

  /**
   * Create firm-specific template customization
   */
  createFirmTemplateCustomization(request: CreateFirmTemplateRequest): Observable<FirmTemplateCustomization> {
    return this.http.post<FirmTemplateCustomization>(`${this.API_BASE}/firm/customizations`, request);
  }

  /**
   * Get templates for specific firm (includes both default and firm-customized)
   */
  getTemplatesForFirm(firmId: string): Observable<FolderTemplate[]> {
    return this.http.get<FolderTemplate[]>(`${this.API_BASE}/firm/${firmId}/templates`);
  }

  /**
   * Update firm template customization
   */
  updateFirmTemplateCustomization(customizationId: string, request: CreateFirmTemplateRequest): Observable<FirmTemplateCustomization> {
    return this.http.put<FirmTemplateCustomization>(`${this.API_BASE}/firm/customizations/${customizationId}`, request);
  }

  /**
   * Delete firm template customization
   */
  deleteFirmTemplateCustomization(customizationId: string): Observable<void> {
    return this.http.delete<void>(`${this.API_BASE}/firm/customizations/${customizationId}`);
  }

  /**
   * Get predefined templates for different practice areas
   */
  private getPredefinedTemplates(): FolderTemplate[] {
    return [
      {
        id: 'litigation-standard',
        name: 'Standard Litigation',
        description: 'Complete folder structure for litigation cases',
        practiceArea: PracticeArea.LITIGATION,
        isDefault: true,
        isCustom: false,
        folders: [
          {
            name: '01-Pleadings',
            description: 'All court filings and pleadings',
            isRequired: true,
            documentTypes: ['Complaint', 'Answer', 'Motion', 'Brief'],
            subFolders: [
              { name: 'Initial Pleadings', isRequired: true },
              { name: 'Motions', isRequired: true },
              { name: 'Responses', isRequired: true }
            ]
          },
          {
            name: '02-Discovery',
            description: 'Discovery materials and responses',
            isRequired: true,
            documentTypes: ['Interrogatories', 'Depositions', 'Document Requests'],
            subFolders: [
              { name: 'Interrogatories', isRequired: true },
              { name: 'Document Production', isRequired: true },
              { name: 'Depositions', isRequired: true },
              { name: 'Expert Reports', isRequired: false }
            ]
          },
          {
            name: '03-Evidence',
            description: 'Evidence and exhibits',
            isRequired: true,
            subFolders: [
              { name: 'Physical Evidence', isRequired: false },
              { name: 'Digital Evidence', isRequired: false },
              { name: 'Exhibits', isRequired: true }
            ]
          },
          {
            name: '04-Correspondence',
            description: 'All case correspondence',
            isRequired: true,
            subFolders: [
              { name: 'Client Communications', isRequired: true },
              { name: 'Opposing Counsel', isRequired: true },
              { name: 'Court Communications', isRequired: true }
            ]
          },
          {
            name: '05-Research',
            description: 'Legal research and memoranda',
            isRequired: true,
            subFolders: [
              { name: 'Case Law', isRequired: true },
              { name: 'Statutes', isRequired: true },
              { name: 'Legal Memos', isRequired: true }
            ]
          },
          {
            name: '06-Settlement',
            description: 'Settlement negotiations and agreements',
            isRequired: false,
            subFolders: [
              { name: 'Negotiations', isRequired: false },
              { name: 'Agreements', isRequired: false }
            ]
          }
        ]
      },
      {
        id: 'corporate-standard',
        name: 'Standard Corporate',
        description: 'Folder structure for corporate law matters',
        practiceArea: PracticeArea.CORPORATE,
        isDefault: true,
        isCustom: false,
        folders: [
          {
            name: '01-Formation',
            description: 'Corporate formation documents',
            isRequired: true,
            subFolders: [
              { name: 'Articles of Incorporation', isRequired: true },
              { name: 'Bylaws', isRequired: true },
              { name: 'Board Resolutions', isRequired: true }
            ]
          },
          {
            name: '02-Contracts',
            description: 'Corporate contracts and agreements',
            isRequired: true,
            subFolders: [
              { name: 'Service Agreements', isRequired: false },
              { name: 'Employment Contracts', isRequired: false },
              { name: 'Vendor Agreements', isRequired: false }
            ]
          },
          {
            name: '03-Compliance',
            description: 'Regulatory compliance documents',
            isRequired: true,
            subFolders: [
              { name: 'Annual Reports', isRequired: true },
              { name: 'SEC Filings', isRequired: false },
              { name: 'Tax Documents', isRequired: true }
            ]
          },
          {
            name: '04-Governance',
            description: 'Corporate governance materials',
            isRequired: true,
            subFolders: [
              { name: 'Board Minutes', isRequired: true },
              { name: 'Shareholder Meetings', isRequired: true },
              { name: 'Policies', isRequired: true }
            ]
          }
        ]
      },
      {
        id: 'family-standard',
        name: 'Standard Family Law',
        description: 'Folder structure for family law cases',
        practiceArea: PracticeArea.FAMILY,
        isDefault: true,
        isCustom: false,
        folders: [
          {
            name: '01-Divorce-Proceedings',
            description: 'Divorce case documents',
            isRequired: true,
            subFolders: [
              { name: 'Petition and Response', isRequired: true },
              { name: 'Financial Disclosure', isRequired: true },
              { name: 'Temporary Orders', isRequired: false }
            ]
          },
          {
            name: '02-Child-Custody',
            description: 'Child custody and support matters',
            isRequired: false,
            subFolders: [
              { name: 'Custody Agreements', isRequired: false },
              { name: 'Visitation Schedules', isRequired: false },
              { name: 'Child Support', isRequired: false }
            ]
          },
          {
            name: '03-Financial-Records',
            description: 'Financial documentation',
            isRequired: true,
            subFolders: [
              { name: 'Income Documentation', isRequired: true },
              { name: 'Asset Valuation', isRequired: true },
              { name: 'Debt Records', isRequired: true }
            ]
          },
          {
            name: '04-Settlement',
            description: 'Settlement negotiations and agreements',
            isRequired: false,
            subFolders: [
              { name: 'Mediation', isRequired: false },
              { name: 'Settlement Agreements', isRequired: false }
            ]
          }
        ]
      },
      {
        id: 'real-estate-standard',
        name: 'Standard Real Estate',
        description: 'Folder structure for real estate transactions',
        practiceArea: PracticeArea.REAL_ESTATE,
        isDefault: true,
        isCustom: false,
        folders: [
          {
            name: '01-Purchase-Agreement',
            description: 'Purchase and sale agreements',
            isRequired: true,
            subFolders: [
              { name: 'Original Agreement', isRequired: true },
              { name: 'Amendments', isRequired: false },
              { name: 'Addenda', isRequired: false }
            ]
          },
          {
            name: '02-Title-Work',
            description: 'Title and ownership documents',
            isRequired: true,
            subFolders: [
              { name: 'Title Search', isRequired: true },
              { name: 'Title Insurance', isRequired: true },
              { name: 'Survey', isRequired: true }
            ]
          },
          {
            name: '03-Financing',
            description: 'Loan and financing documents',
            isRequired: false,
            subFolders: [
              { name: 'Loan Application', isRequired: false },
              { name: 'Mortgage Documents', isRequired: false },
              { name: 'Appraisal', isRequired: false }
            ]
          },
          {
            name: '04-Closing',
            description: 'Closing documents and settlement',
            isRequired: true,
            subFolders: [
              { name: 'Closing Disclosure', isRequired: true },
              { name: 'Deed', isRequired: true },
              { name: 'Settlement Statement', isRequired: true }
            ]
          }
        ]
      },
      {
        id: 'criminal-standard',
        name: 'Standard Criminal Defense',
        description: 'Folder structure for criminal defense cases',
        practiceArea: PracticeArea.CRIMINAL,
        isDefault: true,
        isCustom: false,
        folders: [
          {
            name: '01-Charges-Indictment',
            description: 'Charges and indictment documents',
            isRequired: true,
            subFolders: [
              { name: 'Initial Charges', isRequired: true },
              { name: 'Indictment', isRequired: false },
              { name: 'Arrest Records', isRequired: true }
            ]
          },
          {
            name: '02-Discovery',
            description: 'Prosecution discovery materials',
            isRequired: true,
            subFolders: [
              { name: 'Police Reports', isRequired: true },
              { name: 'Witness Statements', isRequired: false },
              { name: 'Physical Evidence', isRequired: false }
            ]
          },
          {
            name: '03-Defense-Strategy',
            description: 'Defense preparation materials',
            isRequired: true,
            subFolders: [
              { name: 'Client Interviews', isRequired: true },
              { name: 'Defense Witnesses', isRequired: false },
              { name: 'Expert Reports', isRequired: false }
            ]
          },
          {
            name: '04-Motions',
            description: 'Pre-trial and trial motions',
            isRequired: true,
            subFolders: [
              { name: 'Pre-trial Motions', isRequired: true },
              { name: 'Evidence Motions', isRequired: false },
              { name: 'Sentencing Motions', isRequired: false }
            ]
          },
          {
            name: '05-Plea-Negotiations',
            description: 'Plea bargain discussions',
            isRequired: false,
            subFolders: [
              { name: 'Prosecution Offers', isRequired: false },
              { name: 'Plea Agreements', isRequired: false }
            ]
          }
        ]
      },
      {
        id: 'personal-injury-standard',
        name: 'Standard Personal Injury',
        description: 'Complete folder structure for personal injury cases',
        practiceArea: PracticeArea.PERSONAL_INJURY,
        isDefault: true,
        isCustom: false,
        folders: [
          {
            name: '01-Intake-Client-Information',
            description: 'Client intake and initial case information',
            isRequired: true,
            subFolders: [
              { name: 'Retainer Agreements', isRequired: true },
              { name: 'Client Questionnaires', isRequired: true },
              { name: 'Initial Consultation Notes', isRequired: true }
            ]
          },
          {
            name: '02-Medical-Records',
            description: 'All medical documentation related to the injury',
            isRequired: true,
            subFolders: [
              { name: 'Hospital Records', isRequired: true },
              { name: 'Treatment Records', isRequired: true },
              { name: 'Pharmacy Records', isRequired: false },
              { name: 'Expert Medical Reports', isRequired: false }
            ]
          },
          {
            name: '03-Damages-Documentation',
            description: 'Documentation of all damages suffered',
            isRequired: true,
            subFolders: [
              { name: 'Medical Bills', isRequired: true },
              { name: 'Lost Wages', isRequired: true },
              { name: 'Property Damage', isRequired: false },
              { name: 'Pain and Suffering', isRequired: false }
            ]
          },
          {
            name: '04-Insurance',
            description: 'Insurance policies and communications',
            isRequired: true,
            subFolders: [
              { name: 'Policy Documents', isRequired: true },
              { name: 'Claim Correspondence', isRequired: true },
              { name: 'Adjustor Communications', isRequired: false }
            ]
          },
          {
            name: '05-Pleadings',
            description: 'Court filings and pleadings',
            isRequired: true,
            subFolders: [
              { name: 'Complaint', isRequired: true },
              { name: 'Motions', isRequired: true },
              { name: 'Responses', isRequired: true }
            ]
          },
          {
            name: '06-Discovery',
            description: 'Discovery materials and responses',
            isRequired: true,
            subFolders: [
              { name: 'Interrogatories', isRequired: true },
              { name: 'Document Requests', isRequired: true },
              { name: 'Depositions', isRequired: true },
              { name: 'Expert Reports', isRequired: false }
            ]
          },
          {
            name: '07-Evidence',
            description: 'Physical and documentary evidence',
            isRequired: true,
            subFolders: [
              { name: 'Accident Scene Photos', isRequired: true },
              { name: 'Police Reports', isRequired: true },
              { name: 'Witness Statements', isRequired: false },
              { name: 'Surveillance', isRequired: false }
            ]
          },
          {
            name: '08-Correspondence',
            description: 'All case correspondence',
            isRequired: true,
            subFolders: [
              { name: 'Client Communications', isRequired: true },
              { name: 'Opposing Counsel', isRequired: true },
              { name: 'Insurance Communications', isRequired: true },
              { name: 'Court Communications', isRequired: true }
            ]
          },
          {
            name: '09-Settlement-Trial',
            description: 'Settlement negotiations and trial preparation',
            isRequired: false,
            subFolders: [
              { name: 'Demand Letters', isRequired: false },
              { name: 'Mediation', isRequired: false },
              { name: 'Settlement Agreements', isRequired: false },
              { name: 'Trial Preparation', isRequired: false }
            ]
          },
          {
            name: '10-Liens-Subrogation',
            description: 'Liens and subrogation claims',
            isRequired: false,
            subFolders: [
              { name: 'Medical Liens', isRequired: false },
              { name: 'Medicare-Medicaid', isRequired: false },
              { name: 'Workers Compensation', isRequired: false }
            ]
          }
        ]
      }
    ];
  }
}