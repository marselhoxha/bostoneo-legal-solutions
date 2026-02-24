import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { AppWindowComponent } from '../../shared/components/app-window/app-window.component';
import { CtaSectionComponent } from '../../shared/components/cta-section/cta-section.component';
import { StatsBarComponent, StatItem } from '../../shared/components/stats-bar/stats-bar.component';
import { ScrollAnimateDirective } from '../../shared/directives/scroll-animate.directive';

@Component({
  selector: 'app-ai-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    AppWindowComponent,
    CtaSectionComponent,
    StatsBarComponent,
    ScrollAnimateDirective
  ],
  templateUrl: './ai-page.component.html',
  styleUrls: ['./ai-page.component.scss']
})
export class AiPageComponent implements OnInit {
  heroStats: StatItem[] = [
    { value: '30+', label: 'AI Doc Types' },
    { value: 'Citation-verified', label: 'Research' },
    { value: '6', label: 'Practice Areas' },
    { value: 'Included', label: 'In Every Plan' }
  ];

  researchBullets = [
    'Multi-turn conversations with persistent context across follow-ups',
    'Citation verification against CourtListener\'s 50,000+ legal documents',
    'Jurisdiction-specific filtering for federal and state courts',
    'Full source tracking with direct links to original opinions',
    'Thorough research mode with deeper multi-step analysis'
  ];

  practiceAreas = [
    {
      icon: 'ri-shield-line',
      name: 'Criminal Defense',
      docs: ['Motions to Suppress', 'Plea Agreements', 'Sentencing Memoranda']
    },
    {
      icon: 'ri-parent-line',
      name: 'Family Law',
      docs: ['Custody Agreements', 'Divorce Petitions', 'Support Motions']
    },
    {
      icon: 'ri-global-line',
      name: 'Immigration',
      docs: ['Asylum Applications', 'Hardship Waivers', 'VAWA Petitions']
    },
    {
      icon: 'ri-lightbulb-line',
      name: 'Intellectual Property',
      docs: ['Cease & Desist Letters', 'Licensing Agreements', 'IP Briefs']
    },
    {
      icon: 'ri-building-line',
      name: 'Real Estate',
      docs: ['Purchase Agreements', 'Lease Reviews', 'Title Opinions']
    },
    {
      icon: 'ri-heart-pulse-line',
      name: 'Personal Injury',
      docs: ['Demand Letters', 'Medical Summaries', 'Settlement Memos']
    }
  ];

  workspaceFeatures = [
    {
      icon: 'ri-edit-2-line',
      title: 'Collaborative Editing',
      description: 'Draft, refine, and transform AI-generated documents with 7 editing modes — expand, condense, formalize, simplify, strengthen, soften, and restructure.'
    },
    {
      icon: 'ri-loader-2-line',
      title: 'Background Processing',
      description: 'Queue multiple research tasks and document drafts. Work on other cases while AI processes in the background — no waiting around.'
    },
    {
      icon: 'ri-git-branch-line',
      title: 'Version Control',
      description: 'Every AI draft is versioned automatically. Compare revisions side by side, restore any previous version, and track exactly what changed.'
    }
  ];

  beforeItems = [
    '5 disconnected tools',
    '3+ hours per task',
    'Manual copy-paste',
    'No citation verification',
    '$500+/month in tool costs'
  ];

  afterItems = [
    '1 integrated platform',
    'Under 1 hour',
    'AI-connected workflow',
    'Every citation verified',
    'AI included in base price'
  ];

  competitorCards = [
    { name: 'Clio Duo', price: '$49', period: '/user/mo add-on', highlighted: false },
    { name: 'Harvey', price: '$1,000+', period: '/user/mo', highlighted: false },
    { name: 'Legience', price: 'Included', period: '', highlighted: true }
  ];

  constructor(private titleService: Title, private metaService: Meta) {}

  ngOnInit(): void {
    this.titleService.setTitle('AI Features — Legience');
    this.metaService.updateTag({
      name: 'description',
      content: 'Legience AI delivers citation-verified legal research, 30+ document types across 6 practice areas, and an integrated AI workspace — included in every plan.'
    });
  }
}
