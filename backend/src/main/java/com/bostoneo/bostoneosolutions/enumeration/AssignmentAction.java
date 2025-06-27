package com.***REMOVED***.***REMOVED***solutions.enumeration;

public enum AssignmentAction {
    CREATED("Created"),
    TRANSFERRED("Transferred"),
    MODIFIED("Modified"),
    DEACTIVATED("Deactivated");
    
    private final String displayName;
    
    AssignmentAction(String displayName) {
        this.displayName = displayName;
    }
    
    public String getDisplayName() {
        return displayName;
    }
}