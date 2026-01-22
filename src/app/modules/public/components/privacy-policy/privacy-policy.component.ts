import { Component } from '@angular/core';

@Component({
  selector: 'app-privacy-policy',
  templateUrl: './privacy-policy.component.html',
  styleUrls: ['./privacy-policy.component.scss']
})
export class PrivacyPolicyComponent {
  lastUpdated = 'January 2025';
  firmName = 'Bostoneo Solutions';
  contactEmail = 'privacy@bostoneosolutions.com';
  contactPhone = '(555) 123-4567';
  contactAddress = 'Boston, MA';
}
