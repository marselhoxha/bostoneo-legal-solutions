package com.bostoneo.bostoneosolutions.enumeration;

public enum DocumentContextType {
    STANDALONE("Standalone Document - No case or client required"),
    CLIENT("Client Document - Uses client data without specific case"),
    CASE("Case Document - Uses specific case and client data"),
    MULTI_CASE("Multi-Matter Document - Spans multiple cases"),
    EXTERNAL("External Data - Import from other sources");

    private final String description;

    DocumentContextType(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}