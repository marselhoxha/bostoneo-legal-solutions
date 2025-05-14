import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';

@Component({
  selector: 'app-notification-test',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="card" style="margin-top: 120px;">
      <div class="card-header bg-primary text-white">
        <h5 class="card-title mb-0">Firebase Push Notification Test</h5>
      </div>
      <div class="card-body">
        <div class="mb-4">
          <div class="alert alert-info" role="alert">
            <p><i class="fas fa-info-circle me-2"></i> This page helps you test if Firebase push notifications are correctly configured.</p>
            <p class="mb-0">Current status: 
              <span *ngIf="notificationStatus === 'checking'">
                <i class="fas fa-spinner fa-spin"></i> Checking...
              </span>
              <span *ngIf="notificationStatus === 'granted'" class="text-success">
                <i class="fas fa-check-circle"></i> Notifications enabled
              </span>
              <span *ngIf="notificationStatus === 'denied'" class="text-danger">
                <i class="fas fa-times-circle"></i> Notifications blocked
              </span>
              <span *ngIf="notificationStatus === 'default'" class="text-warning">
                <i class="fas fa-exclamation-circle"></i> Permission not requested yet
              </span>
              <span *ngIf="notificationStatus === 'unsupported'" class="text-secondary">
                <i class="fas fa-ban"></i> Not supported in this browser
              </span>
            </p>
          </div>
        </div>

        <div class="row mb-4">
          <div class="col-md-6">
            <div class="card border shadow-sm">
              <div class="card-header bg-light">
                <h6 class="mb-0">Step 1: Configure Firebase</h6>
              </div>
              <div class="card-body">
                <p>Make sure you've configured Firebase in your environment:</p>
                <div class="alert alert-secondary">
                  <pre class="mb-0"><code>{{ getFirebaseConfigSummary() }}</code></pre>
                </div>
                <div *ngIf="configComplete" class="text-success">
                  <i class="fas fa-check-circle"></i> Firebase configuration detected
                </div>
                <div *ngIf="!configComplete" class="text-danger">
                  <i class="fas fa-times-circle"></i> Firebase configuration incomplete
                </div>
              </div>
            </div>
          </div>
          
          <div class="col-md-6">
            <div class="card border shadow-sm">
              <div class="card-header bg-light">
                <h6 class="mb-0">Step 2: Request Permission</h6>
              </div>
              <div class="card-body">
                <p>Click the button below to request notification permission:</p>
                <button class="btn btn-primary" (click)="requestPermission()" [disabled]="notificationStatus === 'granted' || notificationStatus === 'unsupported'">
                  <i class="fas fa-bell me-2"></i> Request Permission
                </button>
                
                <div *ngIf="permissionResult" class="mt-3">
                  <div class="alert" [ngClass]="permissionResult.success ? 'alert-success' : 'alert-danger'">
                    {{ permissionResult.message }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div class="row">
          <div class="col-md-6">
            <div class="card border shadow-sm">
              <div class="card-header bg-light">
                <h6 class="mb-0">Step 3: Send Test Notification</h6>
              </div>
              <div class="card-body">
                <p>Send a test notification to this device:</p>
                <form [formGroup]="notificationForm" (ngSubmit)="sendTestNotification()">
                  <div class="mb-3">
                    <label class="form-label">Title</label>
                    <input type="text" class="form-control" formControlName="title">
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Message</label>
                    <input type="text" class="form-control" formControlName="message">
                  </div>
                  <button type="submit" class="btn btn-success" [disabled]="notificationStatus !== 'granted' || isLoading">
                    <i *ngIf="isLoading" class="fas fa-spinner fa-spin me-2"></i>
                    <i *ngIf="!isLoading" class="fas fa-paper-plane me-2"></i>
                    Send Test Notification
                  </button>
                </form>
                
                <div *ngIf="notificationResult" class="mt-3">
                  <div class="alert" [ngClass]="notificationResult.success ? 'alert-success' : 'alert-danger'">
                    {{ notificationResult.message }}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div class="col-md-6">
            <div class="card border shadow-sm">
              <div class="card-header bg-light">
                <h6 class="mb-0">Debug Information</h6>
              </div>
              <div class="card-body">
                <p><strong>Firebase Token:</strong></p>
                <div class="alert alert-secondary text-break">
                  <small>{{ firebaseToken || 'No token available' }}</small>
                </div>
                <p><strong>Browser:</strong> {{ getBrowserInfo() }}</p>
                <p><strong>Service Worker Support:</strong> {{ isServiceWorkerSupported() ? 'Yes' : 'No' }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .badge-dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    pre {
      white-space: pre-wrap;
      word-break: break-all;
    }
    .text-break {
      word-break: break-all;
    }
  `]
})
export class NotificationTestComponent implements OnInit {
  notificationStatus: 'checking' | 'granted' | 'denied' | 'default' | 'unsupported' = 'checking';
  firebaseToken: string | null = null;
  
  permissionResult: { success: boolean; message: string } | null = null;
  notificationResult: { success: boolean; message: string } | null = null;
  
  isLoading = false;
  configComplete = false;
  
  notificationForm: FormGroup;
  
  constructor(
    private http: HttpClient,
    private fb: FormBuilder
  ) {
    this.notificationForm = this.fb.group({
      title: ['BostonEO Test Notification'],
      message: ['This is a test push notification from BostonEO Solutions']
    });
  }
  
  ngOnInit(): void {
    this.checkNotificationSupport();
    this.checkFirebaseConfig();
  }
  
  checkNotificationSupport(): void {
    if (!('Notification' in window)) {
      this.notificationStatus = 'unsupported';
      return;
    }
    
    this.notificationStatus = Notification.permission as 'granted' | 'denied' | 'default';
  }
  
  checkFirebaseConfig(): void {
    const config = environment.firebase;
    
    // Check if all required Firebase fields are filled with real values
    this.configComplete = !!(
      config &&
      config.apiKey && 
      config.apiKey !== 'YOUR_API_KEY' &&
      config.projectId && 
      config.messagingSenderId && 
      config.messagingSenderId !== 'YOUR_SENDER_ID' &&
      config.appId && 
      config.appId !== 'YOUR_APP_ID' &&
      config.vapidKey && 
      config.vapidKey !== 'YOUR_VAPID_KEY'
    );
  }
  
  getFirebaseConfigSummary(): string {
    const config = environment.firebase;
    if (!config) {
      return 'Firebase configuration not found!';
    }
    
    return JSON.stringify({
      apiKey: config.apiKey ? (config.apiKey === 'YOUR_API_KEY' ? '⚠️ Not configured' : '✓ Configured') : '❌ Missing',
      projectId: config.projectId ? '✓ Configured' : '❌ Missing',
      messagingSenderId: config.messagingSenderId ? (config.messagingSenderId === 'YOUR_SENDER_ID' ? '⚠️ Not configured' : '✓ Configured') : '❌ Missing',
      appId: config.appId ? (config.appId === 'YOUR_APP_ID' ? '⚠️ Not configured' : '✓ Configured') : '❌ Missing',
      vapidKey: config.vapidKey ? (config.vapidKey === 'YOUR_VAPID_KEY' ? '⚠️ Not configured' : '✓ Configured') : '❌ Missing'
    }, null, 2);
  }
  
  requestPermission(): void {
    if (!('Notification' in window)) {
      this.permissionResult = {
        success: false,
        message: 'Notifications are not supported in this browser.'
      };
      return;
    }
    
    Notification.requestPermission().then((permission) => {
      this.notificationStatus = permission as 'granted' | 'denied' | 'default';
      
      if (permission === 'granted') {
        this.permissionResult = {
          success: true,
          message: 'Permission granted! You can now receive notifications.'
        };
        
        // In a real application, this would register the device token with Firebase
        // and then send it to your backend
        this.firebaseToken = 'Firebase token would be generated here';
      } else if (permission === 'denied') {
        this.permissionResult = {
          success: false,
          message: 'Permission denied. Please enable notifications in your browser settings.'
        };
      } else {
        this.permissionResult = {
          success: false,
          message: 'Permission request was dismissed.'
        };
      }
    });
  }
  
  sendTestNotification(): void {
    if (this.notificationStatus !== 'granted') {
      this.notificationResult = {
        success: false,
        message: 'You need to grant notification permission first.'
      };
      return;
    }
    
    this.isLoading = true;
    
    const formValue = this.notificationForm.value;
    
    // In a real app, we would call our backend endpoint here
    this.http.post(`${environment.apiUrl}/api/v1/notifications/test/1`, {
      title: formValue.title,
      message: formValue.message
    }).subscribe({
      next: (response: any) => {
        this.isLoading = false;
        this.notificationResult = {
          success: true,
          message: 'Test notification sent! You should receive it shortly.'
        };
      },
      error: (error) => {
        this.isLoading = false;
        this.notificationResult = {
          success: false,
          message: `Error sending notification: ${error.message || 'Unknown error'}`
        };
      }
    });
  }
  
  getBrowserInfo(): string {
    const userAgent = navigator.userAgent;
    let browserName = 'Unknown';
    
    if (userAgent.match(/chrome|chromium|crios/i)) {
      browserName = 'Chrome';
    } else if (userAgent.match(/firefox|fxios/i)) {
      browserName = 'Firefox';
    } else if (userAgent.match(/safari/i)) {
      browserName = 'Safari';
    } else if (userAgent.match(/opr\//i)) {
      browserName = 'Opera';
    } else if (userAgent.match(/edg/i)) {
      browserName = 'Edge';
    }
    
    return `${browserName} on ${navigator.platform}`;
  }
  
  isServiceWorkerSupported(): boolean {
    return 'serviceWorker' in navigator;
  }
} 
 