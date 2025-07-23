package com.***REMOVED***.***REMOVED***solutions.enumeration;

public enum AssignmentType {
    MANUAL("Manual Assignment"),
    AUTO_ASSIGNED("Auto-Assigned"),
    TRANSFERRED("Transferred"),
    TEMPORARY("Temporary"),
    EMERGENCY("Emergency"),
    DELEGATED("Delegated");
    
    private final String displayName;
    
    AssignmentType(String displayName) {
        this.displayName = displayName;
    }
    
    public String getDisplayName() {
        return displayName;
    }
}