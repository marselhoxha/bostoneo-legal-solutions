import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { AppWindowComponent } from '../../shared/components/app-window/app-window.component';
import { CtaSectionComponent } from '../../shared/components/cta-section/cta-section.component';
import { FaqAccordionComponent, FaqItem } from '../../shared/components/faq-accordion/faq-accordion.component';
import { StatsBarComponent, StatItem } from '../../shared/components/stats-bar/stats-bar.component';
import { ScrollAnimateDirective } from '../../shared/directives/scroll-animate.directive';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    AppWindowComponent,
    CtaSectionComponent,
    FaqAccordionComponent,
    StatsBarComponent,
    ScrollAnimateDirective
  ],
  templateUrl: './home-page.component.html',
  styleUrls: ['./home-page.component.scss']
})
export class HomePageComponent implements OnInit {
  heroStats: StatItem[] = [
    { value: '30+', label: 'AI Document Types' },
    { value: '10', label: 'Role Dashboards' },
    { value: 'PI', label: 'Specialized' },
    { value: '0', label: 'Per-Case Fees' }
  ];

  roiStats: StatItem[] = [
    { value: '70%', label: 'Faster Document Drafting', detail: '3-hour documents in under 1 hour' },
    { value: '100+', label: 'Hours/Year Recovered', detail: 'Per attorney, from AI drafting alone' },
    { value: '$30K+', label: 'Additional Revenue/Year', detail: 'Per attorney at $300/hr billing rate' }
  ];

  painPoints = [
    {
      icon: 'ri-money-dollar-circle-line',
      title: 'Clio + Clio Duo AI',
      description: '$159/user/month for case management, then $49/user/month more for an AI add-on that can\'t do legal research, draft demand letters, or analyze contracts.',
      cost: '$208/user/mo'
    },
    {
      icon: 'ri-search-2-line',
      title: 'Westlaw / LexisNexis',
      description: '$200+/month for a search engine behind a paywall. You type a query, get 200 results, and spend hours reading through cases. No AI analysis.',
      cost: '$200+/mo'
    },
    {
      icon: 'ri-file-text-line',
      title: 'EvenUp Demand Letters',
      description: '$300\u2013$800 per demand letter. Upload records, wait days, get a letter you often heavily edit. No case management, no billing.',
      cost: '$300\u2013$800/case'
    },
    {
      icon: 'ri-quill-pen-line',
      title: 'DocuSign',
      description: '$25+/user/month for e-signatures that don\'t connect to your cases. Every agreement requires leaving your case management tool.',
      cost: '$25+/user/mo'
    },
    {
      icon: 'ri-apps-line',
      title: 'The Hidden Cost: Context-Switching',
      description: 'Open Clio, switch to Westlaw, check EvenUp, log into DocuSign, update the spreadsheet. That\'s 5 apps and 20 minutes for a 2-minute task.',
      cost: '$500\u2013$1,200+/mo total'
    }
  ];

