package com.***REMOVED***.***REMOVED***solutions.enumeration;

public enum TransferUrgency {
    LOW("Low", 1),
    MEDIUM("Medium", 2),
    HIGH("High", 3),
    URGENT("Urgent", 4);
    
    private final String displayName;
    private final int level;
    
    TransferUrgency(String displayName, int level) {
        this.displayName = displayName;
        this.level = level;
    }
    
    public String getDisplayName() {
        return displayName;
    }
    
    public int getLevel() {
        return level;
    }
}