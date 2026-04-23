package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.model.Organization;
import com.bostoneo.bostoneosolutions.repository.OrganizationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Set;

/**
 * Resolves jurisdiction/state context for AI prompts and document generation.
 * Eliminates hardcoded Massachusetts references by providing dynamic state-aware values.
 */
@Service
@RequiredArgsConstructor
public class JurisdictionResolver {

    private final OrganizationRepository organizationRepository;

    private static final String DEFAULT_STATE_CODE = "MA";
    private static final String DEFAULT_STATE_NAME = "Massachusetts";

    // States that use "COMMONWEALTH" instead of "STATE" in court headers
    private static final Set<String> COMMONWEALTH_STATES = Set.of("MA", "PA", "VA", "KY");

    private static final Map<String, String> STATE_CODE_TO_NAME = Map.ofEntries(
            Map.entry("AL", "Alabama"), Map.entry("AK", "Alaska"), Map.entry("AZ", "Arizona"),
            Map.entry("AR", "Arkansas"), Map.entry("CA", "California"), Map.entry("CO", "Colorado"),
            Map.entry("CT", "Connecticut"), Map.entry("DE", "Delaware"), Map.entry("FL", "Florida"),
            Map.entry("GA", "Georgia"), Map.entry("HI", "Hawaii"), Map.entry("ID", "Idaho"),
            Map.entry("IL", "Illinois"), Map.entry("IN", "Indiana"), Map.entry("IA", "Iowa"),
            Map.entry("KS", "Kansas"), Map.entry("KY", "Kentucky"), Map.entry("LA", "Louisiana"),
            Map.entry("ME", "Maine"), Map.entry("MD", "Maryland"), Map.entry("MA", "Massachusetts"),
            Map.entry("MI", "Michigan"), Map.entry("MN", "Minnesota"), Map.entry("MS", "Mississippi"),
            Map.entry("MO", "Missouri"), Map.entry("MT", "Montana"), Map.entry("NE", "Nebraska"),
            Map.entry("NV", "Nevada"), Map.entry("NH", "New Hampshire"), Map.entry("NJ", "New Jersey"),
            Map.entry("NM", "New Mexico"), Map.entry("NY", "New York"), Map.entry("NC", "North Carolina"),
            Map.entry("ND", "North Dakota"), Map.entry("OH", "Ohio"), Map.entry("OK", "Oklahoma"),
            Map.entry("OR", "Oregon"), Map.entry("PA", "Pennsylvania"), Map.entry("RI", "Rhode Island"),
            Map.entry("SC", "South Carolina"), Map.entry("SD", "South Dakota"), Map.entry("TN", "Tennessee"),
            Map.entry("TX", "Texas"), Map.entry("UT", "Utah"), Map.entry("VT", "Vermont"),
            Map.entry("VA", "Virginia"), Map.entry("WA", "Washington"), Map.entry("WV", "West Virginia"),
            Map.entry("WI", "Wisconsin"), Map.entry("WY", "Wyoming"), Map.entry("DC", "District of Columbia"),
            Map.entry("US", "Federal")
    );

    /**
     * Resolve the full state name from an organization's state code.
     * Falls back to "Massachusetts" if the org has no state set.
     */
    public String resolveStateName(Long organizationId) {
        if (organizationId == null) return DEFAULT_STATE_NAME;
        return organizationRepository.findById(organizationId)
                .map(Organization::getState)
                .map(this::getStateName)
                .orElse(DEFAULT_STATE_NAME);
    }

    /**
     * Resolve the 2-letter state code from an organization.
     * Falls back to "MA" if the org has no state set.
     */
    public String resolveStateCode(Long organizationId) {
        if (organizationId == null) return DEFAULT_STATE_CODE;
        return organizationRepository.findById(organizationId)
                .map(Organization::getState)
                .filter(s -> s != null && !s.isBlank())
                .orElse(DEFAULT_STATE_CODE);
    }

    /**
     * Get the court label prefix for a state: "COMMONWEALTH" for MA/PA/VA/KY, "STATE" for all others.
     * Example: "COMMONWEALTH OF MASSACHUSETTS" vs "STATE OF TEXAS"
     */
    public String getCourtLabel(String stateCode) {
        String code = (stateCode != null && !stateCode.isBlank()) ? stateCode.toUpperCase() : DEFAULT_STATE_CODE;
        if ("US".equals(code)) {
            return "UNITED STATES OF AMERICA";
        }
        String label = COMMONWEALTH_STATES.contains(code) ? "COMMONWEALTH" : "STATE";
        return label + " OF " + getStateName(code).toUpperCase();
    }

    /**
     * Get the court label for an organization.
     */
    public String getCourtLabelForOrg(Long organizationId) {
        return getCourtLabel(resolveStateCode(organizationId));
    }

    /**
     * Convert a 2-letter state code to a full state name.
     * Returns the code itself if not found (graceful fallback).
     */
    public String getStateName(String code) {
        if (code == null || code.isBlank()) return DEFAULT_STATE_NAME;
        return STATE_CODE_TO_NAME.getOrDefault(code.toUpperCase(), code);
    }

    /**
     * Convert a full state name to a 2-letter state code.
     * Returns null if not found.
     */
    public String getStateCode(String name) {
        if (name == null || name.isBlank()) return null;
        String normalized = name.trim();
        return STATE_CODE_TO_NAME.entrySet().stream()
                .filter(e -> e.getValue().equalsIgnoreCase(normalized))
                .map(Map.Entry::getKey)
                .findFirst()
                .orElse(null);
    }
}