  features = [
    {
      badge: 'core', badgeIcon: 'ri-briefcase-line', badgeLabel: 'CORE',
      title: 'Complete Case Management',
      description: 'Every case has 9 dedicated tabs covering the full lifecycle \u2014 from intake to resolution. PI cases automatically get injury fields, accident location, and insurance company.',
      bullets: [
        { bold: '9 tabs per case', text: 'Details, Documents, Research, Notes, Timeline, Tasks, Events, Time Entries, Team' },
        { bold: 'Real-time activity feed', text: 'every action automatically logged' },
        { bold: 'Team assignment', text: 'with workload balancing across attorneys' },
        { bold: 'Priority levels', text: 'Low, Medium, High, Urgent with visual indicators' }
      ],
      image: 'assets/sales/screenshots/case-detail-163-cropped.png',
      imageAlt: 'Case detail showing 9 tabs for complete case lifecycle management',
      imageTitle: 'Case Detail',
      reverse: false
    },
    {
      badge: 'core', badgeIcon: 'ri-time-line', badgeLabel: 'CORE',
      title: 'Time Tracking & Billing',
      description: 'A complete time-to-payment pipeline. Track time with a live timer or manual entries, submit through approval workflows, generate branded invoices, and collect payments online via Stripe.',
      bullets: [
        { bold: 'Live timer', text: 'start/stop from any page, runs in background' },
        { bold: 'Approval workflow', text: 'Draft \u2192 Submitted \u2192 Approved \u2192 Billed \u2192 Invoiced' },
        { bold: 'Revenue analytics', text: 'billing trends, collection rates, aging reports' }
      ],
      image: 'assets/sales/screenshots/time-tracking-cropped.png',
      imageAlt: 'Time tracking dashboard with live timer, revenue tracking, and billing pipeline',
      imageTitle: 'Time Tracking Dashboard',
      reverse: true
    },
    {
      badge: 'core', badgeIcon: 'ri-quill-pen-line', badgeLabel: 'CORE',
      title: 'Documents & E-Signatures',
      description: 'Upload, organize, and version-control all case documents. Built-in e-signatures via BoldSign replace DocuSign \u2014 with sequential signing, custom branding, reusable templates, and embedded signing in the Client Portal.',
      bullets: [
        { bold: 'Version control', text: 'full history with compare and restore' },
        { bold: 'Sequential signing', text: 'multi-party with ordered signing' },
        { bold: 'Template library', text: 'retainer agreements, authorizations, releases' },
        { bold: 'Reminders', text: 'via email, SMS, or WhatsApp' }
      ],
      image: 'assets/sales/screenshots/e-signatures-cropped.png',
      imageAlt: 'Document management with status tracking and organization',
      imageTitle: 'Document Management',
      reverse: false
    },
    {
      badge: 'core', badgeIcon: 'ri-contacts-line', badgeLabel: 'CORE',
      title: 'CRM & Client Intake',
      description: 'Capture leads from first contact through conversion. Customizable intake forms with conditional logic. Automated conflict checking runs against all existing cases, parties, and witnesses.',
      bullets: [
        { bold: 'Lead pipeline', text: 'scoring, source attribution, conversion tracking' },
        { bold: 'Custom intake forms', text: 'PI-specific with conditional fields' },
        { bold: 'Automated conflict checking', text: 'checks against all clients, opposing parties, witnesses' },
        { bold: 'One-click conversion', text: 'lead to client to case in a single workflow' }
      ],
      image: 'assets/sales/screenshots/crm-cropped.png',
      imageAlt: 'CRM dashboard with lead pipeline and conversion tracking',
      imageTitle: 'CRM Dashboard',
      reverse: true
    }
  ];

  comparisonRows = [
    { feature: 'AI Legal Research', legience: '\u2713 Citation-verified', clio: '\u2717', mycase: '\u2717', evenup: '\u2717', pp: '\u2717' },
    { feature: 'AI Document Drafting', legience: '\u2713 30+ types', clio: 'Basic (generic)', mycase: '\u2717', evenup: '\u2717', pp: '\u2717' },
    { feature: 'AI Demand Letters', legience: '\u2713 Unlimited', clio: '\u2717', mycase: '\u2717', evenup: '\u2713 ($300-800/ea)', pp: '\u2717' },
    { feature: 'Case Management', legience: '\u2713 9 tabs', clio: '\u2713', mycase: '\u2713', evenup: '\u2717', pp: '\u2713' },
    { feature: 'Time & Billing', legience: '\u2713 Full pipeline', clio: '\u2713', mycase: '\u2713', evenup: '\u2717', pp: '\u2713' },
    { feature: 'E-Signatures', legience: '\u2713 Built-in', clio: 'Add-on ($)', mycase: '\u2717', evenup: '\u2717', pp: 'Add-on ($)' },
    { feature: 'Client Portal', legience: '\u2713 6 sections', clio: '\u2713', mycase: '\u2713', evenup: '\u2717', pp: '\u2713' },
    { feature: 'PI Workspace', legience: '\u2713 Full suite', clio: '\u2717', mycase: '\u2717', evenup: 'Demand only', pp: '\u2717' },
    { feature: 'Role-Based Dashboards', legience: '\u2713 10 roles', clio: '3 roles', mycase: 'Basic', evenup: '\u2717', pp: 'Basic' },
    { feature: 'CRM & Intake', legience: '\u2713 Lead scoring', clio: '\u2713', mycase: '\u2713', evenup: '\u2717', pp: '\u2713' },
    { feature: 'AI Pricing', legience: 'Included', clio: '+$49/user/mo', mycase: 'N/A', evenup: '$300-800/case', pp: 'N/A' }
  ];

  piCards = [
    {
      icon: 'ri-calculator-line',
      title: 'AI Damage Calculator',
      items: ['8 damage categories (medical, wages, P&S, etc.)', 'AI case strength scoring (1\u201310 scale)', 'Settlement range estimation (Low / Likely / High)']
    },
    {
      icon: 'ri-file-text-line',
      title: 'Unlimited AI Demand Letters',
      items: ['Auto-fill from case data (parties, insurance, damages)', '7 transformation modes for refinement', 'Export as PDF \u2014 no per-case fees']
    },
    {
      icon: 'ri-hospital-line',
      title: 'Medical Records Management',
      items: ['12 provider types, 13 record types', 'AI medical summaries with causation analysis', 'Treatment gap detection & completeness scoring']
    },
    {
      icon: 'ri-scales-3-line',
      title: 'Settlement Tracker',
      items: ['Log demands, offers, counter-offers', 'Visual negotiation gap tracker', 'Chronological timeline with connectors']
    }
  ];

