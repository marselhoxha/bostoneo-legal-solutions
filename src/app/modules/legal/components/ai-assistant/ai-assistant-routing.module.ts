import { NgModule } from '@angular/core';
import { RouterModule, Routes, UrlMatcher, UrlSegment } from '@angular/router';
import { AuthenticationGuard } from '@app/guard/authentication.guard';

// Consolidates /legispace/:tab, /legispace/:tab/:mode, and /legispace/:tab/:mode/:id
// into ONE route definition so Angular preserves the AiWorkspaceComponent instance
// when the user transitions between depths (e.g., dashboard → chat → editor).
// Three sibling route entries pointing at the same component would each be a
// distinct route definition and would cause destroy/recreate on every transition.
export const legispaceWorkspaceMatcher: UrlMatcher = (segments: UrlSegment[]) => {
  if (segments.length < 2 || segments[0].path !== 'legispace') return null;
  if (segments.length > 4) return null; // too deep — let wildcard / 404 handle
  const posParams: { [k: string]: UrlSegment } = { tab: segments[1] };
  if (segments.length >= 3) posParams['mode'] = segments[2];
  if (segments.length >= 4) posParams['id'] = segments[3];
  return { consumed: segments, posParams };
};

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
    path: 'legipi',
    loadComponent: () => import('./practice-areas/personal-injury/personal-injury.component').then(m => m.PersonalInjuryComponent),
    canActivate: [AuthenticationGuard],
    data: { title: 'LegiPI' }
  },
  {
    path: 'practice-areas/personal-injury',
    redirectTo: 'legipi',
    pathMatch: 'full'
  },
  {
    path: 'templates',
    loadComponent: () => import('./templates/template-library.component').then(m => m.TemplateLibraryComponent),
    canActivate: [AuthenticationGuard],
    data: { title: 'Template Library' }
  },
  {
    path: 'templates/new',
    loadComponent: () => import('./templates/template-editor/template-editor.component').then(m => m.TemplateEditorComponent),
    canActivate: [AuthenticationGuard],
    data: { title: 'New Template' }
  },
  {
    path: 'templates/edit/:id',
    loadComponent: () => import('./templates/template-editor/template-editor.component').then(m => m.TemplateEditorComponent),
    canActivate: [AuthenticationGuard],
    data: { title: 'Edit Template' }
  },
  {
    path: 'templates/fill/:id',
    loadComponent: () => import('./templates/template-filler/template-filler.component').then(m => m.TemplateFillerComponent),
    canActivate: [AuthenticationGuard],
    data: { title: 'Fill Template' }
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
    path: 'legispace',
    redirectTo: 'legispace/legisearch',
    pathMatch: 'full'
  },
  {
    matcher: legispaceWorkspaceMatcher,
    loadComponent: () => import('./ai-workspace/ai-workspace.component').then(m => m.AiWorkspaceComponent),
    canActivate: [AuthenticationGuard],
    data: { title: 'LegiSpace' }
  },
  {
    path: 'ai-workspace',
    redirectTo: 'legispace',
    pathMatch: 'full'
  },
  {
    path: 'collaboration',
    loadComponent: () => import('./collaboration/collaboration.component').then(m => m.CollaborationComponent),
    canActivate: [AuthenticationGuard],
    data: { title: 'Collaborative Editing' }
  },
  {
    path: 'stationery-settings',
    loadComponent: () => import('./stationery-settings/stationery-settings.component').then(m => m.StationerySettingsComponent),
    canActivate: [AuthenticationGuard],
    data: { title: 'Stationery Templates' }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class AiAssistantRoutingModule { }