package com.bostoneo.bostoneosolutions.enumeration;

public enum CaseRoleType {
    LEAD_ATTORNEY("Lead Attorney"),
    SUPPORTING_ATTORNEY("Supporting Attorney"),
    CO_COUNSEL("Co-Counsel"),
    ASSOCIATE("Associate"),
    PARALEGAL("Paralegal"),
    LEGAL_ASSISTANT("Legal Assistant"),
    SECRETARY("Secretary"),
    CONSULTANT("Consultant"),
    INTERN("Intern");
    
    private final String displayName;
    
    CaseRoleType(String displayName) {
        this.displayName = displayName;
    }
    
    public String getDisplayName() {
        return displayName;
    }
}