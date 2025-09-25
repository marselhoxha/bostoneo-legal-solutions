import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

interface PracticeAreaTool {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  features: string[];
  route: string;
  isAvailable: boolean;
  usageCount?: number;
}

@Component({
  selector: 'app-practice-areas-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './practice-areas-dashboard.component.html',
  styleUrls: ['./practice-areas-dashboard.component.scss']
})
export class PracticeAreasDashboardComponent implements OnInit {
  practiceAreas: PracticeAreaTool[] = [
    {
      id: 'criminal-defense',
      name: 'Criminal Defense',
      description: 'AI-powered tools for criminal defense attorneys',
      icon: 'ri-shield-line',
      color: 'danger',
      features: [
        'Motion drafting assistance',
        'Sentencing guidelines calculator',
        'Case law research',
        'Plea agreement analyzer',
        'Evidence tracker'
      ],
      route: '/legal/ai-assistant/practice-areas/criminal-defense',
      isAvailable: true,
      usageCount: 0
    },
    {
      id: 'family-law',
      name: 'Family Law',
      description: 'Comprehensive family law practice tools',
      icon: 'ri-parent-line',
      color: 'success',
      features: [
        'Child support calculator',
        'Custody agreement generator',
        'Divorce document preparation',
        'Property division analyzer',
        'Alimony calculator'
      ],
      route: '/legal/ai-assistant/practice-areas/family-law',
      isAvailable: true,
      usageCount: 0
    },
    {
      id: 'immigration',
      name: 'Immigration Law',
      description: 'Immigration forms and petition assistance',
      icon: 'ri-passport-line',
      color: 'primary',
      features: [
        'USCIS form completion',
        'Visa petition drafting',
        'Case status tracker',
        'Document checklist generator',
        'Timeline calculator'
      ],
      route: '/legal/ai-assistant/practice-areas/immigration',
      isAvailable: true,
      usageCount: 0
    },
    {
      id: 'real-estate',
      name: 'Real Estate Law',
      description: 'Real estate transaction and closing tools',
      icon: 'ri-building-line',
      color: 'warning',
      features: [
        'Purchase agreement generator',
        'Closing document preparation',
        'Title review checklist',
        'Deed drafting',
        'Lease agreement creator'
      ],
      route: '/legal/ai-assistant/practice-areas/real-estate',
      isAvailable: true,
      usageCount: 0
    },
    {
      id: 'intellectual-property',
      name: 'Intellectual Property',
      description: 'Patent, trademark, and copyright tools',
      icon: 'ri-lightbulb-line',
      color: 'info',
      features: [
        'Patent application drafting',
        'Trademark search',
        'Copyright registration',
        'Prior art search',
        'Licensing agreement generator'
      ],
      route: '/legal/ai-assistant/practice-areas/intellectual-property',
      isAvailable: true,
      usageCount: 0
    },
    {
      id: 'corporate-law',
      name: 'Corporate Law',
      description: 'Business formation and corporate governance',
      icon: 'ri-briefcase-line',
      color: 'dark',
      features: [
        'Entity formation documents',
        'Operating agreements',
        'Bylaws generator',
        'Stock purchase agreements',
        'Board resolutions'
      ],
      route: '/legal/ai-assistant/practice-areas/corporate-law',
      isAvailable: false,
      usageCount: 0
    }
  ];

  searchQuery: string = '';
  filteredAreas: PracticeAreaTool[] = [];
  selectedCategory: string = 'all';
  
  stats = {
    totalTools: 0,
    activeTools: 0,
    totalUsage: 0,
    lastAccessed: null as Date | null
  };

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.loadPracticeAreaStats();
    this.filterAreas();
  }

  loadPracticeAreaStats(): void {
    // Load usage statistics from localStorage or backend
    const savedStats = localStorage.getItem('practiceAreaStats');
    if (savedStats) {
      const stats = JSON.parse(savedStats);
      this.practiceAreas.forEach(area => {
        if (stats[area.id]) {
          area.usageCount = stats[area.id].count;
        }
      });
    }

    // Calculate stats
    this.stats.totalTools = this.practiceAreas.length;
    this.stats.activeTools = this.practiceAreas.filter(a => a.isAvailable).length;
    this.stats.totalUsage = this.practiceAreas.reduce((sum, area) => sum + (area.usageCount || 0), 0);
  }

  filterAreas(): void {
    let filtered = [...this.practiceAreas];

    // Filter by search query
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(area => 
        area.name.toLowerCase().includes(query) ||
        area.description.toLowerCase().includes(query) ||
        area.features.some(f => f.toLowerCase().includes(query))
      );
    }

    // Filter by category
    if (this.selectedCategory === 'available') {
      filtered = filtered.filter(a => a.isAvailable);
    } else if (this.selectedCategory === 'coming-soon') {
      filtered = filtered.filter(a => !a.isAvailable);
    }

    this.filteredAreas = filtered;
  }

  navigateToArea(area: PracticeAreaTool): void {
    if (!area.isAvailable) {
      this.showComingSoonAlert();
      return;
    }

    // Update usage count
    area.usageCount = (area.usageCount || 0) + 1;
    this.saveUsageStats();

    // Navigate to the practice area
    this.router.navigate([area.route]);
  }

  saveUsageStats(): void {
    const stats: any = {};
    this.practiceAreas.forEach(area => {
      stats[area.id] = {
        count: area.usageCount || 0,
        lastAccessed: new Date()
      };
    });
    localStorage.setItem('practiceAreaStats', JSON.stringify(stats));
  }

  showComingSoonAlert(): void {
    // You can use SweetAlert here
    alert('This practice area tool is coming soon!');
  }

  getColorClass(color: string): string {
    return `text-${color}`;
  }

  getBadgeClass(color: string): string {
    return `badge bg-${color}-subtle text-${color}`;
  }

  getButtonClass(color: string): string {
    return `btn btn-${color}`;
  }
}