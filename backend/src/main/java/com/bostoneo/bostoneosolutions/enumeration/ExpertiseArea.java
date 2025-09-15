package com.bostoneo.bostoneosolutions.enumeration;

public enum ExpertiseArea {
    CORPORATE_LAW("Corporate Law"),
    LITIGATION("Litigation"),
    REAL_ESTATE("Real Estate Law"),
    FAMILY_LAW("Family Law"),
    CRIMINAL_LAW("Criminal Law"),
    EMPLOYMENT_LAW("Employment Law"),
    INTELLECTUAL_PROPERTY("Intellectual Property"),
    TAX_LAW("Tax Law"),
    BANKRUPTCY("Bankruptcy Law"),
    IMMIGRATION_LAW("Immigration Law"),
    PERSONAL_INJURY("Personal Injury"),
    ENVIRONMENTAL_LAW("Environmental Law"),
    HEALTHCARE_LAW("Healthcare Law"),
    CONTRACT_LAW("Contract Law"),
    COMMERCIAL_LAW("Commercial Law"),
    ESTATE_PLANNING("Estate Planning"),
    MERGERS_AND_ACQUISITIONS("Mergers & Acquisitions"),
    SECURITIES_LAW("Securities Law"),
    ANTITRUST_LAW("Antitrust Law"),
    PRIVACY_LAW("Privacy Law"),
    OTHER("Other");
    
    // Legacy aliases for backward compatibility
    public static final ExpertiseArea CORPORATE = CORPORATE_LAW;
    public static final ExpertiseArea CRIMINAL = CRIMINAL_LAW;
    public static final ExpertiseArea FAMILY = FAMILY_LAW;
    public static final ExpertiseArea EMPLOYMENT = EMPLOYMENT_LAW;
    public static final ExpertiseArea TAX = TAX_LAW;
    public static final ExpertiseArea IMMIGRATION = IMMIGRATION_LAW;
    
    private final String displayName;
    
    ExpertiseArea(String displayName) {
        this.displayName = displayName;
    }
    
    public String getDisplayName() {
        return displayName;
    }
}