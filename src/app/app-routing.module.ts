import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './component/home/home/home.component';
import { AuthenticationGuard } from './guard/authentication.guard';
import { LayoutComponent } from './component/layouts/layout.component';
import { InvoiceAnalyticsComponent } from './component/invoice-analytics/invoice-analytics.component';
import { FaqsComponent } from './component/faqs/faqs.component';
import { AuthGuard } from './guard/auth.guard';
import { NotificationTestComponent } from './modules/legal/components/notification-test/notification-test.component';

const routes: Routes = [
  {
    path: '',
    component: LayoutComponent,  // Wrap all routes with the layout
    children: [
      { path: 'dashboard', loadChildren: () => import('./component/home/home.module').then(m => m.HomeModule), canActivate: [AuthenticationGuard] },
      { path: 'customers', loadChildren: () => import('./component/customer/customer.module').then(m => m.CustomerModule), canActivate: [AuthenticationGuard] },
      { path: 'invoices', loadChildren: () => import('./component/invoice/invoice.module').then(m => m.InvoiceModule), canActivate: [AuthenticationGuard] },
      { path: 'profile', loadChildren: () => import('./component/profile/user.module').then(m => m.UserModule), canActivate: [AuthenticationGuard] },
      { path: 'analytics', component: InvoiceAnalyticsComponent },
      { path: 'faq', component: FaqsComponent },
      { path: 'legal', loadChildren: () => import('./modules/legal/legal.module').then(m => m.LegalModule), canActivate: [AuthenticationGuard] },
      { path: 'expenses', loadChildren: () => import('./modules/expenses/expenses.module').then(m => m.ExpensesModule), canActivate: [AuthenticationGuard] },
      { path: 'notification-test', component: NotificationTestComponent, title: 'Push Notification Test', canActivate: [AuthenticationGuard] },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },
  { path: '**', redirectTo: '', pathMatch: 'full' }, // Fallback for unmatched routes
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
