import { Component } from '@angular/core';

@Component({
  selector: 'app-terms-of-service',
  templateUrl: './terms-of-service.component.html',
  styleUrls: ['./terms-of-service.component.scss']
})
export class TermsOfServiceComponent {
  lastUpdated = 'January 2025';
  firmName = 'Bostoneo Solutions';
  contactEmail = 'contact@bostoneosolutions.com';
  contactPhone = '(555) 123-4567';
  contactAddress = 'Boston, MA';
  jurisdiction = 'Massachusetts';
}
