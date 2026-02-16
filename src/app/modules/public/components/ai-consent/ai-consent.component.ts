import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';

@Component({
  selector: 'app-ai-consent',
  templateUrl: './ai-consent.component.html',
  styleUrls: ['./ai-consent.component.scss']
})
export class AiConsentComponent implements OnInit {
  token: string = '';
  clientName: string = '';
  organizationName: string = '';

  isLoading = true;
  isSubmitting = false;
  isValid = false;
  isAcknowledged = false;
  error: string = '';

  private readonly apiUrl = environment.apiUrl;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.token = params['token'];
      this.validateToken();
    });
  }

  validateToken(): void {
    this.isLoading = true;
    this.http.get<any>(`${this.apiUrl}/api/public/ai-consent/${this.token}`).subscribe({
      next: (response) => {
        if (response.valid) {
          this.isValid = true;
          this.clientName = response.clientName;
          this.organizationName = response.organizationName;
        } else {
          this.error = response.message || 'This link is invalid or has already been used.';
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'This link is invalid or has already been used.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  acknowledge(): void {
    this.isSubmitting = true;
    this.cdr.detectChanges();

    this.http.post<any>(`${this.apiUrl}/api/public/ai-consent/${this.token}/acknowledge`, {}).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        if (response.success) {
          this.isAcknowledged = true;
        } else {
          this.error = response.message || 'There was an error processing your acknowledgment.';
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.isSubmitting = false;
        this.error = 'There was an error processing your acknowledgment. Please try again.';
        this.cdr.detectChanges();
      }
    });
  }
}
