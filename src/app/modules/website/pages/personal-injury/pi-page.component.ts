import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { AppWindowComponent } from '../../shared/components/app-window/app-window.component';
import { CtaSectionComponent } from '../../shared/components/cta-section/cta-section.component';
import { StatsBarComponent, StatItem } from '../../shared/components/stats-bar/stats-bar.component';
import { ScrollAnimateDirective } from '../../shared/directives/scroll-animate.directive';

@Component({
  selector: 'app-pi-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    AppWindowComponent,
    CtaSectionComponent,
    StatsBarComponent,
    ScrollAnimateDirective
  ],
  templateUrl: './pi-page.component.html',
  styleUrls: ['./pi-page.component.scss']
})
export class PiPageComponent implements OnInit {
  heroStats: StatItem[] = [
    { value: 'Unlimited', label: 'Demand Letters' },
    { value: '8', label: 'Damage Categories' },
    { value: '0', label: 'Per-Case Fees' },
    { value: 'AI', label: 'Settlement Analysis' }
  ];

  workflowSteps = [
    { number: '01', title: 'Intake', icon: 'ri-user-add-line', description: 'Client info, accident details, insurance captured' },
    { number: '02', title: 'Medical Records', icon: 'ri-hospital-line', description: '12 provider types, AI summaries, gap detection' },
    { number: '03', title: 'Damage Calculator', icon: 'ri-calculator-line', description: '8 categories, strength scoring, settlement ranges' },
    { number: '04', title: 'Demand Letter', icon: 'ri-file-text-line', description: 'AI-generated, 7 transformations, PDF export' },
    { number: '05', title: 'Settlement', icon: 'ri-scales-3-line', description: 'Negotiation tracker, offer/counter-offer timeline' }
  ];

  features = [
    {
      badge: 'ai', badgeIcon: 'ri-calculator-line', badgeLabel: 'AI-POWERED',
      title: 'AI Damage Calculator',
      description: 'Automatically compute damages across 8 categories with AI-driven case strength scoring and settlement range estimation. No more spreadsheets.',
      bullets: [
        { bold: '8 damage categories', text: 'Medical, lost wages, pain & suffering, future medical, future wages, loss of consortium, property damage, punitive' },
        { bold: 'AI case strength scoring', text: 'rates your case 1\u201310 based on liability, damages, and documentation' },
        { bold: 'Settlement range estimation', text: 'Low / Likely / High ranges based on comparable cases' },
        { bold: 'Medical expense tracking', text: 'auto-totals from provider records' },
        { bold: 'Lost wage calculations', text: 'hourly, salary, self-employed with multiplier support' }
      ],
      reverse: false
    },
    {
      badge: 'ai', badgeIcon: 'ri-file-text-line', badgeLabel: 'AI-POWERED',
      title: 'AI Demand Letters',
      description: 'Generate comprehensive demand letters that pull directly from your case data \u2014 parties, insurance, damages, medical records. Unlimited letters, zero per-case fees.',
      bullets: [
        { bold: 'Auto-fill from case data', text: 'parties, insurance company, policy limits, damages' },
        { bold: '7 transformation modes', text: 'strengthen, soften, expand, condense, formalize, simplify, restructure' },
        { bold: 'Citation-verified', text: 'AI cites real cases from CourtListener\u2019s database' },
        { bold: 'Export as PDF', text: 'professional formatting ready to send' },
        { bold: 'No per-case fees', text: 'vs EvenUp at $300\u2013$800 per demand letter' }
      ],
      reverse: true
    },
    {
      badge: 'pi', badgeIcon: 'ri-hospital-line', badgeLabel: 'PI WORKSPACE',
      title: 'Medical Records Management',
      description: 'Track every provider, every record, every treatment. AI summarizes medical records and detects gaps in treatment that could undermine your case.',
      bullets: [
        { bold: '12 provider types / 13 record types', text: 'hospitals, specialists, imaging, physical therapy, and more' },
        { bold: 'AI medical summaries', text: 'with causation analysis linking injuries to the accident' },
        { bold: 'Treatment gap detection', text: 'flags periods without treatment that adjusters exploit' },
        { bold: 'Completeness scoring', text: 'see what percentage of records you\u2019ve collected' },
        { bold: 'Provider contact management', text: 'phone, fax, email, address for every provider' }
      ],
      reverse: false
    },
    {
      badge: 'pi', badgeIcon: 'ri-scales-3-line', badgeLabel: 'PI WORKSPACE',
      title: 'Settlement Tracker',
      description: 'Track every demand, offer, and counter-offer in one place. Visualize the negotiation gap closing over time with a chronological timeline.',
      bullets: [
        { bold: 'Log demands/offers/counter-offers', text: 'with dates, amounts, and notes' },
        { bold: 'Visual negotiation gap tracker', text: 'see the gap between demand and offer narrow over time' },
        { bold: 'Chronological timeline', text: 'every negotiation event displayed with connectors' },
        { bold: 'Settlement distribution calculator', text: 'attorney fees, liens, costs, net to client' }
      ],
      reverse: true
    }
  ];

  constructor(private titleService: Title, private metaService: Meta) {}

  ngOnInit(): void {
    this.titleService.setTitle('Personal Injury \u2014 Legience');
    this.metaService.updateTag({
      name: 'description',
      content: 'A complete PI workflow with AI damage calculators, unlimited demand letters, medical records management, and settlement tracking. Zero per-case fees.'
    });
  }
}
