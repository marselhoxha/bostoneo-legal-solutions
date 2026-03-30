import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-success-page',
  templateUrl: './success-page.component.html',
  styleUrls: ['./success-page.component.scss']
})
export class SuccessPageComponent implements OnInit {
  submissionId: string = '';
  message: string = '';
  redirectUrl: string = '';
  
  // Show different content based on the type
  showCustomMessage = false;

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.submissionId = params['submissionId'] || '';
      this.message = params['message'] || '';
      this.redirectUrl = this.sanitizeRedirectUrl(params['redirectUrl'] || '');

      // Show custom message if provided
      this.showCustomMessage = !!this.message;
    });

    // Auto-redirect if URL is provided (after delay)
    if (this.redirectUrl) {
      setTimeout(() => {
        this.navigateToRedirectUrl();
      }, 5000);
    }
  }

  navigateToRedirectUrl(): void {
    if (this.redirectUrl) {
      window.location.href = this.redirectUrl;
    }
  }

  // SECURITY: Only allow relative URLs or same-origin to prevent open redirect attacks
  private sanitizeRedirectUrl(url: string): string {
    if (!url) return '';
    try {
      const parsed = new URL(url, window.location.origin);
      if (parsed.origin === window.location.origin) {
        return parsed.pathname + parsed.search;
      }
      return '';
    } catch {
      // Relative URL — allow if it starts with /
      return url.startsWith('/') ? url : '';
    }
  }
}