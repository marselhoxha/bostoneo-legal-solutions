package com.bostoneo.bostoneosolutions.enumeration;

/**
 * Simplified role types for the application.
 * Reduced from 22 roles to 6 core roles.
 *
 * Seniority within roles (e.g., Partner vs Associate) is now handled
 * via user fields: title, seniority_level, can_approve
 */
public enum RoleType {
    ROLE_ADMIN("Administrator", 100),
    ROLE_ATTORNEY("Attorney", 70),
    ROLE_FINANCE("Finance", 65),
    PARALEGAL("Paralegal", 40),
    ROLE_SECRETARY("Secretary", 20),
    ROLE_USER("User", 10);

    private final String displayName;
    private final int hierarchyLevel;

    RoleType(String displayName, int hierarchyLevel) {
        this.displayName = displayName;
        this.hierarchyLevel = hierarchyLevel;
    }

    public String getDisplayName() {
        return displayName;
    }

    public int getHierarchyLevel() {
        return hierarchyLevel;
    }

    /**
     * Check if this role has higher or equal hierarchy than another role
     */
    public boolean hasAuthorityOver(RoleType other) {
        return this.hierarchyLevel >= other.hierarchyLevel;
    }

    /**
     * Check if this role is an admin-level role (hierarchy >= 100)
     */
    public boolean isAdmin() {
        return this.hierarchyLevel >= 100;
    }

    /**
     * Check if this role is a legal professional (Attorney or above)
     */
    public boolean isLegalProfessional() {
        return this == ROLE_ATTORNEY || this == ROLE_ADMIN;
    }

    /**
     * Check if this role can approve documents/time entries
     */
    public boolean canApprove() {
        return this.hierarchyLevel >= 65; // FINANCE and above
    }
}
