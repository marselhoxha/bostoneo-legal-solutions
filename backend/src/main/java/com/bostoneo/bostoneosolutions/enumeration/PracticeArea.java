package com.bostoneo.bostoneosolutions.enumeration;

import java.util.Arrays;
import java.util.Optional;

public enum PracticeArea {
    PERSONAL_INJURY("pi", "Personal Injury"),
    FAMILY_LAW("family", "Family Law"),
    CRIMINAL_DEFENSE("criminal", "Criminal Defense"),
    IMMIGRATION("immigration", "Immigration"),
    CIVIL_LITIGATION("civil", "Civil Litigation"),
    CONTRACT_LAW("contract", "Contract Law"),
    BUSINESS_LAW("business", "Business Law"),
    EMPLOYMENT_LAW("employment", "Employment Law"),
    REAL_ESTATE("real_estate", "Real Estate"),
    INTELLECTUAL_PROPERTY("ip", "Intellectual Property"),
    ESTATE_PLANNING("estate", "Estate Planning"),
    BANKRUPTCY("bankruptcy", "Bankruptcy"),
    TAX_LAW("tax", "Tax Law"),
    ENVIRONMENTAL_LAW("environmental", "Environmental Law"),
    CLASS_ACTION("class_action", "Class Action"),
    OTHER("other", "Other");

    private final String slug;
    private final String displayName;

    PracticeArea(String slug, String displayName) {
        this.slug = slug;
        this.displayName = displayName;
    }

    public String slug() {
        return slug;
    }

    public String displayName() {
        return displayName;
    }

    /**
     * Resolve a PracticeArea from a slug, display name, or legacy free-text value.
     * Returns empty if nothing matches — callers decide whether to fall back to OTHER.
     */
    public static Optional<PracticeArea> fromString(String value) {
        if (value == null || value.isBlank()) return Optional.empty();
        String normalized = value.trim().toLowerCase().replace('-', '_').replace(' ', '_');
        return Arrays.stream(values())
                .filter(pa -> pa.slug.equalsIgnoreCase(normalized)
                        || pa.name().equalsIgnoreCase(normalized)
                        || pa.displayName.equalsIgnoreCase(value.trim()))
                .findFirst();
    }

    /**
     * Resolve a slug directly from arbitrary input, returning null when nothing matches.
     * Useful when building registry lookup keys where "missing" is a valid state (skip
     * the practice-area cascade branch).
     */
    public static String slugOrNull(String value) {
        return fromString(value).map(PracticeArea::slug).orElse(null);
    }
}
