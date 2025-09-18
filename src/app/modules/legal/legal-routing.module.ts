import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthenticationGuard } from '@app/guard/authentication.guard';
import { PermissionGuard } from '@app/guard/permission.guard';

const routes: Routes = [
  {
    path: 'cases',
    loadChildren: () => import('@app/modules/legal/components/case/case.module').then(m => m.CaseModule),
    canActivate: [AuthenticationGuard, PermissionGuard],
    data: {
      permission: { resource: 'CASE', action: 'VIEW' }
    }
  },
  {
    path: 'documents',
    loadChildren: () => import('@app/modules/legal/components/document/document.module').then(m => m.DocumentModule),
    canActivate: [AuthenticationGuard, PermissionGuard],
    data: {
      permission: { resource: 'DOCUMENT', action: 'VIEW' }
    }
  },
  {
    path: 'calendar',
    loadChildren: () => import('@app/modules/legal/components/calendar/calendar.module').then(m => m.CalendarModule),
    canActivate: [AuthenticationGuard, PermissionGuard],
    data: {
      permission: { resource: 'CALENDAR', action: 'VIEW' }
    }
  },
  {
    path: 'ai-assistant',
    loadChildren: () => import('@app/modules/legal/components/ai-assistant/ai-assistant.module').then(m => m.AiAssistantModule),
    canActivate: [AuthenticationGuard],
    data: {
      title: 'AI Assistant'
    }
  },
  {
    path: 'contract-risk-scanner',
    loadChildren: () => import('@app/modules/legal/components/contract-risk-scanner/contract-risk-scanner.module').then(m => m.ContractRiskScannerModule),
    canActivate: [AuthenticationGuard],
    data: {
      title: 'Contract Risk Scanner'
    }
  },
  {
    path: 'document-analyzer',
    loadChildren: () => import('@app/modules/legal/components/document-analyzer/document-analyzer.module').then(m => m.DocumentAnalyzerModule),
    canActivate: [AuthenticationGuard],
    data: {
      title: 'Document Analyzer'
    }
  },
  {
    path: 'legal-research-assistant',
    loadChildren: () => import('@app/modules/legal/components/legal-research-assistant/legal-research-assistant.module').then(m => m.LegalResearchAssistantModule),
    canActivate: [AuthenticationGuard],
    data: {
      title: 'Legal Research Assistant'
    }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class LegalRoutingModule { }
