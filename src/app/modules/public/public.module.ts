import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

// Components
import { IntakeFormComponent } from './components/intake-form/intake-form.component';
import { SuccessPageComponent } from './components/success-page/success-page.component';
import { PrivacyPolicyComponent } from './components/privacy-policy/privacy-policy.component';
import { TermsOfServiceComponent } from './components/terms-of-service/terms-of-service.component';
import { SmsComplianceComponent } from './components/sms-compliance/sms-compliance.component';
import { AiConsentComponent } from './components/ai-consent/ai-consent.component';

// Services
import { IntakeFormService } from './services/intake-form.service';

// Routes
import { PublicRoutingModule } from './public-routing.module';

@NgModule({
  declarations: [
    IntakeFormComponent,
    SuccessPageComponent,
    PrivacyPolicyComponent,
    TermsOfServiceComponent,
    SmsComplianceComponent,
    AiConsentComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    PublicRoutingModule
  ],
  providers: [
    IntakeFormService
  ]
})
export class PublicModule { }