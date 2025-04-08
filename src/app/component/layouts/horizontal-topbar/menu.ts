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
    label: 'Legal',
    icon: 'ri-scales-3-line',
    link: '/legal/cases',
    subItems: [
      {
        id: 'cases',
        label: 'Cases',
        link: '/legal/cases',
        parentId: 4
      },
      {
        id: 'documents',
        label: 'Documents',
        link: '/legal/documents',
        parentId: 4
      },
      {
        id: 'calendar',
        label: 'Calendar',
        link: '/legal/calendar',
        parentId: 4
      }
    ]
  },
  {
    id: 5,
    label: 'Settings',
    icon: 'ri-settings-3-line',
    link: '/profile',
    
  },
  {
    id: 6,
    label: 'FAQ',
    icon: 'ri-question-answer-line',
    link: '/faq',
    
  },
  
 
];
