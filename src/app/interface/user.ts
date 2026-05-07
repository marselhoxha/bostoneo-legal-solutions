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
      // V63 — per-user opt-in for the new attorney-facing PI view (P4+).
      // Drives FeatureFlagService.isAttorneyFacingPiViewEnabled() OR'd with env flag.
      betaAttorneyView?: boolean;
      // Phase 6 — practice-area-aware dashboard. Backend `/user/profile`
      // populates these so the dashboard can intersect the attorney's areas
      // with the org's enabled set and render the right tabs/outlet. Both are
      // CSV strings: "PERSONAL_INJURY,FAMILY_LAW". When undefined (e.g., user
      // has no attorney row, or org has no enabled set yet), the dashboard
      // falls back to zero practice areas and the tabs+outlet row is hidden.
      enabledPracticeAreas?: string;     // org-level
      attorneyPracticeAreas?: string;    // user-level (this attorney's assignments)
}
