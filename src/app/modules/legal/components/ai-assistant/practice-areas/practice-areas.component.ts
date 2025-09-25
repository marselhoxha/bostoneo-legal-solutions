import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

interface PracticeArea {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  isActive: boolean;
  tools: string[];
  documentsGenerated: number;
  route?: string;
}

interface RecentActivity {
  practiceArea: string;
  tool: string;
  documentType: string;
  date: Date;
  status: 'completed' | 'in-progress';
}

@Component({
  selector: 'app-practice-areas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './practice-areas.component.html',
  styleUrls: ['./practice-areas.component.scss']
})
export class PracticeAreasComponent implements OnInit {
  practiceAreas: PracticeArea[] = [];
  recentActivities: RecentActivity[] = [];

  activePracticeAreas = 5;
  recentUpdates = 3;
  mostUsed = 'Immigration';

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.loadPracticeAreas();
    this.loadRecentActivities();
  }

  loadPracticeAreas(): void {
    this.practiceAreas = [
      {
        id: 'immigration',
        name: 'Immigration Law',
        description: 'Form generation, case analysis, and petition assistance for immigration matters',
        icon: 'ri-passport-line',
        color: 'primary',
        isActive: true,
        tools: ['I-130 Petitions', 'Green Card Applications', 'Visa Processing'],
        documentsGenerated: 342,
        route: '/legal/ai-assistant/practice-areas/immigration'
      },
      {
        id: 'criminal-defense',
        name: 'Criminal Defense',
        description: 'Motion drafting, case research, and sentencing guideline calculations',
        icon: 'ri-shield-line',
        color: 'danger',
        isActive: true,
        tools: ['Motion Generator', 'Case Analyzer', 'Sentencing Calculator'],
        documentsGenerated: 198,
        route: '/legal/ai-assistant/practice-areas/criminal-defense'
      },
      {
        id: 'family-law',
        name: 'Family Law',
        description: 'Divorce documents, custody agreements, and support calculations',
        icon: 'ri-parent-line',
        color: 'success',
        isActive: true,
        tools: ['Divorce Forms', 'Custody Agreements', 'Support Calculator'],
        documentsGenerated: 289,
        route: '/legal/ai-assistant/practice-areas/family-law'
      },
      {
        id: 'real-estate',
        name: 'Real Estate',
        description: 'Purchase agreements, lease documents, and closing statements',
        icon: 'ri-home-line',
        color: 'info',
        isActive: true,
        tools: ['Purchase Agreements', 'Lease Generator', 'Closing Docs'],
        documentsGenerated: 156,
        route: '/legal/ai-assistant/practice-areas/real-estate'
      },
      {
        id: 'intellectual-property',
        name: 'Intellectual Property',
        description: 'Patent applications, trademark filings, and copyright registrations',
        icon: 'ri-lightbulb-line',
        color: 'warning',
        isActive: true,
        tools: ['Patent Search', 'Trademark Filing', 'Copyright Forms'],
        documentsGenerated: 134,
        route: '/legal/ai-assistant/practice-areas/intellectual-property'
      },
      {
        id: 'corporate-law',
        name: 'Corporate Law',
        description: 'Formation documents, contracts, and compliance filings',
        icon: 'ri-building-line',
        color: 'secondary',
        isActive: false,
        tools: ['Incorporation', 'Contracts', 'Compliance'],
        documentsGenerated: 0
      },
      {
        id: 'employment-law',
        name: 'Employment Law',
        description: 'Employment agreements, policies, and workplace compliance',
        icon: 'ri-briefcase-line',
        color: 'dark',
        isActive: false,
        tools: ['Employment Contracts', 'HR Policies', 'Compliance'],
        documentsGenerated: 0
      },
      {
        id: 'personal-injury',
        name: 'Personal Injury',
        description: 'Demand letters, settlement agreements, and case evaluation',
        icon: 'ri-first-aid-kit-line',
        color: 'danger',
        isActive: false,
        tools: ['Demand Letters', 'Settlement Calc', 'Case Evaluation'],
        documentsGenerated: 0
      },
      {
        id: 'tax-law',
        name: 'Tax Law',
        description: 'Tax planning, IRS correspondence, and compliance documents',
        icon: 'ri-calculator-line',
        color: 'success',
        isActive: false,
        tools: ['Tax Planning', 'IRS Forms', 'Compliance Docs'],
        documentsGenerated: 0
      }
    ];

    this.activePracticeAreas = this.practiceAreas.filter(a => a.isActive).length;
  }

  loadRecentActivities(): void {
    this.recentActivities = [
      {
        practiceArea: 'Immigration',
        tool: 'I-130 Petition Generator',
        documentType: 'Family Petition',
        date: new Date('2024-01-20T10:30:00'),
        status: 'completed'
      },
      {
        practiceArea: 'Criminal Defense',
        tool: 'Motion Generator',
        documentType: 'Motion to Dismiss',
        date: new Date('2024-01-20T09:15:00'),
        status: 'completed'
      },
      {
        practiceArea: 'Family Law',
        tool: 'Support Calculator',
        documentType: 'Child Support Worksheet',
        date: new Date('2024-01-19T16:45:00'),
        status: 'completed'
      },
      {
        practiceArea: 'Real Estate',
        tool: 'Lease Generator',
        documentType: 'Residential Lease',
        date: new Date('2024-01-19T14:20:00'),
        status: 'in-progress'
      },
      {
        practiceArea: 'Intellectual Property',
        tool: 'Patent Search',
        documentType: 'Prior Art Report',
        date: new Date('2024-01-19T11:00:00'),
        status: 'completed'
      }
    ];
  }

  navigateToPracticeArea(area: PracticeArea): void {
    if (area.isActive && area.route) {
      this.router.navigate([area.route]);
    }
  }
}