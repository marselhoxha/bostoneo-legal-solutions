package com.bostoneo.bostoneosolutions.enumeration;

public enum TaskType {
    RESEARCH("Research"),
    DOCUMENT_PREP("Document Preparation"),
    CLIENT_MEETING("Client Meeting"),
    COURT_APPEARANCE("Court Appearance"),
    FILING("Filing"),
    REVIEW("Review"),
    CORRESPONDENCE("Correspondence"),
    OTHER("Other");
    
    private final String displayName;
    
    TaskType(String displayName) {
        this.displayName = displayName;
    }
    
    public String getDisplayName() {
        return displayName;
    }
}