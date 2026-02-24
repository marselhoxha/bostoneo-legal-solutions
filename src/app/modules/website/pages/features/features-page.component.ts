import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { AppWindowComponent } from '../../shared/components/app-window/app-window.component';
import { CtaSectionComponent } from '../../shared/components/cta-section/cta-section.component';
import { ScrollAnimateDirective } from '../../shared/directives/scroll-animate.directive';

export interface FeatureItem {
  icon: string;
  title: string;
  description: string;
  bullets: string[];
  colorClass: string;
}

export interface FeatureCategory {
  id: string;
  label: string;
  icon: string;
  colorClass: string;
  headline: string;
  description: string;
  screenshot?: string;
  screenshotAlt?: string;
  screenshotTitle?: string;
  items: FeatureItem[];
}

export interface FilterPill {
  id: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-features-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    AppWindowComponent,
    CtaSectionComponent,
    ScrollAnimateDirective
  ],
  templateUrl: './features-page.component.html',
  styleUrls: ['./features-page.component.scss']
})
export class FeaturesPageComponent implements OnInit {

  activeFilter = 'all';

  filterPills: FilterPill[] = [
    { id: 'all', label: 'All', icon: 'ri-layout-grid-line' },
    { id: 'ai', label: 'AI Intelligence', icon: 'ri-robot-2-line' },
    { id: 'cases', label: 'Case Management', icon: 'ri-briefcase-line' },
    { id: 'billing', label: 'Time & Billing', icon: 'ri-time-line' },
    { id: 'documents', label: 'Documents', icon: 'ri-file-text-line' },
    { id: 'crm', label: 'CRM & Intake', icon: 'ri-contacts-line' },
    { id: 'portal', label: 'Client Portal', icon: 'ri-user-shared-line' },
    { id: 'calendar', label: 'Calendar & Tasks', icon: 'ri-calendar-check-line' },
    { id: 'security', label: 'Security', icon: 'ri-shield-check-line' }
  ];

