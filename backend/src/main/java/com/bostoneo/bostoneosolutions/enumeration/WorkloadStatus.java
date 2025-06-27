package com.***REMOVED***.***REMOVED***solutions.enumeration;

public enum WorkloadStatus {
    LOW("Low workload", "0-40%"),
    MEDIUM("Medium workload", "40-70%"),
    HIGH("High workload", "70-85%"),
    OVERLOADED("Overloaded", "85%+");
    
    private final String displayName;
    private final String range;
    
    WorkloadStatus(String displayName, String range) {
        this.displayName = displayName;
        this.range = range;
    }
    
    public String getDisplayName() {
        return displayName;
    }
    
    public String getRange() {
        return range;
    }
}