import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { CtaSectionComponent } from '../../shared/components/cta-section/cta-section.component';
import { FaqAccordionComponent, FaqItem } from '../../shared/components/faq-accordion/faq-accordion.component';
import { ScrollAnimateDirective } from '../../shared/directives/scroll-animate.directive';

interface PricingTier {
  name: string;
  desc: string;
  annualPrice: string;
  monthlyPrice: string;
  period: string;
  annualNote: string;
  monthlyNote: string;
  features: string[];
  cta: 'primary' | 'outline';
  ctaLabel: string;
  featured: boolean;
}

interface FeatureRow {
  feature: string;
  category?: boolean;
  solo: string;
  smallFirm: string;
  enterprise: string;
}

interface IncludedCard {
  icon: string;
  title: string;
  description: string;
}

@Component({
  selector: 'app-pricing-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    CtaSectionComponent,
    FaqAccordionComponent,
    ScrollAnimateDirective
  ],
  templateUrl: './pricing-page.component.html',
  styleUrls: ['./pricing-page.component.scss']
})
export class PricingPageComponent implements OnInit {
  isAnnual = true;

  tiers: PricingTier[] = [
    {
      name: 'Solo Practitioner',
      desc: 'For independent attorneys',
      annualPrice: '$99',
      monthlyPrice: '$119',
      period: '/mo',
      annualNote: 'Billed annually ($1,188/yr)',
      monthlyNote: 'Billed monthly',
      features: [
        '1 attorney user',
        'Unlimited clients & cases',
        'All AI features included',
        'Time tracking & billing',
        'CRM & client intake',
        'E-signatures (BoldSign)',
        '50 GB document storage',
        'Email support'
      ],
      cta: 'outline',
      ctaLabel: 'Start Free Trial',
      featured: false
    },
    {
      name: 'Small Firm',
      desc: 'For growing practices',
      annualPrice: '$199',
      monthlyPrice: '$239',
      period: '/user/mo',
      annualNote: 'Billed annually \u2022 Unlimited staff users',
      monthlyNote: 'Billed monthly \u2022 Unlimited staff users',
      features: [
        '2\u20135 attorney users',
        'Everything in Solo, plus:',
        'Advanced billing & rate multipliers',
        'Team collaboration',
        'Client portal',
        '250 GB document storage',
        'Priority support'
      ],
      cta: 'primary',
      ctaLabel: 'Start Free Trial',
      featured: true
    },
    {
      name: 'Enterprise',
      desc: 'For larger firms',
      annualPrice: 'Custom',
      monthlyPrice: 'Custom',
      period: '',
      annualNote: 'Tailored for your firm\u2019s needs',
      monthlyNote: 'Tailored for your firm\u2019s needs',
      features: [
        'Unlimited users',
        'Everything in Small Firm, plus:',
        'Custom integrations & SSO',
        'Unlimited storage',
        'Dedicated account manager',
        'White-glove onboarding',
        'Custom SLA'
      ],
      cta: 'outline',
      ctaLabel: 'Contact Sales',
      featured: false
    }
  ];

