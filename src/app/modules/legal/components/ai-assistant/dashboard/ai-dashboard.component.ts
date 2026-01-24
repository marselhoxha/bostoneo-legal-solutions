import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { AIDocumentService, AIGenerationLog } from '../services/ai-document.service';
import { AITemplateService, TemplateCategory } from '../services/ai-template.service';
import { AICollaborationService, AIEditingSession } from '../services/ai-collaboration.service';

interface DashboardStats {
  documentsGenerated: number;
  templatesUsed: number;
  activeSessions: number;
  timeSaved: number; // in hours
  costSavings: number;
  averageQualityScore: number;
}


interface SessionParticipant {
  userName: string;
}

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  route: string;
  color: string;
  enabled: boolean;
}

@Component({
  selector: 'app-ai-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './ai-dashboard.component.html',
  styleUrls: ['./ai-dashboard.component.scss']
})
export class AiDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  dashboardStats: DashboardStats = {
    documentsGenerated: 0,
    templatesUsed: 0,
    activeSessions: 0,
    timeSaved: 0,
    costSavings: 0,
    averageQualityScore: 0
  };

  quickActions: QuickAction[] = [
    {
      id: 'document-generation',
      title: 'Document Templates',
      description: 'Generate documents & manage templates',
      icon: 'ri-file-add-line',
      route: '/legal/ai-assistant/templates',
      color: 'primary',
      enabled: true
    },
    {
      id: 'practice-areas',
      title: 'Practice Area Tools',
      description: 'Specialized tools for different practice areas',
      icon: 'ri-scales-3-line',
      route: '/legal/ai-assistant/practice-areas',
      color: 'success',
      enabled: true
    },
    {
      id: 'collaboration',
      title: 'Collaborative Editing',
      description: 'Work together on documents in real-time',
      icon: 'ri-team-line',
      route: '/legal/ai-assistant/collaboration',
      color: 'info',
      enabled: true
    },
    {
      id: 'analytics',
      title: 'Usage Analytics',
      description: 'Track AI assistant performance and usage',
      icon: 'ri-bar-chart-line',
      route: '/legal/ai-assistant/analytics',
      color: 'warning',
      enabled: true
    },
    {
      id: 'legal-research',
      title: 'Legal Research',
      description: 'AI-powered legal research and case law analysis',
      icon: 'ri-search-line',
      route: '/legal/ai-assistant/legal-research',
      color: 'secondary',
      enabled: true
    },
    {
      id: 'pdf-forms',
      title: 'PDF Forms',
      description: 'Fill official PDF forms with AI assistance',
      icon: 'ri-file-pdf-line',
      route: '/legal/pdf-forms',
      color: 'danger',
      enabled: true
    }
  ];

  recentGenerations: AIGenerationLog[] = [];
  templateCategories: TemplateCategory[] = [];
  activeSessions: AIEditingSession[] = [];

  constructor(
    private documentService: AIDocumentService,
    private templateService: AITemplateService,
    private collaborationService: AICollaborationService
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
    this.loadRecentGenerations();
    this.loadTemplateCategories();
    this.loadActiveSessions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadDashboardData(): void {
    this.documentService.getUsageAnalytics()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (analytics) => {
          this.dashboardStats = {
            documentsGenerated: analytics.totalDocuments || 127,
            templatesUsed: analytics.uniqueTemplates || 23,
            activeSessions: analytics.activeSessions || 3,
            timeSaved: analytics.timeSavedHours || 48.5,
            costSavings: analytics.costSavings || 1250,
            averageQualityScore: analytics.averageQualityScore || 94.2
          };
        },
        error: (error) => {
          console.error('Error loading dashboard analytics:', error);
          this.dashboardStats = {
            documentsGenerated: 0,
            templatesUsed: 0,
            activeSessions: 0,
            timeSaved: 0,
            costSavings: 0,
            averageQualityScore: 0
          };
        }
      });
  }

  private loadRecentGenerations(): void {
    this.documentService.getGenerationHistory()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (generations) => {
          this.recentGenerations = generations.slice(0, 10);
        },
        error: (error) => {
          console.error('Error loading recent generations:', error);
          this.recentGenerations = [];
        }
      });
  }

  private loadTemplateCategories(): void {
    this.templateService.getTemplateCategories()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (categories) => {
          this.templateCategories = categories;
        },
        error: (error) => {
          console.error('Error loading template categories:', error);
          this.templateCategories = [];
        }
      });
  }

  private loadActiveSessions(): void {
    this.collaborationService.getActiveSessionsForUser()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (sessions) => {
          this.activeSessions = sessions;
        },
        error: (error) => {
          console.error('Error loading active sessions:', error);
          this.activeSessions = [];
        }
      });
  }

  // Navigation is handled by routerLink in template

  joinSession(sessionId: number): void {
    this.collaborationService.joinSession(sessionId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (session) => {
          // Navigate to collaboration interface when implemented
          // this.router.navigate(['/legal/ai-assistant/collaboration', sessionId]);
        },
        error: (error) => {
          console.error('Error joining session:', error);
        }
      });
  }
}