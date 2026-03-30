import { Component } from '@angular/core';

@Component({
  selector: 'app-privacy-policy',
  templateUrl: './privacy-policy.component.html',
  styleUrls: ['./privacy-policy.component.scss']
})
export class PrivacyPolicyComponent {
  lastUpdated = 'March 2026';
  companyName = 'Bostoneo Solutions LLC';
  platformName = 'Legience';
  contactEmail = 'privacy@legience.com';
  contactAddress = 'Boston, Massachusetts';
}
