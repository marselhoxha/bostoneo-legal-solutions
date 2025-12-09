import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './component/home/home/home.component';
import { AuthenticationGuard } from './guard/authentication.guard';
import { LayoutComponent } from './component/layouts/layout.component';
import { FaqsComponent } from './component/faqs/faqs.component';
import { AuthGuard } from './guard/auth.guard';
import { RbacGuard, RoutePermissions } from './guard/rbac.guard';
import { BillingDashboardComponent } from './component/dashboards/billing/billing-dashboard.component';

const routes: Routes = [
  // Auth routes (no layout)
  { path: 'login', loadChildren: () => import('./component/auth/auth.module').then(m => m.AuthModule) },
  
  // Public routes (no auth required)
  { path: 'public', loadChildren: () => import('./modules/public/public.module').then(m => m.PublicModule) },
  
  // Main app routes (with layout)
  {
    path: '',
    component: LayoutComponent,
    canActivate: [AuthenticationGuard],
    children: [
      { path: 'user', loadChildren: () => import('./component/profile/user.module').then(m => m.UserModule) },
      { path: 'profile', redirectTo: 'user', pathMatch: 'full' },
      { path: 'users', loadChildren: () => import('./component/users/users.module').then(m => m.UsersModule) },
      { path: 'clients', loadChildren: () => import('./component/client/client.module').then(m => m.ClientModule) },
      { path: 'invoices', loadChildren: () => import('./component/invoice/invoice.module').then(m => m.InvoiceModule) },
      { path: 'stats', loadChildren: () => import('./component/stats/stats.module').then(m => m.StatsModule) },
      { path: 'home', loadChildren: () => import('./component/home/home.module').then(m => m.HomeModule) },
      
      // RBAC module
      { path: 'admin', loadChildren: () => import('./modules/admin/admin.module').then(m => m.AdminModule) },
      
      // Expenses module
      { path: 'expenses', loadChildren: () => import('./modules/expenses/expenses.module').then(m => m.ExpensesModule) },
      
      // CRM module
      { path: 'crm', loadChildren: () => import('./modules/crm/crm.module').then(m => m.CrmModule) },

      // Legal module
      { path: 'legal', loadChildren: () => import('./modules/legal/legal.module').then(m => m.LegalModule) },

      // Time tracking module
      { path: 'time-tracking', loadChildren: () => import('./modules/time-tracking/time-tracking.module').then(m => m.TimeTrackingModule) },

      // Case management module
      { 
        path: 'case-management', 
        loadChildren: () => import('./modules/case-management/case-management.module').then(m => m.CaseManagementModule),
        canActivate: [AuthenticationGuard]
      },

      // File manager module
      {
        path: 'file-manager',
        loadChildren: () => import('./modules/file-manager/file-manager.module').then(m => m.FileManagerModule),
        canActivate: [AuthenticationGuard]
      },

      // Client Portal module
      {
        path: 'client',
        loadChildren: () => import('./modules/client-portal/client-portal.module').then(m => m.ClientPortalModule),
        canActivate: [AuthenticationGuard]
      },

      // Activities module (lazy loaded)
      { 
        path: 'activities', 
        loadChildren: () => import('./component/activities/activities.module').then(m => m.ActivitiesModule),
        canActivate: [AuthenticationGuard]
      },

      // Billing Dashboard
      {
        path: 'billing-dashboard',
        component: BillingDashboardComponent,
        canActivate: [AuthenticationGuard]
      },

      // E-Signatures
      {
        path: 'signatures',
        loadComponent: () => import('./component/signatures/signatures.component').then(m => m.SignaturesComponent),
        canActivate: [AuthenticationGuard]
      },

      // Client Messages (Attorney view)
      {
        path: 'messages',
        loadComponent: () => import('./component/messages/messages.component').then(m => m.MessagesComponent),
        canActivate: [AuthenticationGuard]
      },
      
      // Debug Permissions
      {
        path: 'debug-permissions',
        loadComponent: () => import('./component/auth/debug-permissions/debug-permissions.component').then(m => m.DebugPermissionsComponent),
        canActivate: [AuthenticationGuard]
      },

      { path: '', redirectTo: 'home', pathMatch: 'full' }
    ]
  },
  
  { path: '**', redirectTo: '/home', pathMatch: 'full' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
