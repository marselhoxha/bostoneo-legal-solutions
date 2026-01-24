import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-debug-permissions',
  templateUrl: './debug-permissions.component.html',
  styleUrls: ['./debug-permissions.component.css'],
  standalone: true,
  imports: [CommonModule]
})
export class DebugPermissionsComponent implements OnInit {
  tokenData: any = null;
  authorities: string[] = [];
  permissions: string[] = [];
  roles: string[] = [];
  hasError = false;
  errorMessage = '';

  ngOnInit(): void {
    this.debugToken();
  }

  private debugToken(): void {
    try {
      const token = localStorage.getItem('[KEY] TOKEN');
      if (!token) {
        this.hasError = true;
        this.errorMessage = 'No token found in localStorage';
        return;
      }

      // Decode JWT token
      const parts = token.split('.');
      if (parts.length !== 3) {
        this.hasError = true;
        this.errorMessage = 'Invalid token format';
        return;
      }

      const payload = parts[1];
      const decodedPayload = JSON.parse(atob(payload));
      this.tokenData = decodedPayload;

      // Extract authorities
      if (decodedPayload.authorities) {
        this.authorities = Array.isArray(decodedPayload.authorities) 
          ? decodedPayload.authorities 
          : [decodedPayload.authorities];
      }

      // Extract permissions
      if (decodedPayload.permissions) {
        this.permissions = Array.isArray(decodedPayload.permissions) 
          ? decodedPayload.permissions 
          : [decodedPayload.permissions];
      }

      // Extract roles
      if (decodedPayload.roles) {
        this.roles = Array.isArray(decodedPayload.roles) 
          ? decodedPayload.roles 
          : [decodedPayload.roles];
      }

    } catch (error) {
      this.hasError = true;
      this.errorMessage = 'Error decoding token: ' + error;
      console.error('Token decode error:', error);
    }
  }

  hasBillingEdit(): boolean {
    return this.authorities.includes('BILLING:EDIT') || 
           this.permissions.includes('BILLING:EDIT');
  }

  copyToClipboard(): void {
    const text = JSON.stringify(this.tokenData, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      alert('Copied to clipboard!');
    });
  }
}