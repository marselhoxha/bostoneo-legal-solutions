import { MenuItem } from './menu.model';

export const MENU: MenuItem[] = [
  {
    id: 0,
    label: 'Dashboard',
    icon: 'ri-dashboard-line',
    link: '/dashboard',
    subItems: [
      // Your subitems go here
    ],
   
  },
  {
    id: 1,
    label: 'Dashboard',
    icon: 'ri-dashboard-line',
    link: '/dashboard',
    isTitle: true
  },
  {
    id: 2,
    label: 'Customers',
    icon: 'ri-user-2-line',
    link: '/customers',
    subItems: [
      // Your subitems go here
      
    ],
    
  },
  {
    id: 3,
    label: 'Invoices',
    icon: 'ri-file-list-3-line',
    link: '/invoices',
    
  },
 
  {
    id: 4,
    label: 'Settings',
    icon: 'ri-settings-3-line',
    link: '/profile',
    
  },
  {
    id: 5,
    label: 'FAQ',
    icon: 'ri-question-answer-line',
    link: '/faq',
    
  },
  
 
];
