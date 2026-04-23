package com.bostoneo.bostoneosolutions.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * Per-jurisdiction citation pack loaded from classpath:templates/jurisdictions/*.json.
 * Injected into the AI system prompt when the jurisdiction is known, so the AI cites
 * the correct state's rules and statutes instead of defaulting to Massachusetts.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class JurisdictionPack {
    private String name;                      // "Massachusetts", "Federal"
    private String stateCode;                 // "ma", "federal"
    private String civilRules;                // "Mass. R. Civ. P."
    private String criminalRules;             // "Mass. R. Crim. P."
    private String evidenceRules;             // "Mass. G. Evid."
    private String reporterAbbrev;            // "Mass."
    private Map<String, String> commonCitations;  // "insurance_policy_limits" -> "M.G.L. c. 175, § 112C"
}