  pricingTiers = [
    {
      name: 'Solo Practitioner',
      desc: 'For independent attorneys',
      price: '$99',
      period: '/mo',
      note: 'Billed annually ($119/mo monthly)',
      features: ['1 attorney user', 'Unlimited clients & cases', 'All AI features included', 'Time tracking & billing', 'CRM & client intake', 'E-signatures', '50 GB document storage'],
      cta: 'outline',
      featured: false
    },
    {
      name: 'Small Firm',
      desc: 'For growing practices',
      price: '$199',
      period: '/user/mo',
      note: 'Billed annually \u2022 Unlimited staff users',
      features: ['2\u20135 attorney users', 'Everything in Solo, plus:', 'Advanced billing & rate multipliers', 'Team collaboration', 'Client portal', '250 GB document storage', 'Priority support'],
      cta: 'primary',
      featured: true
    },
    {
      name: 'Enterprise',
      desc: 'For larger firms',
      price: 'Custom',
      period: '',
      note: 'Tailored for your firm\'s needs',
      features: ['Unlimited users', 'Everything in Small Firm, plus:', 'Custom integrations & SSO', 'Unlimited storage', 'Dedicated account manager', 'White-glove onboarding', 'Custom SLA'],
      cta: 'outline',
      featured: false
    }
  ];

  faqItems: FaqItem[] = [
    {
      question: 'How secure is my client data?',
      answer: 'Legience uses AES-256 encryption at rest and TLS 1.3 in transit. Every firm\'s data is isolated in a multi-tenant architecture with complete database-level separation. We comply with ABA Rule 1.6, Massachusetts 201 CMR 17.00, and maintain comprehensive audit trails. Role-based access control with 10+ roles ensures only authorized users see specific data.'
    },
    {
      question: 'Can I migrate data from my current tools?',
      answer: 'Yes. We handle data migration from Clio, MyCase, PracticePanther, CASEpeer, and other platforms. We can import client information, case data, documents, time entries, invoices, and calendar events. Our team handles the heavy lifting to minimize disruption.'
    },
    {
      question: 'How does the AI compare to Clio Duo or Harvey?',
      answer: 'Clio Duo ($49/user/month add-on) can summarize documents but can\'t do citation-verified legal research or generate practice-area-specific documents. Harvey costs $1,000+/user/month with a 20-seat minimum. Legience delivers advanced AI \u2014 powered by Claude \u2014 at a price solo attorneys and small firms can afford. AI is included in every plan.'
    },
    {
      question: 'What training and support do you provide?',
      answer: 'Every plan includes onboarding with live training sessions. We offer role-specific training for attorneys, paralegals, billing staff, and admins. Solo plans get email support. Small Firm and above get priority email and phone support. Enterprise gets a dedicated account manager. Most firms are up and running within 1-2 weeks.'
    },
    {
      question: 'Is Legience only for Personal Injury firms?',
      answer: 'The PI workspace is our most feature-rich specialization, but Legience\'s core platform \u2014 AI research, document drafting, case management, billing, CRM, and client portal \u2014 works for any practice area. Additional specialized modules are on the roadmap.'
    },
    {
      question: 'Is there a contract or can I cancel anytime?',
      answer: 'Start with a 14-day free trial, no credit card required. Annual plans offer the best pricing, but monthly plans are available with no long-term commitment. We also offer a 30-day money-back guarantee \u2014 full refund, no questions asked.'
    },
    {
      question: 'Can the AI hallucinate or cite fake cases?',
      answer: 'Every case cited by Legience\'s AI is verified against CourtListener\'s database of 50,000+ legal documents. If a citation can\'t be verified, it\'s flagged. Our thorough research mode provides full source tracking. AI is a powerful assistant, not a replacement for attorney judgment \u2014 always review output before submitting to court.'
    }
  ];

  constructor(private titleService: Title, private metaService: Meta) {}

  ngOnInit(): void {
    this.titleService.setTitle('Legience \u2014 Stop Paying for 5 Tools. Start Using One.');
    this.metaService.updateTag({
      name: 'description',
      content: 'Legience replaces Clio, Westlaw, DocuSign, EvenUp, and your spreadsheets with a single AI-native legal practice management platform.'
    });
  }

  getCellClass(value: string): string {
    if (value.startsWith('\u2713')) return 'check';
    if (value === '\u2717') return 'cross';
    if (value === 'Included') return 'check';
    if (value.includes('Add-on') || value.includes('Basic') || value === 'Demand only' || value.includes('roles')) return 'partial';
    return '';
  }
}
