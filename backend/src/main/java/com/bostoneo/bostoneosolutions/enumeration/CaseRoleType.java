package com.***REMOVED***.***REMOVED***solutions.enumeration;

public enum CaseRoleType {
    LEAD_ATTORNEY("Lead Attorney"),
    SUPPORTING_ATTORNEY("Supporting Attorney"),
    PARALEGAL("Paralegal"),
    SECRETARY("Secretary");
    
    private final String displayName;
    
    CaseRoleType(String displayName) {
        this.displayName = displayName;
    }
    
    public String getDisplayName() {
        return displayName;
    }
}