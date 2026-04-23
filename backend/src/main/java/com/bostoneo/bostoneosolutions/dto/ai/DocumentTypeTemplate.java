package com.bostoneo.bostoneosolutions.dto.ai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class DocumentTypeTemplate {
    // --- core fields (existing) ---
    private String type;              // e.g. "demand_letter"
    private List<String> aliases;     // e.g. ["demand"]
    private String displayName;       // e.g. "Demand Letter"
    private String category;          // "letter" | "pleading" | "motion" | "contract" | "discovery"
    private String citationLevel;     // "NONE" | "MINIMAL" | "MODERATE" | "COMPREHENSIVE"
    private String practiceArea;      // Optional slug ("pi", "family", etc.) — enables the 4-way registry cascade
    private String jurisdiction;      // Optional ISO-2 state code ("ma", "tx") — informational; filename already encodes it
    private String template;          // Full structural template text
    private String hints;             // Shorter fallback hints for prompt enhancer

    // --- §6.1 workflow / UX fields (optional) ---
    private List<String> subPractices;           // e.g. ["mva", "premises", "med_mal"]
    private String caseLifecyclePhase;           // e.g. "intake", "pleadings", "pre_suit_demand", "settlement"
    private Boolean deadlineSensitive;           // true → surface SOL/notice warnings in UI
    private Boolean jurisdictionRequired;        // true → user MUST specify state (no PA-generic fallback)
    private Map<String, Object> documentOptionsSchema; // JSON Schema for documentOptions contract
    private List<String> relatedTemplates;       // e.g. ["complaint_pi_ma", "answer_pi_ma"]

    // --- §6.1 provenance / attorney-review fields (required for legal-risk accountability) ---
    private String schemaVersion;                         // semver on the JSON schema itself
    private String templateVersion;                       // semver on the template prose
    private String lastVerified;                          // ISO date "YYYY-MM-DD"
    private String nextReviewDue;                         // ISO date "YYYY-MM-DD"
    private List<VerificationSource> verificationSources; // per-citation proof list
    private List<ReviewerEntry> reviewedBy;               // attorney sign-off entries
    private String approvalStatus;                        // "draft" | "attorney_reviewed" | "production_ready"
    private String disclaimer;                            // injected into system prompt + rendered doc footer
    private List<String> knownLimitations;                // surfaced to user before generation
}
