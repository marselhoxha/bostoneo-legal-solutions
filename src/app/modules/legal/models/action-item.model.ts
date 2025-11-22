export interface ActionItem {
  id?: number;
  analysisId: number;
  description: string;
  deadline?: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  relatedSection?: string;
  createdDate?: string;
  updatedDate?: string;
}

export interface TimelineEvent {
  id?: number;
  analysisId: number;
  eventDate: string;
  title: string;
  eventType: 'DEADLINE' | 'FILING' | 'HEARING' | 'MILESTONE';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  description?: string;
  relatedSection?: string;
  createdDate?: string;
  updatedDate?: string;
}
