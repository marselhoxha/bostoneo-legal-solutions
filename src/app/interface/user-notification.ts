export interface UserNotification {
  id: string;
  userId: number;
  type: 'ASSIGNMENT' | 'TASK' | 'DEADLINE' | 'WORKLOAD' | 'SYSTEM' | 'CASE_UPDATE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  title: string;
  message: string;
  data?: any;
  actions?: NotificationAction[];
  read: boolean;
  createdAt: Date;
  expiresAt?: Date;
  sourceComponent?: string;
  relatedEntityId?: number;
  relatedEntityType?: string;
}

export interface NotificationAction {
  label: string;
  action: 'NAVIGATE' | 'API_CALL' | 'MODAL' | 'DISMISS';
  target?: string;
  payload?: any;
  style?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
}

export interface NotificationPreferences {
  userId: number;
  inApp: boolean;
  email: boolean;
  sms: boolean;
  push: boolean;
  types: {
    [key in UserNotification['type']]: {
      enabled: boolean;
      channels: ('inApp' | 'email' | 'sms' | 'push')[];
      threshold?: UserNotification['priority'];
    };
  };
}

export interface NotificationDelivery {
  notificationId: string;
  channel: 'inApp' | 'email' | 'sms' | 'push';
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED';
  sentAt?: Date;
  deliveredAt?: Date;
  error?: string;
}