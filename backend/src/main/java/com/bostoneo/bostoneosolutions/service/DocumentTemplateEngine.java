package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.ai.AiDocumentResponse;
import com.bostoneo.bostoneosolutions.dto.ai.DocumentTemplateData;
import com.bostoneo.bostoneosolutions.model.LegalCase;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Template engine for legal document generation.
 * Resolves HTML templates, injects case data + AI content, produces final HTML.
 *
 * Architecture:
 *   Layer 1 (Structure) — HTML template with caption layout, section order
 *   Layer 2 (Data)      — Case data from database (party names, court, case number)
 *   Layer 3 (Content)   — AI-generated sections (title, arguments, prayer)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class DocumentTemplateEngine {

    private final JurisdictionResolver jurisdictionResolver;
    private final com.bostoneo.bostoneosolutions.repository.UserRepository<com.bostoneo.bostoneosolutions.model.User> userRepository;
    private final com.bostoneo.bostoneosolutions.repository.OrganizationRepository organizationRepository;

    /** Cache loaded templates to avoid repeated classpath reads */
    private final Map<String, String> templateCache = new ConcurrentHashMap<>();

    private static final Set<String> TEXAS_JURISDICTIONS = Set.of(
            "texas", "tx"
    );
    private static final Set<String> CAPTION_DOCUMENT_TYPES = Set.of(
            "motion", "complaint", "petition", "brief", "memorandum", "pleading"
    );

    // ══════════════════════════════════════════
    // Public API
    // ══════════════════════════════════════════

    /**
     * Generate a complete HTML document from AI response + case data.
     *
     * @param aiResponse  Structured JSON from the AI (title, sections, prayer)
     * @param legalCase   Case from database (party names, court, case number)
     * @param jurisdiction  Jurisdiction string (e.g. "Texas", "Massachusetts")
     * @param documentType  Document type (e.g. "motion", "complaint")
     * @return Complete HTML ready for CKEditor or PDF export
     */
    public String renderDocument(AiDocumentResponse aiResponse, LegalCase legalCase,
                                  String jurisdiction, String documentType, Long userId, Long orgId) {
        // 1. Build template data from case + AI response + user/org info
        DocumentTemplateData data = buildTemplateData(aiResponse, legalCase, jurisdiction, userId, orgId);

        // 2. Render AI variable content into HTML
        String bodyHtml = renderSectionsToHtml(aiResponse);
        data.setDocumentBody(bodyHtml);

        // 3. Render prayer items as numbered list
        String prayerHtml = renderPrayerItems(aiResponse);

        // 4. Set AI-provided fields on the template data
        data.setDocumentTitle(aiResponse.getTitle() != null ? aiResponse.getTitle() : "MOTION");
        // reliefSought goes into the COMES NOW boilerplate slot
        String relief = aiResponse.getReliefSought() != null ? aiResponse.getReliefSought() : "[state relief sought]";

        // 5. Resolve and render caption fragment
        String captionHtml = renderCaption(data, jurisdiction);

        // 6. Load the document template and inject all data
        String templateKey = resolveDocumentTemplateKey(documentType);
        String template = loadTemplate("templates/html/" + templateKey + ".html");

        // Inject caption, prayer items, relief, then all other fields
        String html = template.replace("{{captionHtml}}", captionHtml);
        html = html.replace("{{prayerItems}}", prayerHtml);
        html = html.replace("{{reliefSought}}", convertInlineMarkdown(relief));
        html = injectData(html, data);

        // Prefix with marker so the frontend skips markdown conversion and loads HTML directly
        return "<!-- HTML_TEMPLATE -->\n" + html;
    }

    /**
     * Check if a document type supports template-based generation.
     * Returns false for letters, contracts, etc. that don't have court captions.
     */
    public boolean supportsTemplateGeneration(String documentType) {
        if (documentType == null) return false;
        String normalized = documentType.toLowerCase().replace(" ", "_").replace("-", "_");
        return CAPTION_DOCUMENT_TYPES.stream().anyMatch(normalized::contains);
    }

    // ══════════════════════════════════════════
    // Template Data Building
    // ══════════════════════════════════════════

    /**
     * Build DocumentTemplateData from case data and AI response.
     * All structural/data fields come from the database — never from the AI.
     */
    DocumentTemplateData buildTemplateData(AiDocumentResponse aiResponse, LegalCase legalCase,
                                                     String jurisdiction, Long userId, Long orgId) {
        String stateCode = resolveStateCode(jurisdiction);
        boolean isCommonwealth = Set.of("MA", "PA", "VA", "KY").contains(stateCode);
        String stateName = jurisdictionResolver.getStateName(stateCode);

        DocumentTemplateData.DocumentTemplateDataBuilder builder = DocumentTemplateData.builder()
                .currentDate(LocalDate.now().format(DateTimeFormatter.ofPattern("MMMM d, yyyy")))
                .documentTitle(aiResponse.getTitle() != null ? aiResponse.getTitle() : "MOTION")
                .respectfullySubmitted(true)
                .certificateOfService(true);

        // Caption style
        if (isTexasJurisdiction(jurisdiction)) {
            builder.captionSeparator("§")
                   .causeNumberLabel("CAUSE NO.");
        } else {
            builder.captionSeparator("")
                   .causeNumberLabel("Case No.");
        }

        // State label
        String stateLabel = isCommonwealth
                ? "COMMONWEALTH OF " + stateName.toUpperCase()
                : "STATE OF " + stateName.toUpperCase();
        builder.stateLabel(stateLabel);

        // Case data (from database — deterministic, never AI-generated)
        if (legalCase != null) {
            builder.caseNumber(legalCase.getCaseNumber() != null ? legalCase.getCaseNumber() : "[CASE NUMBER]");
            builder.docketNumber(legalCase.getDocketNumber());

            // Plaintiff: for criminal cases, it's the state; for civil, it's the client or other party
            String practiceArea = legalCase.getEffectivePracticeArea();
            if (isCriminalCase(practiceArea)) {
                builder.plaintiffName(stateLabel);
                builder.plaintiffLabel("Prosecution");
                builder.defendantName(legalCase.getClientName() != null
                        ? legalCase.getClientName().toUpperCase() : "[DEFENDANT NAME]");
                builder.defendantLabel("Defendant");
            } else {
                builder.plaintiffName(legalCase.getClientName() != null
                        ? legalCase.getClientName().toUpperCase() : "[PLAINTIFF NAME]");
                builder.plaintiffLabel("Plaintiff");
                builder.defendantName(legalCase.getDefendantName() != null
                        ? legalCase.getDefendantName().toUpperCase() : "[DEFENDANT NAME]");
                builder.defendantLabel("Defendant");
            }

            // Court info
            builder.courtName(legalCase.getCourtroom() != null
                    ? legalCase.getCourtroom().toUpperCase() : "[COURT NAME]");

            String county = legalCase.getCountyName();
            if (county != null && !county.isBlank()) {
                builder.countyState(county.toUpperCase() + " COUNTY, " + stateName.toUpperCase());
            } else {
                builder.countyState("[COUNTY], " + stateName.toUpperCase());
            }

            builder.judgeName(legalCase.getJudgeName());

            if (legalCase.getFilingDate() != null) {
                builder.filingDate(new java.text.SimpleDateFormat("MMMM d, yyyy").format(legalCase.getFilingDate()));
            }
        }

        // Attorney info from the logged-in user — name, address, phone all from USER, not org
        if (userId != null) {
            try {
                com.bostoneo.bostoneosolutions.model.User user = userRepository.get(userId);
                if (user != null) {
                    String fullName = ((user.getFirstName() != null ? user.getFirstName() : "") + " "
                            + (user.getLastName() != null ? user.getLastName() : "")).trim();
                    builder.attorneyName(fullName.isEmpty() ? "[ATTORNEY NAME]" : fullName.toUpperCase());
                    builder.firmAddress(user.getAddress() != null ? user.getAddress() : "");
                    builder.firmPhone(user.getPhone() != null ? user.getPhone() : "");
                }
            } catch (Exception e) {
                log.warn("Could not load user {} for attorney info: {}", userId, e.getMessage());
                builder.attorneyName("[ATTORNEY NAME]");
            }
        } else {
            builder.attorneyName("[ATTORNEY NAME]");
        }
        builder.attorneyBarNumber("SB# [BAR NUMBER]");

        return builder.build();
    }

    // ══════════════════════════════════════════
    // Section Rendering
    // ══════════════════════════════════════════

    /**
     * Render AI variable content into HTML body.
     * Only the VARIABLE parts: facts, legal standard, argument subsections.
     * Boilerplate (preamble, intro, prayer, signature, certificate) is in the template.
     *
     * h2 = section headings (centered by backend CSS)
     * h3 = argument subsection headings (left-aligned by backend CSS)
     * p  = body paragraphs (indented by backend CSS)
     */
    String renderSectionsToHtml(AiDocumentResponse response) {
        StringBuilder html = new StringBuilder();

        // I. STATEMENT OF FACTS
        if (response.getFacts() != null && !response.getFacts().isBlank()) {
            html.append("<h2>I.  STATEMENT OF FACTS</h2>\n");
            renderParagraphs(html, response.getFacts());
        }

        // II. APPLICABLE LEGAL STANDARDS
        if (response.getLegalStandard() != null && !response.getLegalStandard().isBlank()) {
            html.append("<h2>II.  APPLICABLE LEGAL STANDARDS</h2>\n");
            renderParagraphs(html, response.getLegalStandard());
        }

        // III. ARGUMENT (with subsections A, B, C)
        if (response.getArguments() != null && !response.getArguments().isEmpty()) {
            html.append("<h2>III.  ARGUMENT</h2>\n");
            for (AiDocumentResponse.ArgumentSection arg : response.getArguments()) {
                String letter = arg.getLetter() != null ? arg.getLetter() + ".  " : "";
                html.append("<h3>").append(letter).append(arg.getHeading()).append("</h3>\n");
                if (arg.getBody() != null && !arg.getBody().isBlank()) {
                    renderParagraphs(html, arg.getBody());
                }
            }
        }

        return html.toString();
    }

    /**
     * Render prayer items as a numbered list for the WHEREFORE template slot.
     */
    private String renderPrayerItems(AiDocumentResponse response) {
        StringBuilder html = new StringBuilder();
        html.append("<ol>\n");
        if (response.getPrayerItems() != null && !response.getPrayerItems().isEmpty()) {
            for (String item : response.getPrayerItems()) {
                // Skip if AI already included the catch-all "other relief" item
                if (item.toLowerCase().contains("other and further relief")) continue;
                html.append("<li>").append(convertInlineMarkdown(item)).append("</li>\n");
            }
        } else {
            html.append("<li>Grant the relief requested herein;</li>\n");
        }
        // Always add the standard catch-all as last item
        html.append("<li>Grant such other and further relief as the Court deems just and proper.</li>\n");
        html.append("</ol>\n");
        return html.toString();
    }

    /** Split text by double newlines into <p> paragraphs with first-line indent + markdown conversion. */
    private void renderParagraphs(StringBuilder html, String text) {
        String[] paragraphs = text.split("\n\n+");
        for (String para : paragraphs) {
            String trimmed = para.trim();
            if (!trimmed.isEmpty()) {
                html.append("<p style=\"text-indent:36pt\">").append(convertInlineMarkdown(trimmed.replace("\n", " "))).append("</p>\n");
            }
        }
    }

    /** Convert **bold** and *italic* markdown to HTML tags. */
    private String convertInlineMarkdown(String text) {
        if (text == null) return "";
        text = text.replaceAll("\\*\\*(.+?)\\*\\*", "<strong>$1</strong>");
        text = text.replaceAll("(?<!\\*)\\*(?!\\*)(.+?)(?<!\\*)\\*(?!\\*)", "<em>$1</em>");
        return text;
    }

    // ══════════════════════════════════════════
    // Caption Resolution
    // ══════════════════════════════════════════

    /**
     * Resolve and render the caption HTML fragment for the given jurisdiction.
     */
    private String renderCaption(DocumentTemplateData data, String jurisdiction) {
        String captionFile;
        if (isTexasJurisdiction(jurisdiction)) {
            captionFile = "templates/html/captions/caption-texas.html";
        } else {
            captionFile = "templates/html/captions/caption-default.html";
        }

        String captionTemplate = loadTemplate(captionFile);
        return injectData(captionTemplate, data);
    }

    // ══════════════════════════════════════════
    // Template Loading & Injection
    // ══════════════════════════════════════════

    /**
     * Load an HTML template from classpath, with caching.
     */
    private String loadTemplate(String path) {
        return templateCache.computeIfAbsent(path, p -> {
            try {
                ClassPathResource resource = new ClassPathResource(p);
                try (InputStream is = resource.getInputStream()) {
                    String content = new String(is.readAllBytes(), StandardCharsets.UTF_8);
                    log.info("Loaded HTML template: {}", p);
                    return content;
                }
            } catch (IOException e) {
                log.error("Failed to load HTML template: {}", p, e);
                return "<!-- Template not found: " + p + " -->";
            }
        });
    }

    /**
     * Inject DocumentTemplateData fields into an HTML template.
     * Simple {{placeholder}} replacement — no loops or conditionals needed.
     */
    private String injectData(String template, DocumentTemplateData data) {
        String result = template;
        result = replacePlaceholder(result, "caseNumber", data.getCaseNumber());
        result = replacePlaceholder(result, "docketNumber", data.getDocketNumber());
        result = replacePlaceholder(result, "causeNumberLabel", data.getCauseNumberLabel());
        result = replacePlaceholder(result, "plaintiffName", data.getPlaintiffName());
        result = replacePlaceholder(result, "plaintiffLabel", data.getPlaintiffLabel());
        result = replacePlaceholder(result, "defendantName", data.getDefendantName());
        result = replacePlaceholder(result, "defendantLabel", data.getDefendantLabel());
        result = replacePlaceholder(result, "courtName", data.getCourtName());
        result = replacePlaceholder(result, "countyState", data.getCountyState());
        result = replacePlaceholder(result, "judgeName", data.getJudgeName());
        result = replacePlaceholder(result, "stateLabel", data.getStateLabel());
        result = replacePlaceholder(result, "captionSeparator", data.getCaptionSeparator());
        result = replacePlaceholder(result, "documentTitle", data.getDocumentTitle());
        result = replacePlaceholder(result, "documentBody", data.getDocumentBody());
        result = replacePlaceholder(result, "attorneyName", data.getAttorneyName());
        result = replacePlaceholder(result, "attorneyBarNumber", data.getAttorneyBarNumber());
        result = replacePlaceholder(result, "firmName", data.getFirmName());
        result = replacePlaceholder(result, "firmAddress", data.getFirmAddress());
        result = replacePlaceholder(result, "firmPhone", data.getFirmPhone());
        result = replacePlaceholder(result, "firmEmail", data.getFirmEmail());
        result = replacePlaceholder(result, "filingDate", data.getFilingDate());
        result = replacePlaceholder(result, "currentDate", data.getCurrentDate());
        return result;
    }

    private String replacePlaceholder(String template, String key, String value) {
        return template.replace("{{" + key + "}}", value != null ? value : "");
    }

    // ══════════════════════════════════════════
    // Helpers
    // ══════════════════════════════════════════

    private String resolveDocumentTemplateKey(String documentType) {
        if (documentType == null) return "motion";
        String normalized = documentType.toLowerCase().replace(" ", "_").replace("-", "_");
        if (normalized.contains("motion")) return "motion";
        if (normalized.contains("complaint")) return "motion"; // Same structure for now
        if (normalized.contains("petition")) return "motion";
        if (normalized.contains("brief")) return "motion";
        return "motion"; // Default to motion template
    }

    private boolean isTexasJurisdiction(String jurisdiction) {
        if (jurisdiction == null) return false;
        return TEXAS_JURISDICTIONS.contains(jurisdiction.toLowerCase().trim());
    }

    private boolean isCriminalCase(String practiceArea) {
        if (practiceArea == null) return false;
        String lower = practiceArea.toLowerCase();
        return lower.contains("criminal") || lower.contains("dwi") || lower.contains("dui")
                || lower.contains("felony") || lower.contains("misdemeanor");
    }

    private String resolveStateCode(String jurisdiction) {
        if (jurisdiction == null) return "MA";
        String code = jurisdictionResolver.getStateCode(jurisdiction);
        return code != null ? code : "MA";
    }
}
