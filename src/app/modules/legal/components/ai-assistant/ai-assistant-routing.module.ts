import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthenticationGuard } from '@app/guard/authentication.guard';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/ai-dashboard.component').then(m => m.AiDashboardComponent),
    canActivate: [AuthenticationGuard],
    data: { title: 'AI Assistant Dashboard' }
  },
  {
    path: 'document-generation',
    loadChildren: () => import('./document-generation/document-generation.module').then(m => m.DocumentGenerationModule),
    canActivate: [AuthenticationGuard],
    data: { title: 'Document Generation' }
  },
  {
    path: 'practice-areas',
    loadComponent: () => import('./practice-areas/practice-areas-dashboard.component').then(m => m.PracticeAreasDashboardComponent),
    canActivate: [AuthenticationGuard],
    data: { title: 'Practice Area Tools' }
  },
  {
    path: 'practice-areas/criminal-defense',
    loadComponent: () => import('./practice-areas/criminal-defense/criminal-defense.component').then(m => m.CriminalDefenseComponent),
    canActivate: [AuthenticationGuard],
    data: { title: 'Criminal Defense Tools' }
  },
  {
    path: 'practice-areas/family-law',
    loadComponent: () => import('./practice-areas/family-law/family-law.component').then(m => m.FamilyLawComponent),
    canActivate: [AuthenticationGuard],
    data: { title: 'Family Law Tools' }
  },
  {
    path: 'practice-areas/immigration',
    loadComponent: () => import('./practice-areas/immigration/immigration.component').then(m => m.ImmigrationComponent),
    canActivate: [AuthenticationGuard],
    data: { title: 'Immigration Law Tools' }
  },
  {
    path: 'practice-areas/real-estate',
    loadComponent: () => import('./practice-areas/real-estate/real-estate.component').then(m => m.RealEstateComponent),
    canActivate: [AuthenticationGuard],
    data: { title: 'Real Estate Law Tools' }
  },
  {
    path: 'practice-areas/intellectual-property',
    loadComponent: () => import('./practice-areas/intellectual-property/intellectual-property.component').then(m => m.IntellectualPropertyComponent),
    canActivate: [AuthenticationGuard],
    data: { title: 'Intellectual Property Tools' }
  },
  {
    path: 'templates',
    loadComponent: () => import('./templates/template-library.component').then(m => m.TemplateLibraryComponent),
    canActivate: [AuthenticationGuard],
    data: { title: 'Template Library' }
  },
  {
    path: 'analytics',
    loadComponent: () => import('./analytics/usage-analytics.component').then(m => m.UsageAnalyticsComponent),
    canActivate: [AuthenticationGuard],
    data: { title: 'Usage Analytics' }
  },
  {
    path: 'legal-research',
    loadComponent: () => import('./legal-research/legal-research.component').then(m => m.LegalResearchComponent),
    canActivate: [AuthenticationGuard],
    data: { title: 'Legal Research' }
  },
  {
    path: 'collaboration',
    loadComponent: () => import('./collaboration/collaboration.component').then(m => m.CollaborationComponent),
    canActivate: [AuthenticationGuard],
    data: { title: 'Collaborative Editing' }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AiAssistantRoutingModule { }