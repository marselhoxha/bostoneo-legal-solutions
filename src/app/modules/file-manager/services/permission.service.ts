import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { 
  Permission, 
  PermissionSet, 
  InheritanceRule, 
  PermissionInheritanceConfig,
  AppliedPermission,
  CreatePermissionSetRequest,
  CreateInheritanceRuleRequest,
  UpdatePermissionRequest,
  PermissionType,
  PermissionScope,
  InheritanceSourceType,
  InheritanceTargetType
} from '../models/permission.model';
import { environment } from '../../../../environments/environment';
import { Key } from '../../../enum/key.enum';

@Injectable({
  providedIn: 'root'
})
export class PermissionService {
  private readonly API_BASE = `${environment.apiUrl}/api/file-manager/permissions`;
  
  constructor(private http: HttpClient) {}
  
  // Helper method to get auth headers
  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem(Key.TOKEN);
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }
  
  /**
   * Get all available permissions
   */
  getAvailablePermissions(): Observable<Permission[]> {
    return this.http.get<Permission[]>(`${this.API_BASE}/available`, {
      headers: this.getAuthHeaders()
    });
  }
  
  /**
   * Get predefined permission sets
   */
  getPredefinedPermissionSets(): Observable<PermissionSet[]> {
    // For now, return mock data
    return of(this.getMockPermissionSets());
  }
  
  /**
   * Create custom permission set
   */
  createPermissionSet(request: CreatePermissionSetRequest): Observable<PermissionSet> {
    return this.http.post<PermissionSet>(`${this.API_BASE}/sets`, request, {
      headers: this.getAuthHeaders()
    });
  }
  
  /**
   * Get inheritance rules
   */
  getInheritanceRules(firmId: string): Observable<InheritanceRule[]> {
    return this.http.get<InheritanceRule[]>(`${this.API_BASE}/firm/${firmId}/inheritance-rules`, {
      headers: this.getAuthHeaders()
    }).pipe(
      catchError(() => {
        // Return mock data if API is not available
        return of(this.getMockInheritanceRules());
      })
    );
  }
  
  /**
   * Create inheritance rule
   */
  createInheritanceRule(firmId: string, request: CreateInheritanceRuleRequest): Observable<InheritanceRule> {
    return this.http.post<InheritanceRule>(`${this.API_BASE}/firm/${firmId}/inheritance-rules`, request, {
      headers: this.getAuthHeaders()
    });
  }
  
  /**
   * Update inheritance rule
   */
  updateInheritanceRule(ruleId: string, request: CreateInheritanceRuleRequest): Observable<InheritanceRule> {
    return this.http.put<InheritanceRule>(`${this.API_BASE}/inheritance-rules/${ruleId}`, request, {
      headers: this.getAuthHeaders()
    }).pipe(
      catchError(() => {
        // Simulate success for demo
        return of({ ...request, id: ruleId, isActive: true } as InheritanceRule);
      })
    );
  }
  
  /**
   * Delete inheritance rule
   */
  deleteInheritanceRule(ruleId: string): Observable<void> {
    return this.http.delete<void>(`${this.API_BASE}/inheritance-rules/${ruleId}`, {
      headers: this.getAuthHeaders()
    });
  }
  
  /**
   * Get permission inheritance config for firm
   */
  getInheritanceConfig(firmId: string): Observable<PermissionInheritanceConfig> {
    return this.http.get<PermissionInheritanceConfig>(`${this.API_BASE}/firm/${firmId}/config`, {
      headers: this.getAuthHeaders()
    }).pipe(
      catchError(() => {
        // Return mock config if API is not available
        return of(this.getMockInheritanceConfig());
      })
    );
  }
  
  /**
   * Update permission inheritance config
   */
  updateInheritanceConfig(firmId: string, config: PermissionInheritanceConfig): Observable<PermissionInheritanceConfig> {
    return this.http.put<PermissionInheritanceConfig>(`${this.API_BASE}/firm/${firmId}/config`, config, {
      headers: this.getAuthHeaders()
    });
  }
  
  /**
   * Get applied permissions for resource
   */
  getResourcePermissions(resourceId: string, resourceType: 'file' | 'folder'): Observable<AppliedPermission[]> {
    return this.http.get<AppliedPermission[]>(`${this.API_BASE}/resource/${resourceType}/${resourceId}`, {
      headers: this.getAuthHeaders()
    });
  }
  
  /**
   * Update resource permissions
   */
  updateResourcePermissions(request: UpdatePermissionRequest): Observable<AppliedPermission[]> {
    return this.http.put<AppliedPermission[]>(`${this.API_BASE}/resource/update`, request, {
      headers: this.getAuthHeaders()
    });
  }
  
  /**
   * Apply inheritance to resource
   */
  applyInheritanceToResource(resourceId: string, resourceType: 'file' | 'folder', applyToChildren: boolean = false): Observable<AppliedPermission[]> {
    return this.http.post<AppliedPermission[]>(`${this.API_BASE}/resource/${resourceType}/${resourceId}/apply-inheritance`, {
      applyToChildren
    }, {
      headers: this.getAuthHeaders()
    });
  }
  
  /**
   * Preview inheritance for resource
   */
  previewInheritance(resourceId: string, resourceType: 'file' | 'folder'): Observable<AppliedPermission[]> {
    return this.http.get<AppliedPermission[]>(`${this.API_BASE}/resource/${resourceType}/${resourceId}/preview-inheritance`, {
      headers: this.getAuthHeaders()
    });
  }
  
  /**
   * Get mock permission sets for demo
   */
  private getMockPermissionSets(): PermissionSet[] {
    return [
      {
        id: 'viewer',
        name: 'Viewer',
        description: 'Read-only access to files and folders',
        permissions: [
          {
            id: 'read',
            name: 'Read',
            description: 'View files and folders',
            type: PermissionType.READ,
            scope: PermissionScope.FILE
          },
          {
            id: 'download',
            name: 'Download',
            description: 'Download files',
            type: PermissionType.DOWNLOAD,
            scope: PermissionScope.FILE
          }
        ],
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'editor',
        name: 'Editor',
        description: 'Edit files and folders',
        permissions: [
          {
            id: 'read',
            name: 'Read',
            description: 'View files and folders',
            type: PermissionType.READ,
            scope: PermissionScope.FILE
          },
          {
            id: 'write',
            name: 'Write',
            description: 'Edit files and folders',
            type: PermissionType.WRITE,
            scope: PermissionScope.FILE
          },
          {
            id: 'upload',
            name: 'Upload',
            description: 'Upload new files',
            type: PermissionType.UPLOAD,
            scope: PermissionScope.FOLDER
          },
          {
            id: 'download',
            name: 'Download',
            description: 'Download files',
            type: PermissionType.DOWNLOAD,
            scope: PermissionScope.FILE
          },
          {
            id: 'rename',
            name: 'Rename',
            description: 'Rename files and folders',
            type: PermissionType.RENAME,
            scope: PermissionScope.FILE
          }
        ],
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'admin',
        name: 'Administrator',
        description: 'Full access to files and folders',
        permissions: Object.values(PermissionType).map(type => ({
          id: type,
          name: type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' '),
          description: `${type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')} permission`,
          type: type,
          scope: PermissionScope.FILE
        })),
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
  }
  
  /**
   * Get mock inheritance rules for demo
   */
  getMockInheritanceRules(): InheritanceRule[] {
    return [
      {
        id: 'parent-folder-inherit',
        name: 'Parent Folder Inheritance',
        description: 'Files inherit permissions from their parent folder',
        sourceType: InheritanceSourceType.PARENT_FOLDER,
        targetType: InheritanceTargetType.FILE,
        permissionMapping: [
          {
            sourcePermission: PermissionType.READ,
            targetPermission: PermissionType.READ,
            override: false
          },
          {
            sourcePermission: PermissionType.WRITE,
            targetPermission: PermissionType.WRITE,
            override: false
          }
        ],
        isActive: true,
        priority: 1
      },
      {
        id: 'case-inherit',
        name: 'Case Permissions Inheritance',
        description: 'Folders inherit permissions from their associated case',
        sourceType: InheritanceSourceType.CASE,
        targetType: InheritanceTargetType.FOLDER,
        permissionMapping: [
          {
            sourcePermission: PermissionType.READ,
            targetPermission: PermissionType.READ,
            override: false
          },
          {
            sourcePermission: PermissionType.WRITE,
            targetPermission: PermissionType.WRITE,
            override: false
          }
        ],
        isActive: true,
        priority: 2
      }
    ];
  }
  
  /**
   * Get mock inheritance config for demo
   */
  getMockInheritanceConfig(): PermissionInheritanceConfig {
    return {
      id: 'config-1',
      firmId: '1',
      inheritanceRules: this.getMockInheritanceRules(),
      defaultPermissionSets: {
        folder: this.getMockPermissionSets()[1], // Editor
        file: this.getMockPermissionSets()[0]    // Viewer
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
}