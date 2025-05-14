import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ReactiveFormsModule } from '@angular/forms';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-reminder-test',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="card" style="margin-top: 120px;">
      <div class="card-header bg-soft-primary">
        <h5 class="card-title mb-0">Reminder Email Test Tool</h5>
      </div>
      <div class="card-body">
        <div class="alert alert-info" role="alert">
          <i class="ri-information-line align-middle me-2"></i>
          This tool allows you to test reminder emails. Click "Send Test Email" to receive a reminder email for the most recent deadline event.
        </div>
        
        <div class="mb-3">
          <label class="form-label">Email Address</label>
          <input type="email" class="form-control" [value]="emailAddress" (input)="emailAddress = $event.target.value" placeholder="Enter email address">
          <div class="form-text text-muted">
            The test reminder will be sent to this email address.
          </div>
        </div>
        
        <div class="d-grid gap-2">
          <button class="btn btn-primary" [disabled]="!emailAddress || isLoading" (click)="sendTestEmail()">
            <span *ngIf="isLoading" class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
            <i *ngIf="!isLoading" class="ri-mail-send-line me-2"></i> 
            Send Test Email
          </button>
        </div>
        
        <div *ngIf="result" class="mt-4">
          <div class="card border" [ngClass]="result.success ? 'border-success' : 'border-danger'">
            <div class="card-header bg-light">
              <h6 class="card-title mb-0">
                {{ result.success ? 'Email Sent Successfully' : 'Error Sending Email' }}
              </h6>
            </div>
            <div class="card-body">
              <p *ngIf="result.success" class="mb-0">
                <strong>Event:</strong> {{ result.eventDetails?.title }}<br>
                <strong>Type:</strong> {{ result.eventDetails?.eventType }}<br>
                <strong>Due:</strong> {{ result.eventDetails?.dueTime | date:'medium' }}<br>
                <strong>Reminder Minutes:</strong> {{ result.eventDetails?.reminderMinutes }} minutes before<br>
                <strong>High Priority:</strong> {{ result.eventDetails?.highPriority ? 'Yes' : 'No' }}<br>
              </p>
              <p *ngIf="!result.success" class="text-danger mb-0">
                {{ result.error }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .card {
      margin-bottom: 1.5rem;
    }
  `]
})
export class ReminderTestComponent implements OnInit {
  emailAddress = 'marsel.hox@gmail.com';
  isLoading = false;
  result: any = null;
  
  constructor(private http: HttpClient) {}
  
  ngOnInit(): void {
    // First check if the test controller is accessible
    this.http.get<any>(`${environment.apiUrl}/api/v1/test/ping`)
      .subscribe({
        next: (response) => {
          console.log('Test controller is accessible:', response);
        },
        error: (err) => {
          console.error('Error accessing test controller:', err);
          // Show error message
          this.result = {
            success: false,
            error: 'Cannot access test endpoints. Check server configuration or security settings.'
          };
        }
      });
  }
  
  sendTestEmail(): void {
    if (!this.emailAddress) return;
    
    this.isLoading = true;
    this.result = null;
    
    // Use the simpler direct test email endpoint
    this.http.get<any>(`${environment.apiUrl}/api/v1/test/send-test-email`)
      .subscribe({
        next: (response: any) => {
          this.result = response;
          this.isLoading = false;
          
          // Show success message if no error
          if (this.result.success) {
            console.log('Test reminder sent successfully');
          }
        },
        error: (err) => {
          console.error('Error sending test email:', err);
          this.result = {
            success: false,
            error: err.message || 'Failed to send test email. Check server logs for details.'
          };
          this.isLoading = false;
        }
      });
  }
} 
 