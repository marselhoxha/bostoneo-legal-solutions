export interface Organization {
  id: number;
  name: string;
  slug: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
  logoUrl?: string;
  planType: PlanType;
  planExpiresAt?: string;

  // Twilio Status
  twilioEnabled?: boolean;
  twilioPhoneNumber?: string;
  twilioWhatsappNumber?: string;
  twilioFriendlyName?: string;
  twilioProvisionedAt?: string;
  twilioConfigured?: boolean;

  // BoldSign Status
  boldsignEnabled?: boolean;
  boldsignBrandId?: string;
  boldsignConfigured?: boolean;

  // Notification Preferences
  smsEnabled?: boolean;
  whatsappEnabled?: boolean;
  emailEnabled?: boolean;

  // Signature Reminder Settings
  signatureReminderEmail?: boolean;
  signatureReminderSms?: boolean;
  signatureReminderWhatsapp?: boolean;
  signatureReminderDays?: string;

  // Timestamps
  createdAt?: string;
  updatedAt?: string;
}

export type PlanType = 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';

export interface OrganizationStats {
  organizationId: number;
  organizationName: string;
  userCount: number;
  activeUserCount: number;
  caseCount: number;
  activeCaseCount: number;
  documentCount: number;
  storageUsedBytes: number;
  clientCount: number;
  planQuota: PlanQuota;
  userUsagePercent: number;
  caseUsagePercent: number;
  storageUsagePercent: number;
}

export interface PlanQuota {
  planType: PlanType;
  maxUsers: number;
  maxCases: number;
  maxStorageBytes: number;
  maxClients: number;
  hasApiAccess: boolean;
  hasAdvancedReporting: boolean;
  hasCustomBranding: boolean;
  hasPrioritySupport: boolean;
}

export interface OrganizationPage {
  organizations: Organization[];
  page: {
    number: number;
    size: number;
    totalElements: number;
    totalPages: number;
  };
}

export const PLAN_LABELS: Record<PlanType, string> = {
  FREE: 'Free',
  STARTER: 'Starter',
  PROFESSIONAL: 'Professional',
  ENTERPRISE: 'Enterprise'
};

export const PLAN_COLORS: Record<PlanType, string> = {
  FREE: 'secondary',
  STARTER: 'info',
  PROFESSIONAL: 'primary',
  ENTERPRISE: 'warning'
};

// Team member interface (user within organization)
export interface TeamMember {
  id: number;
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  imageUrl?: string;
  roleName?: string;
  enabled?: boolean;
  createdAt?: string;
  lastLogin?: string;
}

export interface TeamMemberPage {
  users: TeamMember[];
  page: {
    number: number;
    size: number;
    totalElements: number;
    totalPages: number;
  };
}

// Organization invitation interface
export interface OrganizationInvitation {
  id: number;
  organizationId: number;
  email: string;
  role: string;
  token?: string;
  expiresAt: string;
  acceptedAt?: string;
  createdBy: number;
  createdAt: string;
}

export type InvitationStatus = 'PENDING' | 'EXPIRED' | 'ACCEPTED';

export const ROLE_OPTIONS = [
  { value: 'USER', label: 'User', description: 'Standard access to organization features' },
  { value: 'MANAGER', label: 'Manager', description: 'Can manage team members and settings' },
  { value: 'ADMIN', label: 'Admin', description: 'Full access to all organization features' }
];