  featureRows: FeatureRow[] = [
    // Core Features
    { feature: 'Core Features', category: true, solo: '', smallFirm: '', enterprise: '' },
    { feature: 'Attorney users', solo: '1', smallFirm: '2\u20135', enterprise: 'Unlimited' },
    { feature: 'Staff users (paralegals, admins)', solo: 'Unlimited', smallFirm: 'Unlimited', enterprise: 'Unlimited' },
    { feature: 'Clients & cases', solo: 'Unlimited', smallFirm: 'Unlimited', enterprise: 'Unlimited' },
    { feature: 'Case management (9 tabs)', solo: '\u2713', smallFirm: '\u2713', enterprise: '\u2713' },
    { feature: 'PI workspace', solo: '\u2713', smallFirm: '\u2713', enterprise: '\u2713' },
    { feature: 'Role-based dashboards', solo: '10 roles', smallFirm: '10 roles', enterprise: '10 roles' },
    { feature: 'Activity feed & audit trail', solo: '\u2713', smallFirm: '\u2713', enterprise: '\u2713' },

    // AI Features
    { feature: 'AI Features', category: true, solo: '', smallFirm: '', enterprise: '' },
    { feature: 'AI legal research (citation-verified)', solo: '\u2713', smallFirm: '\u2713', enterprise: '\u2713' },
    { feature: 'AI document drafting (30+ types)', solo: '\u2713', smallFirm: '\u2713', enterprise: '\u2713' },
    { feature: 'AI demand letters', solo: 'Unlimited', smallFirm: 'Unlimited', enterprise: 'Unlimited' },
    { feature: 'AI damage calculator', solo: '\u2713', smallFirm: '\u2713', enterprise: '\u2713' },
    { feature: 'AI medical record summaries', solo: '\u2713', smallFirm: '\u2713', enterprise: '\u2713' },
    { feature: 'AI contract analysis', solo: '\u2713', smallFirm: '\u2713', enterprise: '\u2713' },

    // Documents
    { feature: 'Documents', category: true, solo: '', smallFirm: '', enterprise: '' },
    { feature: 'Document storage', solo: '50 GB', smallFirm: '250 GB', enterprise: 'Unlimited' },
    { feature: 'Version control & history', solo: '\u2713', smallFirm: '\u2713', enterprise: '\u2713' },
    { feature: 'E-signatures (BoldSign)', solo: '\u2713', smallFirm: '\u2713', enterprise: '\u2713' },
    { feature: 'Sequential multi-party signing', solo: '\u2713', smallFirm: '\u2713', enterprise: '\u2713' },
    { feature: 'Template library', solo: '\u2713', smallFirm: '\u2713', enterprise: '\u2713' },

    // Billing
    { feature: 'Billing', category: true, solo: '', smallFirm: '', enterprise: '' },
    { feature: 'Time tracking & live timer', solo: '\u2713', smallFirm: '\u2713', enterprise: '\u2713' },
    { feature: 'Invoice generation', solo: '\u2713', smallFirm: '\u2713', enterprise: '\u2713' },
    { feature: 'Online payments (Stripe)', solo: '\u2713', smallFirm: '\u2713', enterprise: '\u2713' },
    { feature: 'Advanced billing & rate multipliers', solo: '\u2014', smallFirm: '\u2713', enterprise: '\u2713' },
    { feature: 'Revenue analytics & aging reports', solo: 'Basic', smallFirm: '\u2713', enterprise: '\u2713' },
    { feature: 'Approval workflows', solo: '\u2014', smallFirm: '\u2713', enterprise: '\u2713' },

    // CRM
    { feature: 'CRM & Intake', category: true, solo: '', smallFirm: '', enterprise: '' },
    { feature: 'Lead management & pipeline', solo: '\u2713', smallFirm: '\u2713', enterprise: '\u2713' },
    { feature: 'Custom intake forms', solo: '\u2713', smallFirm: '\u2713', enterprise: '\u2713' },
    { feature: 'Automated conflict checking', solo: '\u2713', smallFirm: '\u2713', enterprise: '\u2713' },
    { feature: 'Lead scoring & source attribution', solo: '\u2713', smallFirm: '\u2713', enterprise: '\u2713' },
    { feature: 'Client portal', solo: '\u2014', smallFirm: '\u2713', enterprise: '\u2713' },
    { feature: 'Team collaboration tools', solo: '\u2014', smallFirm: '\u2713', enterprise: '\u2713' },

    // Security
    { feature: 'Security', category: true, solo: '', smallFirm: '', enterprise: '' },
    { feature: 'AES-256 encryption at rest', solo: '\u2713', smallFirm: '\u2713', enterprise: '\u2713' },
    { feature: 'TLS 1.3 in transit', solo: '\u2713', smallFirm: '\u2713', enterprise: '\u2713' },
    { feature: 'Multi-tenant data isolation', solo: '\u2713', smallFirm: '\u2713', enterprise: '\u2713' },
    { feature: 'Role-based access control', solo: '\u2713', smallFirm: '\u2713', enterprise: '\u2713' },
    { feature: 'SSO / SAML', solo: '\u2014', smallFirm: '\u2014', enterprise: '\u2713' },
    { feature: 'Custom SLA', solo: '\u2014', smallFirm: '\u2014', enterprise: '\u2713' },

    // Support
    { feature: 'Support', category: true, solo: '', smallFirm: '', enterprise: '' },
    { feature: 'Email support', solo: '\u2713', smallFirm: '\u2713', enterprise: '\u2713' },
    { feature: 'Priority support', solo: '\u2014', smallFirm: '\u2713', enterprise: '\u2713' },
    { feature: 'Dedicated account manager', solo: '\u2014', smallFirm: '\u2014', enterprise: '\u2713' },
    { feature: 'White-glove onboarding', solo: '\u2014', smallFirm: '\u2014', enterprise: '\u2713' },
    { feature: 'Phone support', solo: '\u2014', smallFirm: '\u2014', enterprise: '\u2713' }
  ];

