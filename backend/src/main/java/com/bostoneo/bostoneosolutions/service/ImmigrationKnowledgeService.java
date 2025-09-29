package com.bostoneo.bostoneosolutions.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import java.util.*;

/**
 * Service providing structured immigration law knowledge and procedures.
 * This supplements dynamic searches with authoritative, structured legal information.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ImmigrationKnowledgeService {

    /**
     * Core immigration appeal procedures with accurate forms, deadlines, and citations
     */
    private static final Map<String, AppealProcedure> APPEAL_PROCEDURES = Map.of(
        "IJ_TO_BIA", new AppealProcedure(
            "Immigration Judge to Board of Immigration Appeals",
            "EOIR-26",
            30,
            "calendar days from IJ decision (oral or mailed)",
            "Board of Immigration Appeals",
            "8 C.F.R. §§ 1003.3, 1003.38",
            "Generally stays execution under 8 C.F.R. § 1003.6 (subject to exceptions)",
            List.of(
                "BIA must RECEIVE (not postmark) within 30 days",
                "Must serve copy on DHS/ICE Office of Chief Counsel",
                "Brief due per BIA scheduling order (usually 21 days)",
                "Can request oral argument but rarely granted"
            )
        ),
        "USCIS_TO_AAO", new AppealProcedure(
            "USCIS Denial to Administrative Appeals Office",
            "I-290B",
            30,
            "days (usually 30; revocations can be 15/18 days; many decisions are motion-only - check denial notice)",
            "USCIS Administrative Appeals Office",
            "8 C.F.R. § 103.3",
            "No automatic stay - operations continue",
            List.of(
                "AAO appeals: Usually 30 days, but revocations can be 15/18 days",
                "Many USCIS decisions are motion-only (no appeal right) - verify appealability",
                "I-485 denials often motion-only - consider renewal in removal proceedings",
                "Current fee: $800 (as of 2024)",
                "File with USCIS office that made decision"
            )
        ),
        "USCIS_I130_TO_BIA", new AppealProcedure(
            "USCIS I-130/I-360 Denial to BIA",
            "EOIR-29",
            30,
            "calendar days from denial",
            "File with USCIS (forwarded to BIA)",
            "8 C.F.R. § 1003.3(a)(1)(iii)",
            "No automatic stay",
            List.of(
                "Only for I-130 and certain I-360 widow(er) petitions",
                "File EOIR-29 with USCIS office that denied petition",
                "USCIS forwards to BIA with administrative record",
                "Fee paid to USCIS per current fee schedule"
            )
        ),
        "BIA_TO_CIRCUIT", new AppealProcedure(
            "BIA to Federal Circuit Court of Appeals",
            "Petition for Review",
            30,
            "days from BIA final order (jurisdictional deadline)",
            "U.S. Court of Appeals for the circuit where the Immigration Judge completed proceedings",
            "INA § 242(b), 8 U.S.C. § 1252",
            "NO automatic stay - must file stay motion",
            List.of(
                "30-day deadline is jurisdictional - cannot be extended",
                "Venue: Circuit where the Immigration Judge completed proceedings (e.g., MA cases → First Circuit)",
                "Service on Attorney General/DOJ OIL handled per circuit ECF rules",
                "Must file stay motion to prevent removal under circuit rules",
                "Administrative record transmitted per FRAP",
                "Limited review under 8 U.S.C. § 1252(a)(2)(B) discretion, (C) criminal grounds, (D) constitutional/law carve-out",
                "CRITICAL: Issues must be exhausted (raised to IJ and BIA) or risk waiver on PFR"
            )
        )
    );

    /**
     * Standards of review for different appeal levels
     */
    private static final Map<String, String> STANDARDS_OF_REVIEW = Map.of(
        "BIA_REVIEWING_IJ", "Facts: Clear error | Law/Discretion: De novo",
        "CIRCUIT_REVIEWING_BIA", "Facts: Substantial evidence | Law: De novo | Discretion: Limited per § 1252(a)(2)(B), (C) criminal grounds, with § 1252(a)(2)(D) constitutional/law carve-out"
    );

    /**
     * Common immigration forms and their purposes
     */
    private static final Map<String, FormInfo> IMMIGRATION_FORMS = Map.of(
        "EOIR-26", new FormInfo("Notice of Appeal from IJ to BIA", "Immigration Court appeals", "https://www.justice.gov/eoir/form-eoir-26-notice-appeal"),
        "EOIR-29", new FormInfo("Notice of Appeal to BIA from USCIS", "I-130/I-360 denials only", "https://www.justice.gov/eoir/form-eoir-29"),
        "I-290B", new FormInfo("Notice of Appeal or Motion", "USCIS appeals to AAO or motions", "https://www.uscis.gov/i-290b"),
        "EOIR-27", new FormInfo("BIA Representative Form", "Attorney appearance before BIA", "https://www.justice.gov/eoir/form-eoir-27"),
        "EOIR-28", new FormInfo("IJ Representative Form", "Attorney appearance before IJ", "https://www.justice.gov/eoir/form-eoir-28")
    );

    /**
     * Get structured guidance for immigration appeals
     */
    public Map<String, Object> getStructuredImmigrationGuidance(String query) {
        log.info("Generating structured immigration guidance for: {}", query);

        Map<String, Object> guidance = new HashMap<>();
        String queryLower = query.toLowerCase();

        // Determine appeal type
        String appealType = determineAppealType(queryLower);
        AppealProcedure procedure = APPEAL_PROCEDURES.get(appealType);

        if (procedure != null) {
            guidance.put("procedure", procedure.toMap());
            guidance.put("quickAnswer", generateQuickAnswer(procedure));
        }

        // Add relevant forms
        List<Map<String, String>> relevantForms = new ArrayList<>();
        if (queryLower.contains("bia") || queryLower.contains("board")) {
            relevantForms.add(IMMIGRATION_FORMS.get("EOIR-26").toMap());
            relevantForms.add(IMMIGRATION_FORMS.get("EOIR-29").toMap());
        }
        if (queryLower.contains("uscis") || queryLower.contains("aao")) {
            relevantForms.add(IMMIGRATION_FORMS.get("I-290B").toMap());
        }
        guidance.put("forms", relevantForms);

        // Add standards of review
        guidance.put("standardsOfReview", STANDARDS_OF_REVIEW);

        // Add decision tree
        guidance.put("decisionTree", generateDecisionTree());

        // Add timeline guidance
        guidance.put("timelineGuidance", Map.of(
            "summary", "30 days controls IJ→BIA and BIA→Circuit; AAO is usually 30 days but revocations can be 15/18 days, and many USCIS matters are motion-only",
            "specificDeadlines", Map.of(
                "IJ_to_BIA", "30 calendar days (BIA must receive)",
                "BIA_to_Circuit", "30 days (jurisdictional)",
                "USCIS_to_AAO", "Usually 30 days; revocations 15/18 days; check denial notice",
                "USCIS_I130_to_BIA", "30 days"
            )
        ));

        // Add common pitfalls
        guidance.put("commonPitfalls", List.of(
            "30-day deadlines are strict - BIA counts RECEIPT not postmark",
            "Circuit court deadline is jurisdictional - absolutely no extensions",
            "CRITICAL: Motions to reopen/reconsider do NOT toll the 30-day Petition for Review deadline after BIA final order",
            "EXHAUSTION: Issues must be raised to IJ and explicitly to BIA or risk waiver on Petition for Review",
            "Not all USCIS decisions are appealable - many are motion-only (check denial notice)",
            "Stay of removal is NOT automatic for circuit court appeals - must file stay motion",
            "AAO deadlines vary: usually 30 days, but revocations can be 15/18 days",
            "I-485 denials usually cannot be appealed to AAO - consider renewal in removal proceedings"
        ));

        return guidance;
    }

    private String determineAppealType(String query) {
        if (query.contains("immigration judge") || (query.contains("ij") && query.contains("bia"))) {
            return "IJ_TO_BIA";
        } else if (query.contains("i-130") || query.contains("i130")) {
            return "USCIS_I130_TO_BIA";
        } else if (query.contains("circuit") || query.contains("petition for review")) {
            return "BIA_TO_CIRCUIT";
        } else if (query.contains("uscis") || query.contains("aao")) {
            return "USCIS_TO_AAO";
        } else if (query.contains("immigration") && query.contains("appeal")) {
            return "IJ_TO_BIA"; // Most common
        }
        return "IJ_TO_BIA"; // Default
    }

    private String generateQuickAnswer(AppealProcedure procedure) {
        return String.format("File %s with %s within %d %s. Citation: %s",
            procedure.formNumber,
            procedure.filedWith,
            procedure.deadlineDays,
            procedure.deadlineType,
            procedure.governingLaw
        );
    }

    private Map<String, String> generateDecisionTree() {
        return Map.of(
            "Lost in Immigration Court?", "→ EOIR-26 to BIA (30 days)",
            "USCIS denied I-130?", "→ EOIR-29 to BIA via USCIS (30 days)",
            "USCIS denied other petition?", "→ I-290B to AAO (usually 30 days)",
            "BIA affirmed removal?", "→ Petition for Review to Circuit (30 days)",
            "I-485 denied?", "→ Often no appeal; consider motion or renewal in removal"
        );
    }

    /**
     * Data classes for structured immigration information
     */
    static class AppealProcedure {
        final String name;
        final String formNumber;
        final int deadlineDays;
        final String deadlineType;
        final String filedWith;
        final String governingLaw;
        final String stayEffect;
        final List<String> keyPoints;

        AppealProcedure(String name, String formNumber, int deadlineDays, String deadlineType,
                       String filedWith, String governingLaw, String stayEffect, List<String> keyPoints) {
            this.name = name;
            this.formNumber = formNumber;
            this.deadlineDays = deadlineDays;
            this.deadlineType = deadlineType;
            this.filedWith = filedWith;
            this.governingLaw = governingLaw;
            this.stayEffect = stayEffect;
            this.keyPoints = keyPoints;
        }

        Map<String, Object> toMap() {
            Map<String, Object> map = new HashMap<>();
            map.put("name", name);
            map.put("formNumber", formNumber);
            map.put("deadline", deadlineDays + " " + deadlineType);
            map.put("filedWith", filedWith);
            map.put("governingLaw", governingLaw);
            map.put("stayEffect", stayEffect);
            map.put("keyPoints", keyPoints);
            return map;
        }
    }

    static class FormInfo {
        final String name;
        final String purpose;
        final String url;

        FormInfo(String name, String purpose, String url) {
            this.name = name;
            this.purpose = purpose;
            this.url = url;
        }

        Map<String, String> toMap() {
            return Map.of(
                "name", name,
                "purpose", purpose,
                "url", url
            );
        }
    }
}