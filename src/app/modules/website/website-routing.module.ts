import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { WebsiteLayoutComponent } from './layout/website-layout.component';

const routes: Routes = [
  {
    path: '',
    component: WebsiteLayoutComponent,
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/home/home-page.component').then(m => m.HomePageComponent),
        data: { title: 'Legience — AI-Native Legal Practice Management' }
      },
      {
        path: 'features',
        loadComponent: () => import('./pages/features/features-page.component').then(m => m.FeaturesPageComponent),
        data: { title: 'Features — Legience' }
      },
      {
        path: 'ai',
        loadComponent: () => import('./pages/ai/ai-page.component').then(m => m.AiPageComponent),
        data: { title: 'AI Features — Legience' }
      },
      {
        path: 'personal-injury',
        loadComponent: () => import('./pages/personal-injury/pi-page.component').then(m => m.PiPageComponent),
        data: { title: 'Personal Injury — Legience' }
      },
      {
        path: 'pricing',
        loadComponent: () => import('./pages/pricing/pricing-page.component').then(m => m.PricingPageComponent),
        data: { title: 'Pricing — Legience' }
      },
      {
        path: 'demo',
        loadComponent: () => import('./pages/demo/demo-page.component').then(m => m.DemoPageComponent),
        data: { title: 'Book a Demo — Legience' }
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class WebsiteRoutingModule { }