  includedCards: IncludedCard[] = [
    { icon: 'ri-robot-2-line', title: 'AI Research & Drafting', description: 'Citation-verified research and 30+ document types, included in every plan.' },
    { icon: 'ri-briefcase-line', title: 'Unlimited Cases', description: 'No per-case fees, no matter how many clients or matters you manage.' },
    { icon: 'ri-quill-pen-line', title: 'E-Signatures', description: 'Built-in BoldSign e-signatures with sequential signing and templates.' },
    { icon: 'ri-shield-check-line', title: 'Data Encryption', description: 'AES-256 at rest, TLS 1.3 in transit, multi-tenant isolation.' },
    { icon: 'ri-refresh-line', title: 'Automatic Updates', description: 'New features and improvements deployed continuously, no action needed.' },
    { icon: 'ri-mail-line', title: 'Email Support', description: 'Responsive email support included with every plan.' },
    { icon: 'ri-time-line', title: '14-Day Trial', description: 'Full access to all features, no credit card required to start.' },
    { icon: 'ri-file-shield-line', title: 'No Long-Term Contract', description: 'Month-to-month available. Cancel anytime, no penalties.' }
  ];

  enterpriseFeatures: string[] = [
    'Unlimited users',
    'Custom integrations',
    'SSO / SAML authentication',
    'Dedicated account manager',
    'White-glove onboarding',
    'Custom SLA',
    'Phone support'
  ];

  faqItems: FaqItem[] = [
    {
      question: 'Is there a free trial?',
      answer: 'Yes! Every plan comes with a 14-day free trial with full access to all features. No credit card is required to start. Just sign up, explore the platform, and decide if Legience is right for your firm.'
    },
    {
      question: 'What happens after the trial?',
      answer: 'At the end of your 14-day trial, you can choose a plan to continue using Legience. If you decide not to subscribe, your data will be safely exported and provided to you. We never hold your data hostage.'
    },
    {
      question: 'Can I change plans later?',
      answer: 'Absolutely. You can upgrade or downgrade your plan at any time. Upgrades take effect immediately, and downgrades take effect at the start of your next billing cycle. No penalties, no hassle.'
    },
    {
      question: 'Are there any hidden fees?',
      answer: 'None. AI features are included in every plan at no extra cost. There are no per-case fees, no per-document fees, and no surprise charges. The price you see is the price you pay.'
    },
    {
      question: 'What payment methods do you accept?',
      answer: 'We accept all major credit cards (Visa, Mastercard, American Express) and ACH bank transfers. Enterprise plans can also be invoiced with net-30 payment terms.'
    },
    {
      question: 'Do you offer discounts for annual billing?',
      answer: 'Yes. Annual billing saves you approximately 17% compared to monthly billing. For example, the Solo plan is $99/month billed annually versus $119/month billed monthly.'
    }
  ];

  constructor(private titleService: Title, private metaService: Meta) {}

  ngOnInit(): void {
    this.titleService.setTitle('Pricing \u2014 Legience');
    this.metaService.updateTag({
      name: 'description',
      content: 'Simple, transparent pricing for Legience. No per-case fees. No AI add-on charges. All features included. Plans starting at $99/month.'
    });
  }

  getPrice(tier: PricingTier): string {
    return this.isAnnual ? tier.annualPrice : tier.monthlyPrice;
  }

  getNote(tier: PricingTier): string {
    return this.isAnnual ? tier.annualNote : tier.monthlyNote;
  }

  getCellClass(value: string): string {
    if (value === '\u2713') return 'cell-check';
    if (value === '\u2014') return 'cell-dash';
    if (value === 'Unlimited') return 'cell-check';
    return 'cell-text';
  }
}
