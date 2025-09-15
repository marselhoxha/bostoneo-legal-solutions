package com.bostoneo.bostoneosolutions.enumeration;

public enum RuleType {
    EXPERTISE_BASED("Expertise Based"),
    WORKLOAD_BASED("Workload Based"),
    ROUND_ROBIN("Round Robin"),
    CUSTOM("Custom");
    
    private final String displayName;
    
    RuleType(String displayName) {
        this.displayName = displayName;
    }
    
    public String getDisplayName() {
        return displayName;
    }
}