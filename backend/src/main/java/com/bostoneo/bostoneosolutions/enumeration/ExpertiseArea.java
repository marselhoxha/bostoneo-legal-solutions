package com.***REMOVED***.***REMOVED***solutions.enumeration;

public enum ExpertiseArea {
    CORPORATE("Corporate Law"),
    CRIMINAL("Criminal Law"),
    FAMILY("Family Law"),
    INTELLECTUAL_PROPERTY("Intellectual Property"),
    REAL_ESTATE("Real Estate Law"),
    TAX("Tax Law"),
    IMMIGRATION("Immigration Law"),
    EMPLOYMENT("Employment Law"),
    PERSONAL_INJURY("Personal Injury"),
    OTHER("Other");
    
    private final String displayName;
    
    ExpertiseArea(String displayName) {
        this.displayName = displayName;
    }
    
    public String getDisplayName() {
        return displayName;
    }
}