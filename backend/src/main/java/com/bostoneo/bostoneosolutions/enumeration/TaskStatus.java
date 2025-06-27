package com.***REMOVED***.***REMOVED***solutions.enumeration;

public enum TaskStatus {
    TODO("To Do"),
    IN_PROGRESS("In Progress"),
    REVIEW("Review"),
    BLOCKED("Blocked"),
    COMPLETED("Completed"),
    CANCELLED("Cancelled");
    
    private final String displayName;
    
    TaskStatus(String displayName) {
        this.displayName = displayName;
    }
    
    public String getDisplayName() {
        return displayName;
    }
    
    public boolean isActive() {
        return this != COMPLETED && this != CANCELLED;
    }
    
    public boolean isTerminal() {
        return this == COMPLETED || this == CANCELLED;
    }
}