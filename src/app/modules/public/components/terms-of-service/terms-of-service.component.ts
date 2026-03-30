import { Component } from '@angular/core';

@Component({
  selector: 'app-terms-of-service',
  templateUrl: './terms-of-service.component.html',
  styleUrls: ['./terms-of-service.component.scss']
})
export class TermsOfServiceComponent {
  lastUpdated = 'March 2026';
  companyName = 'Bostoneo Solutions LLC';
  platformName = 'Legience';
  contactEmail = 'legal@legience.com';
  contactAddress = 'Boston, Massachusetts';
  jurisdiction = 'Massachusetts';
  tosVersion = '1.0';
}
