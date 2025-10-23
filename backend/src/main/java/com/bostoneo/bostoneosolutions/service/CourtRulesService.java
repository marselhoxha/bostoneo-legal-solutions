package com.bostoneo.bostoneosolutions.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Pattern;

/**
 * Service that provides court-specific rules and standing orders
 * Purpose: Inject jurisdiction-specific procedural requirements into AI prompts
 */
@Service
@Slf4j
public class CourtRulesService {

    // Pre-indexed court rules database
    private static final Map<String, CourtRulesContext> COURT_RULES_DATABASE = new LinkedHashMap<>();

    static {
        // ===== BOSTON MUNICIPAL COURT =====
        CourtRulesContext bmcRules = new CourtRulesContext(
            "Boston Municipal Court",
            Arrays.asList(
                "BMC Standing Order 1-04: Pretrial motions in criminal cases must be filed 21 days before pretrial conference",
                "BMC Standing Order 2-10: Discovery motions in criminal cases - opposition due 7 days after filing",
                "BMC Local Rule 3: Memoranda in support of motions limited to 15 pages unless prior approval",
                "Mass. R. Crim. P. 13(a)(2): Motions to suppress must be filed before trial",
                "Mass. R. Crim. P. 14: Discovery in criminal cases"
            ),
            Map.of(
                "BMC Standing Order 1-04", "https://www.mass.gov/guides/massachusetts-rules-of-court-and-standing-orders",
                "BMC Standing Order 2-10", "https://www.mass.gov/guides/massachusetts-rules-of-court-and-standing-orders",
                "BMC Local Rule 3", "https://www.mass.gov/guides/massachusetts-rules-of-court-and-standing-orders",
                "Mass. R. Crim. P. 13(a)(2)", "https://www.mass.gov/supreme-judicial-court-rules/rules-of-criminal-procedure",
                "Mass. R. Crim. P. 14", "https://www.mass.gov/supreme-judicial-court-rules/rules-of-criminal-procedure"
            )
        );
        COURT_RULES_DATABASE.put("boston municipal court", bmcRules);
        COURT_RULES_DATABASE.put("bmc", bmcRules);

        // ===== SUPERIOR COURT BUSINESS LITIGATION SESSION (BLS) =====
        CourtRulesContext blsRules = new CourtRulesContext(
            "Superior Court Business Litigation Session",
            Arrays.asList(
                "BLS Standing Order 1-15: Summary judgment motions must be filed 30+ days before trial with 20-page memorandum limit",
                "BLS Standing Order 1-15: Opposition memorandum limited to 20 pages, due 14 days after motion filing",
                "Mass. R. Civ. P. 56: Summary judgment standards and procedures",
                "Mass. R. Civ. P. 9A: Summary judgment service and assembly requirements",
                "Mass. R. Civ. P. 5: Service of pleadings and papers"
            ),
            Map.of(
                "BLS Standing Order 1-15", "https://www.mass.gov/guides/massachusetts-rules-of-court-and-standing-orders",
                "Mass. R. Civ. P. 56", "https://www.mass.gov/supreme-judicial-court-rules/rules-of-civil-procedure",
                "Mass. R. Civ. P. 9A", "https://www.mass.gov/supreme-judicial-court-rules/rules-of-civil-procedure",
                "Mass. R. Civ. P. 5", "https://www.mass.gov/supreme-judicial-court-rules/rules-of-civil-procedure"
            )
        );
        COURT_RULES_DATABASE.put("business litigation session", blsRules);
        COURT_RULES_DATABASE.put("bls", blsRules);
        COURT_RULES_DATABASE.put("superior court business litigation", blsRules);

        // ===== MASSACHUSETTS SUPERIOR COURT (General) =====
        CourtRulesContext superiorRules = new CourtRulesContext(
            "Massachusetts Superior Court",
            Arrays.asList(
                "Mass. R. Civ. P. 56: Summary judgment - motion must be filed with sufficient time before trial",
                "Mass. R. Civ. P. 26-37: Discovery rules and timelines",
                "Superior Court Standing Order 1-04: Case management and scheduling",
                "Superior Court Standing Order 2-86: Alternative Dispute Resolution procedures",
                "Mass. R. Civ. P. 16: Pretrial conferences and case management"
            ),
            Map.of(
                "Mass. R. Civ. P. 56", "https://www.mass.gov/supreme-judicial-court-rules/rules-of-civil-procedure",
                "Mass. R. Civ. P. 26-37", "https://www.mass.gov/supreme-judicial-court-rules/rules-of-civil-procedure",
                "Superior Court Standing Order 1-04", "https://www.mass.gov/guides/massachusetts-rules-of-court-and-standing-orders",
                "Superior Court Standing Order 2-86", "https://www.mass.gov/guides/massachusetts-rules-of-court-and-standing-orders",
                "Mass. R. Civ. P. 16", "https://www.mass.gov/supreme-judicial-court-rules/rules-of-civil-procedure"
            )
        );
        COURT_RULES_DATABASE.put("superior court", superiorRules);
        COURT_RULES_DATABASE.put("massachusetts superior court", superiorRules);

        // ===== FEDERAL DISTRICT OF MASSACHUSETTS =====
        CourtRulesContext dMassRules = new CourtRulesContext(
            "U.S. District Court for the District of Massachusetts",
            Arrays.asList(
                "D. Mass. Local Rule 7.1: Motion practice - supporting memorandum required, page limits apply",
                "D. Mass. Local Rule 7.1(b)(1): Opposition due 14 days after service of motion",
                "D. Mass. Local Rule 7.1(b)(2): Reply memorandum due 7 days after opposition",
                "D. Mass. Local Rule 116.2: Criminal pretrial motions must be filed 21 days before hearing",
                "D. Mass. Local Rule 5.4: Electronic filing (CM/ECF) required for all documents",
                "Fed. R. Civ. P. 56: Federal summary judgment standards",
                "Fed. R. Crim. P. 12: Pretrial motions in criminal cases",
                "Fed. R. Crim. P. 16: Discovery in criminal cases"
            ),
            Map.of(
                "D. Mass. Local Rule 7.1", "https://www.mad.uscourts.gov/general/pdf/LocalRules.pdf",
                "D. Mass. Local Rule 116.2", "https://www.mad.uscourts.gov/general/pdf/LocalRules.pdf",
                "D. Mass. Local Rule 5.4", "https://www.mad.uscourts.gov/general/pdf/LocalRules.pdf",
                "Fed. R. Civ. P. 56", "https://www.law.cornell.edu/rules/frcp/rule_56",
                "Fed. R. Crim. P. 12", "https://www.law.cornell.edu/rules/frcrmp/rule_12",
                "Fed. R. Crim. P. 16", "https://www.law.cornell.edu/rules/frcrmp/rule_16"
            )
        );
        COURT_RULES_DATABASE.put("district of massachusetts", dMassRules);
        COURT_RULES_DATABASE.put("d. mass", dMassRules);
        COURT_RULES_DATABASE.put("u.s. district court", dMassRules);
        COURT_RULES_DATABASE.put("federal district court", dMassRules);
    }

