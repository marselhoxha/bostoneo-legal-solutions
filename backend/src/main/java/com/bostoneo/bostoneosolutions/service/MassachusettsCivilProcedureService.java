package com.bostoneo.bostoneosolutions.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import java.util.*;

/**
 * Service providing structured Massachusetts civil procedure knowledge and guidance.
 * This supplements dynamic searches with authoritative Massachusetts court procedure information.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MassachusettsCivilProcedureService {

    /**
     * Core Massachusetts civil procedure rules with accurate citations, requirements, and guidance
     */
    private static final Map<String, CivilProcedureRule> CIVIL_PROCEDURE_RULES = Map.of(
        "12(b)(6)", new CivilProcedureRule(
            "Motion to Dismiss for Failure to State a Claim",
            "Mass. R. Civ. P. 12(b)(6)",
            "Tests whether the complaint states a claim upon which relief can be granted",
            "30 days after service of process (if served in Massachusetts) or 45 days (if served outside Massachusetts)",
            "Superior Court, District Court, or other appropriate Massachusetts court",
            "Mass. R. Civ. P. 12(b), Mass. R. Civ. P. 6",
            "Does not stay discovery or other proceedings unless specifically ordered by the court",
            List.of(
                "Standard: Whether the complaint contains factual allegations that plausibly suggest an entitlement to relief",
                "Court must accept all well-pleaded facts as true and draw inferences in plaintiff's favor",
                "Plausibility standard from Twombly/Iqbal applies in Massachusetts state courts",
                "Can be combined with other Rule 12(b) defenses in a single motion",
                "If denied, defendant must answer within 30 days of the order",
                "Must be filed before or with the answer - cannot be raised later except in limited circumstances"
            )
        ),
        "12(b)(2)", new CivilProcedureRule(
            "Motion to Dismiss for Lack of Personal Jurisdiction",
            "Mass. R. Civ. P. 12(b)(2)",
            "Challenges the court's authority over the defendant's person",
            "30 days after service (45 days if served outside Massachusetts)",
            "Court where the action is pending",
            "Mass. R. Civ. P. 12(b), G.L. c. 223A (long-arm statute)",
            "No automatic stay",
            List.of(
                "Must be raised by motion before or with answer, or it's waived",
                "Massachusetts long-arm statute G.L. c. 223A governs jurisdiction",
                "Burden on plaintiff to prove jurisdiction by preponderance",
                "Consider minimum contacts and fair play/substantial justice",
                "Can be combined with other Rule 12(b) defenses"
            )
        ),
        "56", new CivilProcedureRule(
            "Motion for Summary Judgment",
            "Mass. R. Civ. P. 56",
            "Seeks judgment when there are no genuine issues of material fact",
            "No specific deadline, but subject to case management deadlines",
            "Court where the action is pending",
            "Mass. R. Civ. P. 56",
            "No automatic stay",
            List.of(
                "Standard: No genuine issue of material fact and moving party entitled to judgment as matter of law",
                "Must file supporting affidavits/evidence with motion",
                "Opponent has 30 days to respond with counter-affidavits",
                "Court views evidence in light most favorable to non-moving party",
                "Can be partial (on some claims/issues) or complete",
                "Local rules may require pre-filing conference"
            )
        ),
        "11", new CivilProcedureRule(
            "Signing of Pleadings and Sanctions",
            "Mass. R. Civ. P. 11",
            "Governs attorney certification and sanctions for frivolous filings",
            "N/A - applies to all filings",
            "All Massachusetts courts",
            "Mass. R. Civ. P. 11",
            "N/A",
            List.of(
                "Attorney signature certifies good faith belief in legal/factual basis",
                "Sanctions available for frivolous pleadings or bad faith litigation",
                "21-day safe harbor provision for violations",
                "Sanctions should be sufficient to deter repetition",
                "Can include attorney fees, costs, or other appropriate sanctions"
            )
        )
    );

    /**
     * Massachusetts court-specific filing requirements
     */
    private static final Map<String, CourtFilingInfo> COURT_FILING_REQUIREMENTS = Map.of(
        "SUPERIOR", new CourtFilingInfo(
            "Massachusetts Superior Court",
            "Civil actions over $25,000, equity cases, complex litigation",
            Map.of(
                "Filing fee", "$220 (as of 2024)",
                "Service deadline", "90 days after filing",
                "Answer deadline", "30 days (in state) or 45 days (out of state)",
                "Discovery deadline", "Set by case management order"
            ),
            "https://www.mass.gov/orgs/superior-court"
        ),
        "DISTRICT", new CourtFilingInfo(
            "Massachusetts District Court",
            "Civil actions up to $25,000",
            Map.of(
                "Filing fee", "$120 (as of 2024)",
                "Service deadline", "90 days after filing",
                "Answer deadline", "30 days (in state) or 45 days (out of state)",
                "Small claims limit", "$7,000"
            ),
            "https://www.mass.gov/orgs/district-court"
        ),
        "HOUSING", new CourtFilingInfo(
            "Massachusetts Housing Court",
            "Landlord-tenant, housing code violations, property-related disputes",
            Map.of(
                "Filing fee", "Varies by case type",
                "Summary process", "14-day notice required",
                "Answer deadline", "Varies by case type",
                "Jurisdiction", "Housing-related matters statewide"
            ),
            "https://www.mass.gov/orgs/housing-court"
        )
    );

    /**
     * Get structured guidance for Massachusetts civil procedure
     */
    public Map<String, Object> getStructuredCivilProcedureGuidance(String query) {
        log.info("Generating structured Massachusetts civil procedure guidance for: {}", query);

        Map<String, Object> guidance = new HashMap<>();
        String queryLower = query.toLowerCase();

        // Determine rule type
        String ruleKey = determineRuleKey(queryLower);
        CivilProcedureRule rule = CIVIL_PROCEDURE_RULES.get(ruleKey);

        if (rule != null) {
            guidance.put("rule", rule.toMap());
            guidance.put("quickAnswer", generateQuickAnswer(rule));
        }

        // Add relevant court information
        String courtType = determineCourtType(queryLower);
        CourtFilingInfo courtInfo = COURT_FILING_REQUIREMENTS.get(courtType);
        if (courtInfo != null) {
            guidance.put("courtInfo", courtInfo.toMap());
        }

        // Add procedural guidance
        guidance.put("proceduralGuidance", Map.of(
            "summary", "Massachusetts Rules of Civil Procedure govern state court practice",
            "keyDeadlines", Map.of(
                "Answer", "30 days (in state) or 45 days (out of state) after service",
                "Rule 12 motions", "Must be filed before or with answer",
                "Discovery", "Governed by case management order",
                "Summary judgment", "No specific deadline, subject to case schedule"
            ),
            "filingRequirements", Map.of(
                "Format", "Typed or clearly printed on 8.5 x 11 inch paper",
                "Signature", "Attorney or pro se party must sign",
                "Service", "Must serve all parties",
                "Certificate", "Certificate of service required"
            )
        ));

        // Add decision tree
        guidance.put("decisionTree", generateDecisionTree());

        // Add practice tips
        guidance.put("practiceTips", List.of(
            "Check local court rules - they may have additional requirements",
            "Superior Court has case management conferences - attend prepared",
            "District Court may have different scheduling than Superior Court",
            "Consider whether federal court jurisdiction might be available",
            "Rule 12(b) defenses must be raised early or they may be waived",
            "Discovery stays are rare in Massachusetts - motions usually don't stop discovery"
        ));

        // Add common pitfalls
        guidance.put("commonPitfalls", List.of(
            "Missing the 30/45 day deadline to file Rule 12 motions",
            "Failing to combine Rule 12(b) defenses in one motion",
            "Not checking local court rules for additional requirements",
            "Assuming federal standards always apply in state court",
            "Forgetting to serve opposing counsel when filing motions",
            "Missing case management deadlines in Superior Court"
        ));

        return guidance;
    }

    private String determineRuleKey(String query) {
        if (query.contains("12(b)(6)") || query.contains("12b6") ||
            (query.contains("motion to dismiss") && query.contains("claim"))) {
            return "12(b)(6)";
        } else if (query.contains("12(b)(2)") || query.contains("12b2") ||
                  (query.contains("personal jurisdiction") || query.contains("jurisdiction"))) {
            return "12(b)(2)";
        } else if (query.contains("rule 56") || query.contains("summary judgment")) {
            return "56";
        } else if (query.contains("rule 11") || query.contains("sanctions")) {
            return "11";
        }
        return "12(b)(6)"; // Default for motion practice
    }

    private String determineCourtType(String query) {
        if (query.contains("superior court") || query.contains("superior")) {
            return "SUPERIOR";
        } else if (query.contains("district court") || query.contains("district")) {
            return "DISTRICT";
        } else if (query.contains("housing court") || query.contains("housing")) {
            return "HOUSING";
        }
        return "SUPERIOR"; // Default
    }

    private String generateQuickAnswer(CivilProcedureRule rule) {
        return String.format("File %s in %s within %s. Citation: %s",
            rule.formOrMotion,
            rule.filedWith,
            rule.deadline,
            rule.citation
        );
    }

    private Map<String, String> generateDecisionTree() {
        return Map.of(
            "Want to dismiss for procedural defect?", "→ Rule 12(b) motion (various grounds)",
            "Challenge personal jurisdiction?", "→ Rule 12(b)(2) motion",
            "Complaint doesn't state valid claim?", "→ Rule 12(b)(6) motion to dismiss",
            "No factual dispute, entitled to judgment?", "→ Rule 56 summary judgment motion",
            "Opposing party filing frivolous claims?", "→ Rule 11 sanctions motion",
            "Under $25,000 claim?", "→ Consider District Court jurisdiction",
            "Over $25,000 or complex case?", "→ Superior Court jurisdiction"
        );
    }

    /**
     * Data classes for structured Massachusetts civil procedure information
     */
    static class CivilProcedureRule {
        final String name;
        final String citation;
        final String purpose;
        final String deadline;
        final String filedWith;
        final String governingLaw;
        final String stayEffect;
        final List<String> keyPoints;
        final String formOrMotion;

        CivilProcedureRule(String name, String citation, String purpose, String deadline,
                          String filedWith, String governingLaw, String stayEffect, List<String> keyPoints) {
            this.name = name;
            this.citation = citation;
            this.purpose = purpose;
            this.deadline = deadline;
            this.filedWith = filedWith;
            this.governingLaw = governingLaw;
            this.stayEffect = stayEffect;
            this.keyPoints = keyPoints;
            this.formOrMotion = "Motion";
        }

        Map<String, Object> toMap() {
            Map<String, Object> map = new HashMap<>();
            map.put("name", name);
            map.put("citation", citation);
            map.put("purpose", purpose);
            map.put("deadline", deadline);
            map.put("filedWith", filedWith);
            map.put("governingLaw", governingLaw);
            map.put("stayEffect", stayEffect);
            map.put("keyPoints", keyPoints);
            return map;
        }
    }

    static class CourtFilingInfo {
        final String name;
        final String jurisdiction;
        final Map<String, String> filingRequirements;
        final String website;

        CourtFilingInfo(String name, String jurisdiction, Map<String, String> filingRequirements, String website) {
            this.name = name;
            this.jurisdiction = jurisdiction;
            this.filingRequirements = filingRequirements;
            this.website = website;
        }

        Map<String, Object> toMap() {
            Map<String, Object> map = new HashMap<>();
            map.put("name", name);
            map.put("jurisdiction", jurisdiction);
            map.put("filingRequirements", filingRequirements);
            map.put("website", website);
            return map;
        }
    }
}