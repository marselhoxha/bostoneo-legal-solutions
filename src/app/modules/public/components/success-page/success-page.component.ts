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
      this.redirectUrl = params['redirectUrl'] || '';
      
      // Show custom message if provided
      this.showCustomMessage = !!this.message;
    });

    // Auto-redirect if URL is provided (after delay)
    if (this.redirectUrl) {
      setTimeout(() => {
        window.location.href = this.redirectUrl;
      }, 5000);
    }
  }

  navigateToRedirectUrl(): void {
    if (this.redirectUrl) {
      window.location.href = this.redirectUrl;
    }
  }
}