    /**
     * Detects court from case details and returns applicable rules
     */
    public CourtRulesContext getApplicableRules(String caseDetails) {
        if (caseDetails == null || caseDetails.isBlank()) {
            return null;
        }

        String lowerCaseDetails = caseDetails.toLowerCase();

        // Check each court pattern
        for (Map.Entry<String, CourtRulesContext> entry : COURT_RULES_DATABASE.entrySet()) {
            String courtPattern = entry.getKey();

            // Use word boundary matching to avoid false positives
            String regex = "\\b" + Pattern.quote(courtPattern) + "\\b";
            if (Pattern.compile(regex, Pattern.CASE_INSENSITIVE).matcher(lowerCaseDetails).find()) {
                CourtRulesContext rules = entry.getValue();
                log.info("📋 Detected court: {} - providing {} applicable rules",
                    rules.getCourtName(), rules.getApplicableRules().size());
                return rules;
            }
        }

        log.debug("No specific court rules detected in case details");
        return null;
    }

    /**
     * Context object containing court-specific rules and links
     */
    public static class CourtRulesContext {
        private final String courtName;
        private final List<String> applicableRules;
        private final Map<String, String> ruleLinks;

        public CourtRulesContext(String courtName, List<String> applicableRules, Map<String, String> ruleLinks) {
            this.courtName = courtName;
            this.applicableRules = applicableRules;
            this.ruleLinks = ruleLinks;
        }

        public String getCourtName() {
            return courtName;
        }

        public List<String> getApplicableRules() {
            return applicableRules;
        }

        public Map<String, String> getRuleLinks() {
            return ruleLinks;
        }

        /**
         * Generates prompt text to add to AI request
         */
        public String generatePromptAddition() {
            StringBuilder prompt = new StringBuilder();
            prompt.append("\n**COURT-SPECIFIC RULES AND STANDING ORDERS**:\n");
            prompt.append("This case is in ").append(courtName).append(".\n");
            prompt.append("Applicable standing orders and local rules:\n");

            for (String rule : applicableRules) {
                String ruleName = extractRuleName(rule);
                String link = ruleLinks.get(ruleName);
                if (link != null) {
                    prompt.append("- ✓ ").append(rule).append(" [View →](").append(link).append(")\n");
                } else {
                    prompt.append("- ✓ ").append(rule).append("\n");
                }
            }

            prompt.append("\n**REQUIREMENT**: When providing procedural guidance, cite these court-specific ");
            prompt.append("rules in addition to general Mass. R. Civ. P./Crim. P. or Fed. R. Civ. P./Crim. P.\n");
            prompt.append("Example: \"Per ✓ BLS Standing Order 1-15 and ✓ Mass. R. Civ. P. 56...\"\n\n");

            return prompt.toString();
        }

        private String extractRuleName(String ruleDescription) {
            // Extract rule name from description (everything before the colon)
            int colonIndex = ruleDescription.indexOf(':');
            if (colonIndex > 0) {
                return ruleDescription.substring(0, colonIndex).trim();
            }
            return ruleDescription.trim();
        }
    }
}
