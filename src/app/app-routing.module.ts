import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './component/home/home/home.component';
import { AuthenticationGuard } from './guard/authentication.guard';
import { LayoutComponent } from './component/layouts/layout.component';
import { InvoiceAnalyticsComponent } from './component/invoice-analytics/invoice-analytics.component';
import { FaqsComponent } from './component/faqs/faqs.component';

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
      // Add other routes inside this children array, as needed
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }, // Redirect to 'dashboard' by default within the layout
    ]
  },
  { path: '**', redirectTo: '', pathMatch: 'full' }, // Fallback for unmatched routes
];



@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule]
})
export class AppRoutingModule { }
