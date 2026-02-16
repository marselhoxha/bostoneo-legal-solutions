import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { IntakeFormComponent } from './components/intake-form/intake-form.component';
import { SuccessPageComponent } from './components/success-page/success-page.component';
import { PrivacyPolicyComponent } from './components/privacy-policy/privacy-policy.component';
import { TermsOfServiceComponent } from './components/terms-of-service/terms-of-service.component';
import { SmsComplianceComponent } from './components/sms-compliance/sms-compliance.component';
import { AiConsentComponent } from './components/ai-consent/ai-consent.component';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'intake-forms',
    pathMatch: 'full'
  },
  {
    path: 'intake-forms',
    component: IntakeFormComponent,
    data: { title: 'Legal Intake Forms' }
  },
  {
    path: 'intake-forms/:formUrl',
    component: IntakeFormComponent,
    data: { title: 'Legal Intake Form' }
  },
  {
    path: 'success',
    component: SuccessPageComponent,
    data: { title: 'Form Submitted Successfully' }
  },
  {
    path: 'privacy-policy',
    component: PrivacyPolicyComponent,
    data: { title: 'Privacy Policy' }
  },
  {
    path: 'terms-of-service',
    component: TermsOfServiceComponent,
    data: { title: 'Terms of Service' }
  },
  {
    path: 'sms-compliance',
    component: SmsComplianceComponent,
    data: { title: 'SMS Compliance Documentation' }
  },
  {
    path: 'ai-consent/:token',
    component: AiConsentComponent,
    data: { title: 'AI Technology Disclosure' }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PublicRoutingModule { }