  categories: FeatureCategory[] = [
    {
      id: 'ai',
      label: 'AI Intelligence',
      icon: 'ri-robot-2-line',
      colorClass: 'indigo',
      headline: 'AI Intelligence',
      description: 'Claude-powered AI that does real legal work — research with verified citations, document drafting across 6 practice areas, and an interactive workspace for complex analysis.',
      screenshot: 'assets/sales/screenshots/ai-workspace-cropped.png',
      screenshotAlt: 'Legience AI Workspace with research and drafting tools',
      screenshotTitle: 'AI Workspace',
      items: [
        {
          icon: 'ri-search-eye-line',
          title: 'AI Legal Research',
          description: 'Ask legal questions in plain English. Get structured analysis with verified case citations from CourtListener.',
          bullets: [
            'Citation-verified against 50,000+ court opinions',
            'Multi-jurisdiction support (federal & state)',
            'Thorough mode for deep-dive analysis',
            'Source links to full case text'
          ],
          colorClass: 'indigo'
        },
        {
          icon: 'ri-draft-line',
          title: 'AI Document Drafting',
          description: '30+ document types across 6 practice areas. Auto-fills from case data — parties, dates, claims, and damages.',
          bullets: [
            '30+ types: motions, complaints, demand letters, contracts',
            '6 practice areas: PI, family, criminal, corporate, employment, real estate',
            '7 transformation modes for refinement',
            'Export as PDF or Word'
          ],
          colorClass: 'indigo'
        },
        {
          icon: 'ri-apps-2-line',
          title: 'AI Workspace',
          description: 'An interactive environment for complex legal work. Run research, draft documents, and analyze case strategy — all in one place.',
          bullets: [
            'Conversational interface with context memory',
            'Side-by-side research and drafting',
            'Case data auto-injection',
            'Session history and bookmarking'
          ],
          colorClass: 'indigo'
        }
      ]
    },
    {
      id: 'cases',
      label: 'Case Management',
      icon: 'ri-briefcase-line',
      colorClass: 'green',
      headline: 'Case Management',
      description: 'Every case has 9 dedicated tabs covering the full lifecycle — from intake through resolution. Built for how attorneys actually work.',
      screenshot: 'assets/sales/screenshots/case-detail-163-cropped.png',
      screenshotAlt: 'Case detail view with 9 tabs for full lifecycle management',
      screenshotTitle: 'Case Detail',
      items: [
        {
          icon: 'ri-folder-open-line',
          title: 'Case Lifecycle',
          description: '9 tabs per case covering every aspect of matter management, from documents to timeline to team assignments.',
          bullets: [
            '9 tabs: Details, Documents, Research, Notes, Timeline, Tasks, Events, Time, Team',
            'PI cases auto-populate injury and accident fields',
            'Priority levels with visual indicators',
            'Customizable case types and statuses'
          ],
          colorClass: 'green'
        },
        {
          icon: 'ri-history-line',
          title: 'Activity Feed & Timeline',
          description: 'Every action on a case is automatically logged. See who did what and when — no manual note-taking required.',
          bullets: [
            'Auto-logged events for all case activity',
            'Chronological timeline with filtering',
            'Team member attribution on every entry',
            'Comments and notes inline'
          ],
          colorClass: 'green'
        },
        {
          icon: 'ri-team-line',
          title: 'Team Assignment & Workload',
          description: 'Assign attorneys, paralegals, and staff to cases. Monitor workload distribution across the firm.',
          bullets: [
            'Role-based assignment (lead attorney, paralegal, etc.)',
            'Workload balancing across team members',
            'Automatic notifications on assignment changes',
            'Capacity planning for new case intake'
          ],
          colorClass: 'green'
        }
      ]
    },
    {
      id: 'billing',
      label: 'Time & Billing',
      icon: 'ri-time-line',
      colorClass: 'blue',
      headline: 'Time & Billing',
      description: 'A complete time-to-payment pipeline. Track time, submit through approval workflows, generate invoices, and collect payments via Stripe.',
      screenshot: 'assets/sales/screenshots/time-tracking-cropped.png',
      screenshotAlt: 'Time tracking dashboard with live timer and revenue analytics',
      screenshotTitle: 'Time Tracking',
      items: [
        {
          icon: 'ri-timer-line',
          title: 'Live Timer & Time Tracking',
          description: 'Start a timer from any page. It runs in the background while you work. Manual entry for after-the-fact logging.',
          bullets: [
            'Persistent timer runs across page navigation',
            'Manual and bulk time entry',
            'Billable vs. non-billable categorization',
            'Rate multipliers and custom billing rates'
          ],
          colorClass: 'blue'
        },
        {
          icon: 'ri-money-dollar-circle-line',
          title: 'Invoicing & Payments',
          description: 'Generate branded invoices from approved time entries. Clients pay online via Stripe — funds land in your account.',
          bullets: [
            'Approval workflow: Draft > Submitted > Approved > Billed',
            'Branded PDF invoices with firm logo',
            'Stripe integration for online payments',
            'Payment status tracking and reminders'
          ],
          colorClass: 'blue'
        },
        {
          icon: 'ri-line-chart-line',
          title: 'Revenue Analytics',
          description: 'Track billing trends, collection rates, and aging reports. Know where your revenue stands at a glance.',
          bullets: [
            'Monthly and quarterly billing trends',
            'Collection rate tracking by attorney',
            'Aging reports for outstanding invoices',
            'Revenue forecasting from open matters'
          ],
          colorClass: 'blue'
        }
      ]
    },
    {
      id: 'documents',
      label: 'Documents & E-Signatures',
      icon: 'ri-file-text-line',
      colorClass: 'cyan',
      headline: 'Documents & E-Signatures',
      description: 'Upload, organize, and version-control all case documents. Built-in e-signatures via BoldSign replace DocuSign.',
      screenshot: 'assets/sales/screenshots/e-signatures-cropped.png',
      screenshotAlt: 'Document management with e-signature status tracking',
      screenshotTitle: 'E-Signatures',
      items: [
        {
          icon: 'ri-folder-2-line',
          title: 'Document Management',
          description: 'Every document tied to its case. Upload, organize by type, and maintain version history with compare and restore.',
          bullets: [
            'Drag-and-drop upload with auto-categorization',
            'Version control with full history',
            'Document type tagging and search',
            'Bulk operations (download, move, archive)'
          ],
          colorClass: 'cyan'
        },
        {
          icon: 'ri-quill-pen-line',
          title: 'E-Signatures (BoldSign)',
          description: 'Send documents for signature without leaving Legience. Sequential signing, custom branding, and reminders built in.',
          bullets: [
            'Sequential and parallel signing workflows',
            'Custom branding with firm logo and colors',
            'Reminders via email, SMS, or WhatsApp',
            'Embedded signing in Client Portal'
          ],
          colorClass: 'cyan'
        },
        {
          icon: 'ri-file-copy-2-line',
          title: 'Template Library',
          description: 'Pre-built templates for retainer agreements, authorizations, medical releases, and more. Customize and reuse.',
          bullets: [
            'Pre-built templates for common legal documents',
            'Variable placeholders with auto-fill from case data',
            'Firm-specific template management',
            'Clone and customize for new matters'
          ],
          colorClass: 'cyan'
        }
      ]
    },
    {
      id: 'crm',
      label: 'CRM & Client Intake',
      icon: 'ri-contacts-line',
      colorClass: 'orange',
      headline: 'CRM & Client Intake',
      description: 'Capture leads from first contact through conversion. Customizable intake forms with conditional logic and automated conflict checking.',
      screenshot: 'assets/sales/screenshots/crm-cropped.png',
      screenshotAlt: 'CRM dashboard with lead pipeline and conversion tracking',
      screenshotTitle: 'CRM Dashboard',
      items: [
        {
          icon: 'ri-funnel-line',
          title: 'Lead Pipeline',
          description: 'Track every lead from inquiry to signed retainer. Scoring, source attribution, and conversion analytics.',
          bullets: [
            'Visual pipeline with drag-and-drop stages',
            'Lead scoring based on case type and value',
            'Source attribution (web, referral, ad, etc.)',
            'One-click conversion: lead to client to case'
          ],
          colorClass: 'orange'
        },
        {
          icon: 'ri-survey-line',
          title: 'Custom Intake Forms',
          description: 'Build intake forms with conditional logic. PI-specific fields auto-populate injury, accident, and insurance data.',
          bullets: [
            'Drag-and-drop form builder',
            'Conditional logic for practice-area-specific fields',
            'PI auto-fields: injury type, accident location, insurance',
            'Embeddable on firm website'
          ],
          colorClass: 'orange'
        },
        {
          icon: 'ri-error-warning-line',
          title: 'Conflict Checking',
          description: 'Automated conflict checks run against all existing clients, opposing parties, witnesses, and related entities.',
          bullets: [
            'Checks against all clients, parties, and witnesses',
            'Fuzzy matching for name variations',
            'Conflict report with match details',
            'Clearance documentation for file'
          ],
          colorClass: 'orange'
        }
      ]
    },
    {
      id: 'portal',
      label: 'Client Portal',
      icon: 'ri-user-shared-line',
      colorClass: 'indigo',
      headline: 'Client Portal',
      description: 'Give clients a branded dashboard to check case status, sign documents, make payments, and message your team — 24/7.',
      screenshot: 'assets/sales/screenshots/pi-dashboard-cropped.png',
      screenshotAlt: 'Client portal dashboard with case status and actions',
      screenshotTitle: 'Client Portal',
      items: [
        {
          icon: 'ri-dashboard-line',
          title: 'Client Dashboard',
          description: 'Clients see their case status, upcoming events, and pending tasks at a glance. Reduces "what\'s the update?" calls.',
          bullets: [
            'Real-time case status and progress',
            'Upcoming deadlines and events',
            'Pending items requiring client action',
            'Branded with your firm\'s logo and colors'
          ],
          colorClass: 'indigo'
        },
        {
          icon: 'ri-message-2-line',
          title: 'Secure Messaging',
          description: 'Encrypted messaging between clients and your team. Thread-based conversations tied to specific cases.',
          bullets: [
            'End-to-end encrypted conversations',
            'Case-linked message threads',
            'File attachments and document sharing',
            'Read receipts and notification preferences'
          ],
          colorClass: 'indigo'
        },
        {
          icon: 'ri-edit-2-line',
          title: 'Embedded E-Signing & Payments',
          description: 'Clients sign retainers and pay invoices without leaving the portal. No separate DocuSign or payment links needed.',
          bullets: [
            'Sign documents directly in the portal',
            'Pay invoices with credit card or ACH',
            'Automatic status updates on completion',
            'Confirmation emails and receipts'
          ],
          colorClass: 'indigo'
        }
      ]
    },
    {
      id: 'calendar',
      label: 'Calendar & Tasks',
      icon: 'ri-calendar-check-line',
      colorClass: 'green',
      headline: 'Calendar & Tasks',
      description: 'Manage court dates, deadlines, and to-dos in one place. Linked to cases so nothing falls through the cracks.',
      items: [
        {
          icon: 'ri-calendar-event-line',
          title: 'Event Management',
          description: 'Schedule court dates, depositions, meetings, and more. Color-coded by type with case linking.',
          bullets: [
            'Court dates, depositions, client meetings, deadlines',
            'Color-coded event types for quick scanning',
            'Case-linked events with participant tracking',
            'Calendar sync with Google and Outlook'
          ],
          colorClass: 'green'
        },
        {
          icon: 'ri-checkbox-circle-line',
          title: 'Task Management',
          description: 'Create, assign, and track tasks across cases. Priority levels and due dates keep your team on schedule.',
          bullets: [
            'Task assignment with role-based defaults',
            'Priority levels: Low, Medium, High, Urgent',
            'Due date tracking with overdue alerts',
            'Task templates for recurring workflows'
          ],
          colorClass: 'green'
        },
        {
          icon: 'ri-alarm-warning-line',
          title: 'Deadline Tracking',
          description: 'Never miss a statute of limitations or filing deadline. Automated reminders escalate as dates approach.',
          bullets: [
            'Statute of limitations tracking per case',
            'Multi-level reminders (30, 14, 7, 1 day)',
            'Escalation to supervising attorney on missed items',
            'Dashboard widget for firm-wide deadline view'
          ],
          colorClass: 'green'
        }
      ]
    },
    {
      id: 'security',
      label: 'Security & Compliance',
      icon: 'ri-shield-check-line',
      colorClass: 'red',
      headline: 'Security & Compliance',
      description: 'Enterprise-grade security built for legal. AES-256 encryption, role-based access, and full audit trails to satisfy bar requirements.',
      items: [
        {
          icon: 'ri-user-settings-line',
          title: 'Role-Based Access',
          description: '10+ predefined roles ensure everyone sees only what they should. Custom roles available for unique firm structures.',
          bullets: [
            '10+ roles: Admin, Partner, Attorney, Paralegal, Billing, and more',
            'Granular permissions per module',
            'Custom role creation for unique workflows',
            'Role-based dashboards with relevant data only'
          ],
          colorClass: 'red'
        },
        {
          icon: 'ri-lock-line',
          title: 'Encryption & Audit Trails',
          description: 'AES-256 encryption at rest, TLS 1.3 in transit. Every action logged with user, timestamp, and IP address.',
          bullets: [
            'AES-256 encryption at rest',
            'TLS 1.3 encryption in transit',
            'Comprehensive audit trail for all actions',
            'Compliant with ABA Rule 1.6 and 201 CMR 17.00'
          ],
          colorClass: 'red'
        },
        {
          icon: 'ri-database-2-line',
          title: 'Multi-Tenant Data Isolation',
          description: 'Every firm\'s data is completely isolated at the database level. No cross-tenant data leakage — ever.',
          bullets: [
            'Database-level tenant isolation',
            'Organization-scoped queries on every request',
            'Separate encryption keys per tenant',
            'SOC 2 Type II compliance roadmap'
          ],
          colorClass: 'red'
        }
      ]
    }
  ];

  constructor(private titleService: Title, private metaService: Meta) {}

  ngOnInit(): void {
    this.titleService.setTitle('Features — Legience | AI-Native Legal Practice Management');
    this.metaService.updateTag({
      name: 'description',
      content: 'Explore all Legience features: AI legal research, document drafting, case management, time tracking, billing, e-signatures, CRM, client portal, and more.'
    });
  }

  scrollToCategory(categoryId: string): void {
    this.activeFilter = categoryId;
    if (categoryId === 'all') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const element = document.getElementById('category-' + categoryId);
    if (element) {
      const offset = 100; // account for sticky filter bar
      const top = element.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }
}
