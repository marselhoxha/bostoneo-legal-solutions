import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-usage-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './usage-analytics.component.html',
  styleUrls: ['./usage-analytics.component.scss']
})
export class UsageAnalyticsComponent implements OnInit {
  // Time period filter
  selectedPeriod = '7days';

  // Analytics data
  metrics = {
    totalDocuments: 1247,
    totalUsers: 23,
    avgProcessingTime: 3.2,
    successRate: 94.5,
    costSaved: 12500,
    timeSaved: 324
  };

  // Usage by practice area
  practiceAreaUsage = [
    { name: 'Immigration Law', documents: 342, percentage: 27.4 },
    { name: 'Family Law', documents: 289, percentage: 23.2 },
    { name: 'Criminal Defense', documents: 198, percentage: 15.9 },
    { name: 'Real Estate', documents: 156, percentage: 12.5 },
    { name: 'Intellectual Property', documents: 134, percentage: 10.7 },
    { name: 'Corporate Law', documents: 128, percentage: 10.3 }
  ];

  // Top templates
  topTemplates = [
    { name: 'I-130 Petition', uses: 89, trend: 'up' },
    { name: 'Divorce Agreement', uses: 67, trend: 'up' },
    { name: 'Motion to Dismiss', uses: 54, trend: 'stable' },
    { name: 'Lease Agreement', uses: 45, trend: 'down' },
    { name: 'NDA Agreement', uses: 41, trend: 'up' }
  ];

  // User activity
  userActivity = [
    { name: 'John Smith', documents: 234, lastActive: new Date('2024-01-20') },
    { name: 'Sarah Johnson', documents: 189, lastActive: new Date('2024-01-19') },
    { name: 'Michael Brown', documents: 156, lastActive: new Date('2024-01-20') },
    { name: 'Emily Davis', documents: 134, lastActive: new Date('2024-01-18') },
    { name: 'Robert Wilson', documents: 98, lastActive: new Date('2024-01-20') }
  ];

  ngOnInit(): void {
    this.loadAnalytics();
  }

  loadAnalytics(): void {
    // In production, load from service
  }

  onPeriodChange(): void {
    this.loadAnalytics();
  }

  exportReport(): void {
    // Export analytics report functionality
  }
}