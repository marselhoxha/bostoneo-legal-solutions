import { Component, OnInit } from '@angular/core';
import { RbacService, Permission, Role, CaseRole } from '../../../core/services/rbac.service';
import { JwtHelperService } from '@auth0/angular-jwt';
import { Key } from '../../../enum/key.enum';
import { CommonModule } from '@angular/common';

/**
 * Debug component that shows current user permissions and JWT claims
 * Include this in protected routes while debugging permission issues
 * 
 * Usage:
 * <app-permission-debugger></app-permission-debugger>
 */
@Component({
  selector: 'app-permission-debugger',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="permission-debug bg-light p-3 mb-3 border rounded">
      <h5>Permission Debugger</h5>
      <div class="row">
        <div class="col-md-4">
          <h6>Roles:</h6>
          <ul class="list-group">
            <li *ngFor="let role of roles" class="list-group-item">{{ role }}</li>
            <li *ngIf="roles.length === 0" class="list-group-item text-danger">No roles found</li>
          </ul>
        </div>
        <div class="col-md-4">
          <h6>Permissions:</h6>
          <ul class="list-group">
            <li *ngFor="let perm of permissions" class="list-group-item">{{ perm }}</li>
            <li *ngIf="permissions.length === 0" class="list-group-item text-danger">No permissions found</li>
          </ul>
        </div>
        <div class="col-md-4">
          <h6>JWT Details:</h6>
          <ul class="list-group">
            <li class="list-group-item">
              <strong>Subject:</strong> {{ tokenDetails.sub || 'Not found' }}
            </li>
            <li class="list-group-item">
              <strong>Expiry:</strong> {{ tokenDetails.exp ? formatDate(tokenDetails.exp * 1000) : 'Not found' }}
            </li>
            <li class="list-group-item">
              <strong>Issued at:</strong> {{ tokenDetails.iat ? formatDate(tokenDetails.iat * 1000) : 'Not found' }}
            </li>
          </ul>
        </div>
      </div>

      <div class="mt-3">
        <h6>Case Roles:</h6>
        <div *ngIf="objectKeys(caseRoles).length === 0" class="alert alert-info">No case roles found</div>
        <div *ngFor="let caseId of objectKeys(caseRoles)" class="mb-2">
          <strong>Case {{ caseId }}:</strong> {{ caseRoles[caseId].join(', ') }}
        </div>
      </div>
      
      <div class="mt-3">
        <button class="btn btn-sm btn-primary mr-2" (click)="refreshPermissions()">Refresh</button>
        <button class="btn btn-sm btn-info" (click)="showRawToken()">Show Raw Token</button>
      </div>

      <div *ngIf="showToken" class="mt-3">
        <h6>Raw Token:</h6>
        <div class="form-group">
          <textarea class="form-control" rows="5" readonly>{{ rawToken }}</textarea>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .permission-debug {
      font-size: 12px;
    }
    .list-group-item {
      padding: 0.5rem 1rem;
    }
  `]
})
export class PermissionDebuggerComponent implements OnInit {
  permissions: string[] = [];
  roles: string[] = [];
  caseRoles: {[caseId: string]: string[]} = {};
  tokenDetails: any = {};
  rawToken: string = '';
  showToken: boolean = false;
  
  // Helper for template
  objectKeys = Object.keys;
  
  private jwtHelper = new JwtHelperService();

  constructor(private rbacService: RbacService) {}

  ngOnInit(): void {
    this.loadTokenData();
    
    // Subscribe to permission changes
    this.rbacService.permissions$.subscribe((perms: Permission[]) => {
      this.permissions = perms.map(p => p.name || p.resourceType + ':' + p.actionType);
    });
    
    this.rbacService.roles$.subscribe((roles: Role[]) => {
      this.roles = roles.map(r => r.name || r.displayName);
    });
    
    this.rbacService.caseRoles$.subscribe((caseRoles: CaseRole[]) => {
      // Convert CaseRole[] to the expected format
      const grouped: {[caseId: string]: string[]} = {};
      caseRoles.forEach(cr => {
        const caseId = cr.caseId.toString();
        if (!grouped[caseId]) {
          grouped[caseId] = [];
        }
        grouped[caseId].push(cr.role.name);
      });
      this.caseRoles = grouped;
    });
  }
  
  loadTokenData(): void {
    const token = localStorage.getItem(Key.TOKEN);
    if (token) {
      try {
        this.rawToken = token;
        this.tokenDetails = this.jwtHelper.decodeToken(token);
      } catch (e) {
        console.error('Error decoding token', e);
      }
    }
  }
  
  refreshPermissions(): void {
    this.loadTokenData();
  }
  
  showRawToken(): void {
    this.showToken = !this.showToken;
  }
  
  formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
  }
} 