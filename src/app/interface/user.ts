export interface User {
      id: number;
      firstName: string;
      lastName: string;
      email: string;
      address?: string;
      phone?: string;
      title?: string;
      bio?: string;
      imageUrl?: string;
      enabled: boolean;
      notLocked: boolean;
      usingMFA: boolean;
      forcePasswordChange?: boolean;
      createdAt?: Date;
      termsAcceptedAt?: string | null;
      organizationName?: string;
      organizationFirmType?: string;
      roleName: string;
      primaryRoleName?: string;
      roles?: string[];
      permissions: string;
}
