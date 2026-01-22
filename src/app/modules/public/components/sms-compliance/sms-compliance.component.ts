import { Component } from '@angular/core';

@Component({
  selector: 'app-sms-compliance',
  templateUrl: './sms-compliance.component.html',
  styleUrls: ['./sms-compliance.component.scss']
})
export class SmsComplianceComponent {
  firmName = 'Bostoneo Solutions';
  lastUpdated = 'January 2025';

  sampleMessages = [
    {
      type: 'Appointment Reminder',
      message: 'Bostoneo Solutions: Reminder - You have an appointment scheduled for tomorrow at 2:00 PM with your attorney. Reply STOP to opt out. Msg&Data rates may apply.'
    },
    {
      type: 'Document Notification',
      message: 'Bostoneo Solutions: Your document is ready for signature. Please check your email or client portal to review. Reply STOP to opt out. Msg&Data rates may apply.'
    },
    {
      type: 'Case Update',
      message: 'Bostoneo Solutions: Case Update - There has been an update to your case. Log into your client portal for details. Reply STOP to opt out. Msg&Data rates may apply.'
    },
    {
      type: 'Court Date Reminder',
      message: 'Bostoneo Solutions: Reminder - Your court date is scheduled for [DATE] at [TIME]. Contact us with questions. Reply STOP to opt out. Msg&Data rates may apply.'
    }
  ];
}
