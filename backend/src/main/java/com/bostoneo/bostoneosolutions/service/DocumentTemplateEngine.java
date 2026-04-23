package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.ai.AiDocumentResponse;
import com.bostoneo.bostoneosolutions.dto.ai.DocumentTemplateData;
import com.bostoneo.bostoneosolutions.model.Attorney;
import com.bostoneo.bostoneosolutions.model.LegalCase;
import com.bostoneo.bostoneosolutions.model.StateCourtConfiguration;
import com.bostoneo.bostoneosolutions.repository.AttorneyRepository;
import com.bostoneo.bostoneosolutions.repository.StateCourtConfigurationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Optional;
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
    private final StateCourtConfigurationRepository stateCourtConfigRepository;
    private final AttorneyRepository attorneyRepository;

    /** Cache loaded templates to avoid repeated classpath reads */
    private final Map<String, String> templateCache = new ConcurrentHashMap<>();

    /** Cache DB-loaded caption templates keyed by "stateCode_courtLevel" */
    private final Map<String, Optional<StateCourtConfiguration>> configCache = new ConcurrentHashMap<>();

    private static final com.fasterxml.jackson.databind.ObjectMapper JSON_MAPPER = new com.fasterxml.jackson.databind.ObjectMapper();

    /** Human-readable document type names for COMES NOW / preamble text */
    private static final Map<String, String> DOCUMENT_TYPE_DISPLAY_NAMES = Map.ofEntries(
            Map.entry("motion-dismiss", "Motion to Dismiss"),
            Map.entry("motion-summary-judgment", "Motion for Summary Judgment"),
            Map.entry("motion-suppress", "Motion to Suppress"),
            Map.entry("motion-compel", "Motion to Compel"),
            Map.entry("motion-continuance", "Motion for Continuance"),
            Map.entry("motion-reconsider", "Motion for Reconsideration"),
            Map.entry("motion-default-judgment", "Motion for Default Judgment"),
            Map.entry("motion-new-trial", "Motion for New Trial"),
            Map.entry("motion-protective-order", "Motion for Protective Order"),
            Map.entry("motion", "Motion"),
            Map.entry("complaint", "Complaint"),
            Map.entry("petition", "Petition"),
            Map.entry("brief", "Brief"),
            Map.entry("memorandum", "Memorandum of Law"),
            Map.entry("pleading", "Pleading"),
            Map.entry("discovery", "Request for Production of Documents"),
            Map.entry("interrogatories", "Interrogatories")
    );

    private static final Set<String> CAPTION_DOCUMENT_TYPES = Set.of(
            "motion", "complaint", "petition", "brief", "memorandum", "pleading",
            "discovery", "interrogatories"
    );

    private static final Set<String> LETTER_DOCUMENT_TYPES = Set.of(
            "correspondence", "client-email", "cover-letter",
            "letter-of-representation", "opposing-counsel-letter",
            "opinion-letter", "settlement-letter"
    );

    private static final Set<String> CONTRACT_DOCUMENT_TYPES = Set.of(
            "contract", "nda", "settlement-agreement"
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
                                  String jurisdiction, String documentType, Long userId, Long orgId,
                                  String courtLevel) {
        String effectiveCourtLevel = (courtLevel != null && !courtLevel.isBlank()) ? courtLevel : "DEFAULT";
        String templateKey = resolveDocumentTemplateKey(documentType);

        // 1. Build template data from case + AI response + user/org info
        DocumentTemplateData data = buildTemplateData(aiResponse, legalCase, jurisdiction, documentType, userId, orgId, effectiveCourtLevel);

        // 2. Render AI variable content into HTML — type-aware section headings
        String bodyHtml = renderSectionsToHtml(aiResponse, documentType);
        data.setDocumentBody(bodyHtml);

        // 3. Type-specific rendering: prayer vs conclusion, jury demand
        String prayerHtml = "";
        if ("discovery".equals(templateKey)) {
            // Discovery: no prayer, no COMES NOW, no jury demand — body is the entire content
        } else if ("brief".equals(templateKey)) {
            // Briefs use a prose CONCLUSION instead of a numbered WHEREFORE prayer
            data.setConclusionText(renderConclusionText(aiResponse));
        } else {
            // Motions + complaints use numbered prayer list
            prayerHtml = renderPrayerItems(aiResponse);
            if ("complaint".equals(templateKey)) {
                data.setJuryDemandSection(renderJuryDemand(data.getFilingPartyLabel()));
            }
        }

        // 4. Set title with type-appropriate default
        String defaultTitle = switch (templateKey) {
            case "complaint" -> "COMPLAINT";
            case "brief" -> "MEMORANDUM OF LAW";
            case "discovery" -> resolveDiscoveryDefaultTitle(documentType);
            default -> "MOTION";
        };
        data.setDocumentTitle(aiResponse.getTitle() != null ? aiResponse.getTitle() : defaultTitle);

        // 5. Resolve and render caption fragment
        String captionHtml = renderCaption(data, jurisdiction, effectiveCourtLevel);

        // 6. Load the document template and inject all data
        String template = loadTemplate("templates/html/" + templateKey + ".html");

        String html = template.replace("{{captionHtml}}", captionHtml);
        html = html.replace("{{prayerItems}}", prayerHtml);
        html = injectData(html, data);

        // Prefix with marker so the frontend skips markdown conversion and loads HTML directly
        return "<!-- HTML_TEMPLATE -->\n" + html;
    }

    /**
     * Check if a document type supports template-based generation.
     * Includes caption types (court filings), letter types, and contract types.
     */
    public boolean supportsTemplateGeneration(String documentType) {
        if (documentType == null) return false;
        String normalized = documentType.toLowerCase().replace(" ", "_").replace("-", "_");
        if (CAPTION_DOCUMENT_TYPES.stream().anyMatch(normalized::contains)) return true;
        if (isContractDocumentType(documentType)) return true;
        return isLetterDocumentType(documentType);
    }

    /**
     * Check if a document type is a letter type (not demand letter — that has its own pipeline).
     */
    public boolean isLetterDocumentType(String documentType) {
        if (documentType == null) return false;
        String normalized = documentType.toLowerCase().replace(" ", "_").replace("-", "_");
        // Check direct match against known letter types (normalize hyphens to match set)
        String hyphenated = documentType.toLowerCase().trim();
        if (LETTER_DOCUMENT_TYPES.contains(hyphenated)) return true;
        // Fallback pattern matching for variants
        return (normalized.contains("letter") || normalized.contains("correspondence")
                || normalized.contains("client_email") || normalized.contains("cover_letter")
                || normalized.contains("opinion_letter") || normalized.contains("opposing_counsel"))
                && !normalized.contains("demand"); // Exclude demand letters — they have their own pipeline
    }

    /**
     * Check if a document type is a contract type (contract, NDA, settlement agreement).
     */
    public boolean isContractDocumentType(String documentType) {
        if (documentType == null) return false;
        String hyphenated = documentType.toLowerCase().trim();
        if (CONTRACT_DOCUMENT_TYPES.contains(hyphenated)) return true;
        // Fallback pattern matching for variants
        String normalized = hyphenated.replace(" ", "_").replace("-", "_");
        return normalized.contains("nda") || normalized.contains("non_disclosure")
                || normalized.contains("confidentiality_agreement")
                || (normalized.contains("settlement") && normalized.contains("agreement"))
                || (normalized.contains("contract") && !normalized.contains("contract_dispute"));
    }

    /**
     * Generate a complete HTML letter from AI response + stationery data.
     * Different pipeline from renderDocument() — no court caption, uses letterhead/signature stationery.
     *
     * @param aiResponse    Structured JSON from the AI (letter-specific fields)
     * @param userId        Logged-in user for attorney info fallback
     * @param orgId         Organization for firm info fallback
     * @param stationeryHtml  Optional rendered stationery HTML (letterhead, signature, footer)
     * @return Complete HTML ready for CKEditor or PDF export
     */
    public String renderLetterDocument(AiDocumentResponse aiResponse, Long userId, Long orgId,
                                        StationeryHtmlParts stationeryHtml) {
        DocumentTemplateData data = buildLetterTemplateData(aiResponse, userId, orgId, stationeryHtml);

        // Render body paragraphs from AI content (no indent — block-style for letters)
        StringBuilder bodyHtml = new StringBuilder();
        if (aiResponse.getLetterBody() != null && !aiResponse.getLetterBody().isBlank()) {
            renderParagraphs(bodyHtml, aiResponse.getLetterBody(), false);
        }
        data.setLetterBody(bodyHtml.toString());

        // Render recipient block as HTML paragraphs
        if (aiResponse.getRecipientBlock() != null && !aiResponse.getRecipientBlock().isBlank()) {
            StringBuilder recipientHtml = new StringBuilder();
            for (String line : aiResponse.getRecipientBlock().split("\n")) {
                String trimmed = line.trim();
                if (!trimmed.isEmpty()) {
                    recipientHtml.append("<p style=\"margin:0;\">").append(convertInlineMarkdown(trimmed)).append("</p>\n");
                }
            }
            data.setRecipientBlock(recipientHtml.toString());
        }

        // Render RE: block as HTML — tabular label:value format matching real legal letters
        if (aiResponse.getReBlock() != null && !aiResponse.getReBlock().isBlank()) {
            StringBuilder reHtml = new StringBuilder();
            reHtml.append("<table border=\"0\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:12px 0;\">\n");
            boolean firstLine = true;
            for (String line : aiResponse.getReBlock().split("\n")) {
                String trimmed = line.trim();
                if (trimmed.isEmpty()) continue;
                // Strip leading "Re:" if AI included it
                String cleaned = trimmed.replaceFirst("(?i)^re:\\s*", "");
                if (cleaned.isEmpty()) continue;

                reHtml.append("<tr>");
                // First row gets "Re:" label, subsequent rows get empty cell
                reHtml.append("<td style=\"vertical-align:top; white-space:nowrap; padding-right:16px;\">")
                        .append(firstLine ? "<strong>Re:</strong>" : "")
                        .append("</td>");

                // Try to split label:value for aligned columns (e.g., "Our Client: John Doe")
                int colonIdx = cleaned.indexOf(':');
                if (colonIdx > 0 && colonIdx < cleaned.length() - 1) {
                    String label = cleaned.substring(0, colonIdx + 1).trim();
                    String value = cleaned.substring(colonIdx + 1).trim();
                    reHtml.append("<td style=\"white-space:nowrap; padding-right:16px;\">")
                            .append(convertInlineMarkdown(label))
                            .append("</td><td>")
                            .append(convertInlineMarkdown(value))
                            .append("</td>");
                } else {
                    reHtml.append("<td colspan=\"2\">").append(convertInlineMarkdown(cleaned)).append("</td>");
                }
                reHtml.append("</tr>\n");
                firstLine = false;
            }
            reHtml.append("</table>\n");
            data.setReBlock(reHtml.toString());
        }

        // Load and inject template
        String template = loadTemplate("templates/html/letter.html");
        String html = injectData(template, data);

        return "<!-- HTML_TEMPLATE -->\n" + html;
    }

    /** Simple container for pre-rendered stationery HTML parts. */
    public record StationeryHtmlParts(String letterheadHtml, String signatureBlockHtml, String footerHtml) {}

    /**
     * Generate a complete HTML contract/agreement from AI response + case data.
     * Different pipeline from renderDocument() — no court caption, centered title, dual signature blocks.
     *
     * @param aiResponse  Structured JSON from the AI (preamble, sections)
     * @param legalCase   Case from database (party names for signature blocks)
     * @return Complete HTML ready for CKEditor or PDF export
     */
    public String renderContractDocument(AiDocumentResponse aiResponse, LegalCase legalCase) {
        DocumentTemplateData data = DocumentTemplateData.builder()
                .currentDate(LocalDate.now().format(DateTimeFormatter.ofPattern("MMMM d, yyyy")))
                .build();

        // Title
        data.setDocumentTitle(aiResponse.getTitle() != null ? aiResponse.getTitle() : "AGREEMENT");

        // Party names for dual signature blocks
        if (legalCase != null) {
            data.setPlaintiffName(legalCase.getClientName() != null ? legalCase.getClientName() : "[PARTY 1]");
            data.setDefendantName(legalCase.getDefendantName() != null ? legalCase.getDefendantName() : "[PARTY 2]");
        } else {
            data.setPlaintiffName("[PARTY 1]");
            data.setDefendantName("[PARTY 2]");
        }

        // Render contract body — preamble + numbered sections
        String bodyHtml = renderContractSections(aiResponse);
        data.setDocumentBody(bodyHtml);

        // Load and inject template
        String template = loadTemplate("templates/html/contract.html");
        String html = injectData(template, data);

        return "<!-- HTML_TEMPLATE -->\n" + html;
    }

    /**
     * Render contract sections: preamble from facts, numbered sections from arguments.
     */
    private String renderContractSections(AiDocumentResponse aiResponse) {
        StringBuilder html = new StringBuilder();

        // Preamble — from facts field (date, parties, recitals/WHEREAS clauses)
        if (aiResponse.getFacts() != null && !aiResponse.getFacts().isBlank()) {
            renderParagraphs(html, aiResponse.getFacts(), false);
        }

        // Numbered sections — from arguments field
        if (aiResponse.getArguments() != null && !aiResponse.getArguments().isEmpty()) {
            int sectionNum = 1;
            for (AiDocumentResponse.ArgumentSection arg : aiResponse.getArguments()) {
                html.append("<h2 style=\"font-size:12pt; margin:16px 0 8px 0;\">")
                        .append(sectionNum).append(". ");
                if (arg.getHeading() != null && !arg.getHeading().isBlank()) {
                    html.append(arg.getHeading().toUpperCase());
                }
                html.append("</h2>\n");
                if (arg.getBody() != null && !arg.getBody().isBlank()) {
                    renderParagraphs(html, arg.getBody(), false);
                }
                sectionNum++;
            }
        }

        return html.toString();
    }

    /**
     * Build DocumentTemplateData for a letter document.
     */
    private DocumentTemplateData buildLetterTemplateData(AiDocumentResponse aiResponse, Long userId, Long orgId,
                                                          StationeryHtmlParts stationeryHtml) {
        DocumentTemplateData.DocumentTemplateDataBuilder builder = DocumentTemplateData.builder()
                .currentDate(LocalDate.now().format(DateTimeFormatter.ofPattern("MMMM d, yyyy")));

        // Stationery HTML: use provided stationery if configured, otherwise leave empty.
        // No fallback letterhead — users who print on physical firm letterhead don't want a generated header.
        // To get a digital letterhead in PDFs, configure stationery in organization settings.
        if (stationeryHtml != null && stationeryHtml.letterheadHtml() != null) {
            builder.letterheadHtml(stationeryHtml.letterheadHtml());
        } else {
            builder.letterheadHtml("");
        }

        if (stationeryHtml != null && stationeryHtml.signatureBlockHtml() != null) {
            builder.signatureBlockHtml(stationeryHtml.signatureBlockHtml());
        } else {
            // Generate basic signature block from attorney data
            builder.signatureBlockHtml(buildFallbackSignature(userId, orgId));
        }

        if (stationeryHtml != null && stationeryHtml.footerHtml() != null) {
            builder.footerHtml(stationeryHtml.footerHtml());
        } else {
            builder.footerHtml("");
        }

        // AI-generated content
        builder.salutationLine(aiResponse.getSalutation() != null ? aiResponse.getSalutation() : "Dear Sir or Madam:");
        builder.closingLine(aiResponse.getClosing() != null ? aiResponse.getClosing() : "Very truly yours,");

        // Via line (from title field if it contains "Via" or "Certified Mail")
        String viaLine = "";
        if (aiResponse.getTitle() != null && !aiResponse.getTitle().isBlank()) {
            viaLine = "<p style=\"margin:8px 0;\"><strong>" + convertInlineMarkdown(aiResponse.getTitle()) + "</strong></p>";
        }
        builder.viaLine(viaLine);

        return builder.build();
    }

    /** Generate a simple letterhead from attorney/org data when no stationery is configured. */
    private String buildFallbackLetterhead(Long userId, Long orgId) {
        StringBuilder html = new StringBuilder();
        html.append("<div style=\"text-align:center; margin-bottom:20px; border-bottom:2px solid #333; padding-bottom:12px;\">\n");

        String firmName = "";
        String firmPhone = "";
        String firmEmail = "";
        if (orgId != null) {
            try {
                var orgOpt = organizationRepository.findById(orgId);
                if (orgOpt.isPresent()) {
                    firmName = orgOpt.get().getName() != null ? orgOpt.get().getName() : "";
                    firmPhone = orgOpt.get().getPhone() != null ? orgOpt.get().getPhone() : "";
                    firmEmail = orgOpt.get().getEmail() != null ? orgOpt.get().getEmail() : "";
                }
            } catch (Exception e) {
                log.debug("Could not load org for letterhead: {}", e.getMessage());
            }
        }

        String attorneyName = "";
        String barNumber = "";
        String address = "";
        String directPhone = "";
        if (userId != null) {
            try {
                com.bostoneo.bostoneosolutions.model.User user = userRepository.get(userId);
                if (user != null) {
                    attorneyName = ((user.getFirstName() != null ? user.getFirstName() : "") + " "
                            + (user.getLastName() != null ? user.getLastName() : "")).trim();
                    address = user.getAddress() != null ? user.getAddress() : "";
                }
            } catch (Exception e) {
                log.debug("Could not load user for letterhead: {}", e.getMessage());
            }
            try {
                Optional<Attorney> attorneyOpt = orgId != null
                        ? attorneyRepository.findByUserIdAndOrganizationId(userId, orgId)
                        : attorneyRepository.findByUserId(userId);
                if (attorneyOpt.isPresent()) {
                    Attorney att = attorneyOpt.get();
                    if (att.getBarNumber() != null) barNumber = att.getBarNumber();
                    String officeAddr = buildOfficeAddress(att);
                    if (!officeAddr.isBlank()) address = officeAddr;
                    if (att.getDirectPhone() != null) directPhone = att.getDirectPhone();
                }
            } catch (Exception e) {
                log.debug("Could not load attorney for letterhead: {}", e.getMessage());
            }
        }

        if (!firmName.isEmpty()) html.append("<p style=\"font-size:14pt; font-weight:bold; margin:0;\">").append(firmName.toUpperCase()).append("</p>\n");
        if (!attorneyName.isEmpty()) html.append("<p style=\"margin:2px 0;\">").append(attorneyName).append("</p>\n");
        if (!address.isEmpty()) html.append("<p style=\"margin:2px 0;\">").append(address).append("</p>\n");
        String phone = !directPhone.isEmpty() ? directPhone : firmPhone;
        if (!phone.isEmpty()) html.append("<p style=\"margin:2px 0;\">Tel: ").append(phone).append("</p>\n");
        if (!firmEmail.isEmpty()) html.append("<p style=\"margin:2px 0;\">").append(firmEmail).append("</p>\n");
        html.append("</div>\n");
        return html.toString();
    }

    /** Generate a simple signature block when no stationery signature is configured. */
    private String buildFallbackSignature(Long userId, Long orgId) {
        StringBuilder html = new StringBuilder();
        String attorneyName = "[ATTORNEY NAME]";
        if (userId != null) {
            try {
                com.bostoneo.bostoneosolutions.model.User user = userRepository.get(userId);
                if (user != null) {
                    attorneyName = ((user.getFirstName() != null ? user.getFirstName() : "") + " "
                            + (user.getLastName() != null ? user.getLastName() : "")).trim();
                }
            } catch (Exception e) {
                log.debug("Could not load user for signature: {}", e.getMessage());
            }
        }
        html.append("<br/>\n");
        html.append("<p>_________________________________</p>\n");
        html.append("<p><strong>").append(attorneyName).append("</strong></p>\n");
        return html.toString();
    }

    // ══════════════════════════════════════════
    // Template Data Building
    // ══════════════════════════════════════════

    /**
     * Build DocumentTemplateData from case data and AI response.
     * All structural/data fields come from the database — never from the AI.
     */
    DocumentTemplateData buildTemplateData(AiDocumentResponse aiResponse, LegalCase legalCase,
                                                     String jurisdiction, String documentType, Long userId, Long orgId,
                                                     String courtLevel) {
        String stateCode = resolveStateCode(jurisdiction);
        String stateName = jurisdictionResolver.getStateName(stateCode);

        // Load state court configuration from DB (cached)
        Optional<StateCourtConfiguration> configOpt = resolveStateConfig(stateCode, courtLevel);
        boolean isCommonwealth = configOpt.map(StateCourtConfiguration::getIsCommonwealth)
                .orElse(Set.of("MA", "PA", "VA", "KY").contains(stateCode));

        DocumentTemplateData.DocumentTemplateDataBuilder builder = DocumentTemplateData.builder()
                .currentDate(LocalDate.now().format(DateTimeFormatter.ofPattern("MMMM d, yyyy")))
                .documentTitle(aiResponse.getTitle() != null ? aiResponse.getTitle() : "MOTION")
                .respectfullySubmitted(true)
                .certificateOfService(true);

        // Caption style — data-driven from state_court_configurations table
        if (configOpt.isPresent()) {
            StateCourtConfiguration config = configOpt.get();
            builder.captionSeparator(config.getCaptionSeparator() != null ? config.getCaptionSeparator() : "")
                   .causeNumberLabel(config.getCauseNumberLabel() != null ? config.getCauseNumberLabel() : "Case No.");
        } else {
            builder.captionSeparator("")
                   .causeNumberLabel("Case No.");
        }

        // State label — used as prosecution name in criminal cases
        String stateLabel;
        if ("US".equals(stateCode)) {
            stateLabel = "UNITED STATES OF AMERICA";
        } else if (isCommonwealth) {
            stateLabel = "COMMONWEALTH OF " + stateName.toUpperCase();
        } else {
            stateLabel = "STATE OF " + stateName.toUpperCase();
        }
        builder.stateLabel(stateLabel);

        // Case data (from database — deterministic, never AI-generated)
        String filingPartyRole = "Plaintiff";
        String filingPartyName = "[PLAINTIFF NAME]";

        if (legalCase != null) {
            builder.caseNumber(legalCase.getCaseNumber() != null ? legalCase.getCaseNumber() : "[CASE NUMBER]");
            builder.docketNumber(legalCase.getDocketNumber());

            // Plaintiff: for criminal cases, it's the state; for civil, it's the client or other party
            if (isCriminalCase(legalCase)) {
                // Use party_label_style to determine prosecution name and label
                String partyStyle = configOpt.map(StateCourtConfiguration::getPartyLabelStyle).orElse("STANDARD");
                String prosecutionName;
                String prosecutionLabel;
                if ("PEOPLE".equals(partyStyle)) {
                    prosecutionName = "THE PEOPLE OF THE " + stateLabel;
                    prosecutionLabel = "Prosecution";
                } else {
                    // COMMONWEALTH and STANDARD — stateLabel already correct
                    prosecutionName = stateLabel;
                    prosecutionLabel = "Prosecution";
                }
                builder.plaintiffName(prosecutionName);
                builder.plaintiffLabel(prosecutionLabel);
                String defendantName = legalCase.getClientName() != null
                        ? legalCase.getClientName().toUpperCase() : "[DEFENDANT NAME]";
                builder.defendantName(defendantName);
                builder.defendantLabel("Defendant");
                builder.filingPartyLabel("Defendant");
                filingPartyRole = "Defendant";
                filingPartyName = defendantName;
            } else {
                String plaintiffName = legalCase.getClientName() != null
                        ? legalCase.getClientName().toUpperCase() : "[PLAINTIFF NAME]";
                builder.plaintiffName(plaintiffName);
                builder.plaintiffLabel("Plaintiff");
                builder.defendantName(legalCase.getDefendantName() != null
                        ? legalCase.getDefendantName().toUpperCase() : "[DEFENDANT NAME]");
                builder.defendantLabel("Defendant");
                builder.filingPartyLabel("Plaintiff");
                filingPartyRole = "Plaintiff";
                filingPartyName = plaintiffName;
            }

            // Court name resolution order:
            // 1. If case has courtroom AND it looks like a real court name (not "Session 9"), use it
            // 2. Otherwise, use state config's courtDisplayName (generic jurisdiction format)
            // 3. Fallback placeholder
            String courtroom = legalCase.getCourtroom();
            String courtDisplayName = configOpt.map(StateCourtConfiguration::getCourtDisplayName).orElse(null);
            if (courtroom != null && !courtroom.isBlank() && looksLikeCourtName(courtroom)) {
                builder.courtName(courtroom.toUpperCase());
            } else if (courtDisplayName != null && !courtDisplayName.isBlank()) {
                builder.courtName(courtDisplayName.toUpperCase());
            } else {
                builder.courtName("[COURT NAME]");
            }

            String county = legalCase.getCountyName();
            if (county != null && !county.isBlank()) {
                String upper = county.toUpperCase();
                if (upper.contains("COUNTY")) {
                    // countyName already includes "COUNTY" (e.g., "Suffolk County Superior Court")
                    // Extract just the county portion up to and including "COUNTY"
                    int idx = upper.indexOf("COUNTY") + "COUNTY".length();
                    String countyPart = upper.substring(0, idx).trim();
                    builder.countyState(countyPart + ", " + stateName.toUpperCase());
                } else {
                    builder.countyState(upper + " COUNTY, " + stateName.toUpperCase());
                }
            } else {
                builder.countyState("[COUNTY], " + stateName.toUpperCase());
            }

            builder.judgeName(legalCase.getJudgeName());

            if (legalCase.getFilingDate() != null) {
                builder.filingDate(new java.text.SimpleDateFormat("MMMM d, yyyy").format(legalCase.getFilingDate()));
            }
        } else {
            // No case linked — use clean placeholder values for attorney to fill in
            builder.caseNumber("[CASE NUMBER]");
            builder.plaintiffName("[PLAINTIFF NAME]");
            builder.plaintiffLabel("Plaintiff");
            builder.defendantName("[DEFENDANT NAME]");
            builder.defendantLabel("Defendant");
            builder.filingPartyLabel("Plaintiff");
            // Use state config courtDisplayName if available
            String courtDisplayName = configOpt.map(StateCourtConfiguration::getCourtDisplayName).orElse(null);
            builder.courtName(courtDisplayName != null && !courtDisplayName.isBlank()
                    ? courtDisplayName.toUpperCase() : "[COURT NAME]");
            builder.countyState("[COUNTY], " + stateName.toUpperCase());
        }

        // Resolve comesNowSection from state config's comesNowFormat
        String comesNowFmt = configOpt.map(StateCourtConfiguration::getComesNowFormat).orElse(null);
        if (comesNowFmt == null || comesNowFmt.isBlank()) {
            comesNowFmt = "COMES NOW {partyName}, by and through undersigned counsel, and respectfully moves this Honorable Court to {relief}, and in support thereof states:";
        }
        String reliefSought = aiResponse.getReliefSought() != null ? aiResponse.getReliefSought() : "[state relief sought]";

        // Resolve {rule} placeholder (used by Federal format) from procedural_rules_ref
        String ruleReference = "[applicable rule]";
        if (configOpt.isPresent() && configOpt.get().getProceduralRulesRef() != null) {
            try {
                var rulesJson = JSON_MAPPER.readTree(configOpt.get().getProceduralRulesRef());
                boolean isCriminal = legalCase != null && isCriminalCase(legalCase);
                String ruleKey = isCriminal ? "criminal" : "civil";
                if (rulesJson.has(ruleKey)) {
                    ruleReference = rulesJson.get(ruleKey).asText();
                }
            } catch (Exception e) {
                log.debug("Could not parse procedural_rules_ref: {}", e.getMessage());
            }
        }

        // Resolve {documentType} placeholder (used by NY format) — use display name map for correct phrasing
        String docTypeReadable = "Motion";
        if (documentType != null && !documentType.isBlank()) {
            docTypeReadable = DOCUMENT_TYPE_DISPLAY_NAMES.getOrDefault(documentType, null);
            if (docTypeReadable == null) {
                // Fallback: title-case the slug
                docTypeReadable = java.util.Arrays.stream(documentType.replace("-", " ").replace("_", " ").split("\\s+"))
                        .map(w -> w.substring(0, 1).toUpperCase() + w.substring(1).toLowerCase())
                        .collect(java.util.stream.Collectors.joining(" "));
            }
        }

        String comesNowResolved = comesNowFmt
                .replace("{partyRole}", filingPartyRole)
                .replace("{partyName}", "<strong>" + filingPartyName + "</strong>")
                .replace("{relief}", reliefSought)
                .replace("{rule}", ruleReference)
                .replace("{documentType}", docTypeReadable);
        builder.comesNowSection(comesNowResolved);

        // Override COMES NOW for complaint types — different preamble language
        if ("complaint".equals(resolveDocumentTemplateKey(documentType))) {
            String defendantDisplay = (legalCase != null && legalCase.getDefendantName() != null)
                    ? legalCase.getDefendantName().toUpperCase() : "[DEFENDANT NAME]";
            String complaintIntro = "COMES NOW " + filingPartyRole + " <strong>" + filingPartyName
                + "</strong>, by and through undersigned counsel, and files this Complaint against "
                + defendantDisplay + ", and in support thereof states as follows:";
            builder.comesNowSection(complaintIntro);
        }

        // Resolve prayerIntro from state config's prayerFormat
        String prayerFmt = configOpt.map(StateCourtConfiguration::getPrayerFormat).orElse(null);
        if (prayerFmt == null || prayerFmt.isBlank()) {
            prayerFmt = "WHEREFORE, {partyName} respectfully requests this Honorable Court to:";
        }
        String prayerResolved = prayerFmt
                .replace("{partyRole}", filingPartyRole)
                .replace("{partyName}", filingPartyName)
                .replace("{relief}", reliefSought);
        builder.prayerIntro(prayerResolved);

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
        String barPrefix = configOpt.map(StateCourtConfiguration::getBarNumberPrefix).orElse("Bar No.");
        builder.attorneyBarNumber(barPrefix + " [BAR NUMBER]");

        // Firm info from organization
        if (orgId != null) {
            try {
                organizationRepository.findById(orgId).ifPresent(org -> {
                    builder.firmName(org.getName() != null ? org.getName() : "");
                    builder.firmEmail(org.getEmail() != null ? org.getEmail() : "");
                });
            } catch (Exception e) {
                log.debug("Could not load organization {} for firm info: {}", orgId, e.getMessage());
            }
        }

        // Attorney professional info — bar number, firm name, office address
        // Overrides User/Org defaults with attorney-specific data when available
        if (userId != null) {
            try {
                Optional<Attorney> attorneyOpt = orgId != null
                        ? attorneyRepository.findByUserIdAndOrganizationId(userId, orgId)
                        : attorneyRepository.findByUserId(userId);
                attorneyOpt.ifPresent(attorney -> {
                    if (attorney.getBarNumber() != null && !attorney.getBarNumber().isBlank()) {
                        builder.attorneyBarNumber(barPrefix + " " + attorney.getBarNumber());
                    }
                    if (attorney.getFirmName() != null && !attorney.getFirmName().isBlank()) {
                        builder.firmName(attorney.getFirmName());
                    }
                    String officeAddr = buildOfficeAddress(attorney);
                    if (!officeAddr.isBlank()) {
                        builder.firmAddress(officeAddr);
                    }
                    if (attorney.getDirectPhone() != null && !attorney.getDirectPhone().isBlank()) {
                        builder.firmPhone(attorney.getDirectPhone());
                    }
                });
            } catch (Exception e) {
                log.debug("Could not load attorney for user {}: {}", userId, e.getMessage());
            }
        }

        return builder.build();
    }

    // ══════════════════════════════════════════
    // Section Rendering
    // ══════════════════════════════════════════

    /**
     * Render AI variable content into HTML body, dispatching to a type-specific renderer.
     * Each document type has its own section headings and structure:
     *   - Motion/petition/pleading: I. STATEMENT OF FACTS / II. LEGAL STANDARDS / III. ARGUMENT
     *   - Complaint: JURISDICTION AND VENUE / FACTUAL ALLEGATIONS (numbered) / CAUSES OF ACTION (counts)
     *   - Brief/memorandum: STATEMENT OF FACTS / LEGAL STANDARD / ARGUMENT
     */
    String renderSectionsToHtml(AiDocumentResponse response, String documentType) {
        String templateKey = resolveDocumentTemplateKey(documentType);
        return switch (templateKey) {
            case "complaint" -> renderComplaintSections(response);
            case "brief" -> renderBriefSections(response);
            case "discovery" -> renderDiscoverySections(response);
            default -> renderMotionSections(response);
        };
    }

    /** Motion/petition/pleading: numbered Roman headings, lettered argument subsections. */
    private String renderMotionSections(AiDocumentResponse response) {
        StringBuilder html = new StringBuilder();
        if (response.getFacts() != null && !response.getFacts().isBlank()) {
            html.append("<h2>I.  STATEMENT OF FACTS</h2>\n");
            renderParagraphs(html, response.getFacts());
        }
        if (response.getLegalStandard() != null && !response.getLegalStandard().isBlank()) {
            html.append("<h2>II.  APPLICABLE LEGAL STANDARDS</h2>\n");
            renderParagraphs(html, response.getLegalStandard());
        }
        if (response.getArguments() != null && !response.getArguments().isEmpty()) {
            html.append("<h2>III.  ARGUMENT</h2>\n");
            renderArgumentSubsections(html, response.getArguments());
        }
        return html.toString();
    }

    /** Complaint: jurisdiction/venue, numbered factual allegations, causes of action as counts. */
    private String renderComplaintSections(AiDocumentResponse response) {
        StringBuilder html = new StringBuilder();
        if (response.getLegalStandard() != null && !response.getLegalStandard().isBlank()) {
            html.append("<h2>JURISDICTION AND VENUE</h2>\n");
            renderParagraphs(html, response.getLegalStandard());
        }
        if (response.getFacts() != null && !response.getFacts().isBlank()) {
            html.append("<h2>FACTUAL ALLEGATIONS</h2>\n");
            renderNumberedParagraphs(html, response.getFacts());
        }
        if (response.getArguments() != null && !response.getArguments().isEmpty()) {
            int countNum = 1;
            for (AiDocumentResponse.ArgumentSection arg : response.getArguments()) {
                html.append("<h2>COUNT ").append(toRoman(countNum)).append(": ")
                    .append(arg.getHeading()).append("</h2>\n");
                if (arg.getBody() != null && !arg.getBody().isBlank()) {
                    renderParagraphs(html, arg.getBody());
                }
                countNum++;
            }
        }
        return html.toString();
    }

    /** Brief/memorandum: statement of facts, legal standard, argument with subsections. */
    private String renderBriefSections(AiDocumentResponse response) {
        StringBuilder html = new StringBuilder();
        if (response.getFacts() != null && !response.getFacts().isBlank()) {
            html.append("<h2>STATEMENT OF FACTS</h2>\n");
            renderParagraphs(html, response.getFacts());
        }
        if (response.getLegalStandard() != null && !response.getLegalStandard().isBlank()) {
            html.append("<h2>LEGAL STANDARD</h2>\n");
            renderParagraphs(html, response.getLegalStandard());
        }
        if (response.getArguments() != null && !response.getArguments().isEmpty()) {
            html.append("<h2>ARGUMENT</h2>\n");
            renderArgumentSubsections(html, response.getArguments());
        }
        return html.toString();
    }

    /** Discovery: instructions/definitions section + numbered requests or interrogatories. */
    private String renderDiscoverySections(AiDocumentResponse response) {
        StringBuilder html = new StringBuilder();
        // INSTRUCTIONS AND DEFINITIONS — from facts field
        if (response.getFacts() != null && !response.getFacts().isBlank()) {
            html.append("<h2>INSTRUCTIONS AND DEFINITIONS</h2>\n");
            renderParagraphs(html, response.getFacts());
        }
        // APPLICABLE RULES — from legalStandard field (brief reference, rendered inline)
        if (response.getLegalStandard() != null && !response.getLegalStandard().isBlank()) {
            renderParagraphs(html, response.getLegalStandard());
        }
        // REQUESTS/INTERROGATORIES — from arguments field, rendered as numbered items with section heading
        if (response.getArguments() != null && !response.getArguments().isEmpty()) {
            html.append("<h2>REQUESTS</h2>\n");
            int num = 1;
            for (AiDocumentResponse.ArgumentSection arg : response.getArguments()) {
                html.append("<p style=\"text-indent:36pt; margin-top:12px;\"><strong>")
                    .append(num).append(". ");
                if (arg.getHeading() != null && !arg.getHeading().isBlank()) {
                    html.append(arg.getHeading());
                }
                html.append("</strong></p>\n");
                if (arg.getBody() != null && !arg.getBody().isBlank()) {
                    renderParagraphs(html, arg.getBody());
                }
                num++;
            }
        }
        return html.toString();
    }

    /** Resolve a sensible default title for discovery documents based on the raw type name. */
    private String resolveDiscoveryDefaultTitle(String documentType) {
        if (documentType != null) {
            String lower = documentType.toLowerCase();
            if (lower.contains("interrogator")) return "INTERROGATORIES";
        }
        return "REQUEST FOR PRODUCTION OF DOCUMENTS";
    }

    /** Shared: render argument subsections with letter headings (A., B., C.) */
    private void renderArgumentSubsections(StringBuilder html, List<AiDocumentResponse.ArgumentSection> arguments) {
        for (AiDocumentResponse.ArgumentSection arg : arguments) {
            String letter = arg.getLetter() != null ? arg.getLetter() + ".  " : "";
            html.append("<h3>").append(letter).append(arg.getHeading()).append("</h3>\n");
            if (arg.getBody() != null && !arg.getBody().isBlank()) {
                renderParagraphs(html, arg.getBody());
            }
        }
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
        renderParagraphs(html, text, true);
    }

    /**
     * Render paragraphs from newline-separated text.
     * @param indent if true, adds 36pt text-indent (court filings); if false, block-style (letters)
     */
    private void renderParagraphs(StringBuilder html, String text, boolean indent) {
        String[] paragraphs = text.split("\n\n+");
        for (String para : paragraphs) {
            String trimmed = para.trim();
            if (!trimmed.isEmpty()) {
                if (indent) {
                    html.append("<p style=\"text-indent:36pt\">").append(convertInlineMarkdown(trimmed.replace("\n", " "))).append("</p>\n");
                } else {
                    html.append("<p>").append(convertInlineMarkdown(trimmed.replace("\n", " "))).append("</p>\n");
                }
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

    /** Render paragraphs as numbered allegations for complaints. Strips AI-added numbering to re-number consistently. */
    private void renderNumberedParagraphs(StringBuilder html, String text) {
        String[] paragraphs = text.split("\n\n+");
        int num = 1;
        for (String para : paragraphs) {
            String trimmed = para.trim();
            if (!trimmed.isEmpty()) {
                // Strip leading number if AI already numbered them (e.g., "1. On December...")
                String cleaned = trimmed.replaceFirst("^\\d+\\.\\s*", "");
                html.append("<p style=\"text-indent:36pt\">")
                    .append(num).append(". ")
                    .append(convertInlineMarkdown(cleaned.replace("\n", " ")))
                    .append("</p>\n");
                num++;
            }
        }
    }

    /** Convert integer to Roman numeral. Handles 1-20 via lookup, falls back to arabic for 21+. */
    private static String toRoman(int num) {
        String[] romanNumerals = {
            "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
            "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"
        };
        return num >= 1 && num <= 20 ? romanNumerals[num - 1] : String.valueOf(num);
    }

    /** Build prose conclusion text from prayer items for briefs/memoranda. */
    String renderConclusionText(AiDocumentResponse response) {
        if (response.getPrayerItems() == null || response.getPrayerItems().isEmpty()) {
            return "For the foregoing reasons, the Court should grant the relief requested herein.";
        }
        List<String> items = response.getPrayerItems().stream()
            .filter(item -> !item.toLowerCase().contains("other and further relief"))
            .toList();
        if (items.isEmpty()) {
            return "For the foregoing reasons, the Court should grant the relief requested herein.";
        }
        StringBuilder sb = new StringBuilder("For the foregoing reasons, ");
        if (items.size() == 1) {
            sb.append("the Court should ").append(lowercaseFirst(items.get(0))).append(".");
        } else {
            sb.append("the Court should: ");
            for (int i = 0; i < items.size(); i++) {
                sb.append("(").append(i + 1).append(") ").append(lowercaseFirst(items.get(i)));
                if (i < items.size() - 1) sb.append("; ");
            }
            sb.append(".");
        }
        return sb.toString();
    }

    /** Standard jury demand section HTML for complaints. Uses filing party label for accuracy. */
    private String renderJuryDemand(String filingPartyLabel) {
        String party = (filingPartyLabel != null && !filingPartyLabel.isBlank()) ? filingPartyLabel : "Plaintiff";
        return "<h2 style=\"text-align:center; font-size:12pt; font-weight:bold; margin:20px 0 12px 0;\">DEMAND FOR JURY TRIAL</h2>\n"
             + "<p style=\"text-indent:36pt\">" + party + " hereby demands a trial by jury on all issues triable by right.</p>\n";
    }

    /** Lowercase the first character of a string (for prose rendering of prayer items). */
    private static String lowercaseFirst(String s) {
        if (s == null || s.isEmpty()) return s;
        return Character.toLowerCase(s.charAt(0)) + s.substring(1);
    }

    // ══════════════════════════════════════════
    // Caption Resolution
    // ══════════════════════════════════════════

    /**
     * Resolve and render the caption HTML fragment for the given jurisdiction.
     * Resolution order:
     *   1. DB: state_court_configurations by stateCode + courtLevel
     *   2. DB: state_court_configurations by stateCode + DEFAULT
     *   3. File fallback: caption-default.html
     */
    private String renderCaption(DocumentTemplateData data, String jurisdiction, String courtLevel) {
        String stateCode = resolveStateCode(jurisdiction);

        // Try DB-stored caption first
        Optional<StateCourtConfiguration> configOpt = resolveStateConfig(stateCode, courtLevel);
        String captionTemplate;
        if (configOpt.isPresent() && configOpt.get().getCaptionTemplateHtml() != null) {
            captionTemplate = configOpt.get().getCaptionTemplateHtml();
            log.debug("Using DB caption template for state: {}", stateCode);
        } else {
            // File-based fallback
            captionTemplate = loadTemplate("templates/html/captions/caption-default.html");
            log.debug("Using default file caption template for state: {}", stateCode);
        }

        String rendered = injectData(captionTemplate, data);

        // Convert centered <div> to <p style="text-align:center"> so that:
        // 1. CKEditor preserves alignment (it strips align/style on <div> but keeps style on <p>)
        // 2. iText PDF renders centering (its Div object ignores text-align, Paragraph supports it)
        rendered = rendered.replaceAll(
                "(?si)<div\\s+align=\"center\"[^>]*>",
                "<p style=\"text-align:center; line-height:1.3; margin:0 0 8px 0;\">"
        );
        rendered = rendered.replace("</div>", "</p>");

        return rendered;
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
        result = replacePlaceholder(result, "comesNowSection", data.getComesNowSection());
        result = replacePlaceholder(result, "prayerIntro", data.getPrayerIntro());
        result = replacePlaceholder(result, "filingPartyLabel", data.getFilingPartyLabel());
        result = replacePlaceholder(result, "attorneyName", data.getAttorneyName());
        result = replacePlaceholder(result, "attorneyBarNumber", data.getAttorneyBarNumber());
        result = replacePlaceholder(result, "firmName", data.getFirmName());
        result = replacePlaceholder(result, "firmAddress", data.getFirmAddress());
        result = replacePlaceholder(result, "firmPhone", data.getFirmPhone());
        result = replacePlaceholder(result, "firmEmail", data.getFirmEmail());
        result = replacePlaceholder(result, "filingDate", data.getFilingDate());
        result = replacePlaceholder(result, "currentDate", data.getCurrentDate());
        result = replacePlaceholder(result, "juryDemandSection", data.getJuryDemandSection());
        result = replacePlaceholder(result, "conclusionText", data.getConclusionText());
        // Letter-specific fields
        result = replacePlaceholder(result, "letterheadHtml", data.getLetterheadHtml());
        result = replacePlaceholder(result, "recipientBlock", data.getRecipientBlock());
        result = replacePlaceholder(result, "reBlock", data.getReBlock());
        result = replacePlaceholder(result, "salutationLine", data.getSalutationLine());
        result = replacePlaceholder(result, "letterBody", data.getLetterBody());
        result = replacePlaceholder(result, "closingLine", data.getClosingLine());
        result = replacePlaceholder(result, "signatureBlockHtml", data.getSignatureBlockHtml());
        result = replacePlaceholder(result, "footerHtml", data.getFooterHtml());
        result = replacePlaceholder(result, "viaLine", data.getViaLine());
        return result;
    }

    private String replacePlaceholder(String template, String key, String value) {
        return template.replace("{{" + key + "}}", value != null ? value : "");
    }

    // ══════════════════════════════════════════
    // Helpers
    // ══════════════════════════════════════════

    /**
     * Map document type to the HTML template key.
     * Public so AiWorkspaceDocumentService can use it for type-specific prompt building.
     */
    public String resolveDocumentTemplateKey(String documentType) {
        if (documentType == null) return "motion";
        String normalized = documentType.toLowerCase().replace(" ", "_").replace("-", "_");
        if (normalized.contains("complaint")) return "complaint";
        if (normalized.contains("brief") || normalized.contains("memorandum")) return "brief";
        if (normalized.contains("discovery") || normalized.contains("interrogator")) return "discovery";
        if (isLetterDocumentType(documentType)) return "letter";
        if (isContractDocumentType(documentType)) return "contract";
        if (normalized.contains("motion")) return "motion";
        if (normalized.contains("petition")) return "motion";  // Petitions use motion structure
        if (normalized.contains("pleading")) return "motion";   // Generic pleadings use motion structure
        return "motion"; // Default
    }

    /**
     * Resolve state court configuration from DB with caching.
     * Tries exact stateCode + courtLevel first, then stateCode + DEFAULT.
     * Uses get/putIfAbsent pattern to avoid nested computeIfAbsent deadlock on ConcurrentHashMap.
     */
    private Optional<StateCourtConfiguration> resolveStateConfig(String stateCode, String courtLevel) {
        String cacheKey = stateCode + "_" + courtLevel;
        Optional<StateCourtConfiguration> cached = configCache.get(cacheKey);
        if (cached != null) return cached;

        // Try exact match first
        Optional<StateCourtConfiguration> config = stateCourtConfigRepository
                .findByStateCodeAndCourtLevelAndIsActiveTrue(stateCode, courtLevel);

        // If not found and courtLevel wasn't DEFAULT, try DEFAULT as fallback
        if (config.isEmpty() && !"DEFAULT".equals(courtLevel)) {
            config = stateCourtConfigRepository
                    .findByStateCodeAndCourtLevelAndIsActiveTrue(stateCode, "DEFAULT");
        }

        // Only cache non-empty results — empty results should be retried
        // so that newly added configs are picked up without a restart
        if (config.isPresent()) {
            configCache.putIfAbsent(cacheKey, config);
        }
        return config;
    }

    /**
     * Get the state court configuration for a jurisdiction. Public access for other services.
     */
    public Optional<StateCourtConfiguration> getStateConfig(String jurisdiction) {
        return getStateConfig(jurisdiction, "DEFAULT");
    }

    /**
     * Get the state court configuration for a jurisdiction and court level.
     */
    public Optional<StateCourtConfiguration> getStateConfig(String jurisdiction, String courtLevel) {
        String stateCode = resolveStateCode(jurisdiction);
        String effectiveCourtLevel = (courtLevel != null && !courtLevel.isBlank()) ? courtLevel : "DEFAULT";
        return resolveStateConfig(stateCode, effectiveCourtLevel);
    }

    /**
     * Clear the config cache. Called by admin controller after state court config edits.
     */
    public void clearConfigCache() {
        configCache.clear();
        log.info("State court configuration cache cleared");
    }

    /**
     * Determine if a case is criminal by checking multiple fields:
     * practice area, primary charge, charge level, and case title pattern.
     */
    public boolean isCriminalCase(LegalCase legalCase) {
        if (legalCase == null) return false;

        // 1. Check practice area
        String practiceArea = legalCase.getEffectivePracticeArea();
        if (practiceArea != null) {
            String lower = practiceArea.toLowerCase();
            if (lower.contains("criminal") || lower.contains("dwi") || lower.contains("dui")
                    || lower.contains("felony") || lower.contains("misdemeanor")) {
                return true;
            }
        }

        // 2. If primary charge or charge level is populated, it's criminal
        if (legalCase.getPrimaryCharge() != null && !legalCase.getPrimaryCharge().isBlank()) {
            return true;
        }
        if (legalCase.getChargeLevel() != null && !legalCase.getChargeLevel().isBlank()) {
            return true;
        }

        // 3. Check case title for criminal indicators
        String title = legalCase.getTitle();
        if (title != null) {
            String lower = title.toLowerCase();
            // Prosecution naming patterns are reliable (can appear anywhere in title)
            if (lower.contains("state v.") || lower.contains("state v ")
                    || lower.contains("people v.") || lower.contains("people v ")
                    || lower.contains("commonwealth v.") || lower.contains("commonwealth v ")
                    || lower.contains("united states v.") || lower.contains("united states v ")) {
                return true;
            }
            // Crime keywords are only reliable WITH a prosecution pattern — without it,
            // "assault" could be a civil tort, "battery" a product name, etc.
            // These are already covered by practice area and charge fields above.
        }

        return false;
    }

    /**
     * Filter out session/courtroom identifiers that are NOT real court names.
     * e.g., "Session 9", "Courtroom 3A", "Department 12" are NOT court names.
     */
    private boolean looksLikeCourtName(String value) {
        if (value == null) return false;
        String lower = value.toLowerCase().trim();
        return !lower.startsWith("session") && !lower.startsWith("courtroom")
                && !lower.startsWith("department") && !lower.startsWith("div ")
                && !lower.matches("^\\d+.*")
                && lower.length() > 5;
    }

    /**
     * Format attorney office address components into a single line.
     * e.g., "123 Main St, Suite 400, Boston, MA 02101"
     */
    private String buildOfficeAddress(Attorney attorney) {
        StringBuilder addr = new StringBuilder();
        if (attorney.getOfficeStreet() != null && !attorney.getOfficeStreet().isBlank()) {
            addr.append(attorney.getOfficeStreet().trim());
        }
        if (attorney.getOfficeSuite() != null && !attorney.getOfficeSuite().isBlank()) {
            if (addr.length() > 0) addr.append(", ");
            addr.append(attorney.getOfficeSuite().trim());
        }
        if (attorney.getOfficeCity() != null && !attorney.getOfficeCity().isBlank()) {
            if (addr.length() > 0) addr.append(", ");
            addr.append(attorney.getOfficeCity().trim());
        }
        if (attorney.getOfficeState() != null && !attorney.getOfficeState().isBlank()) {
            if (addr.length() > 0) addr.append(", ");
            addr.append(attorney.getOfficeState().trim());
        }
        if (attorney.getOfficeZip() != null && !attorney.getOfficeZip().isBlank()) {
            if (addr.length() > 0) addr.append(" ");
            addr.append(attorney.getOfficeZip().trim());
        }
        return addr.toString();
    }

    private String resolveStateCode(String jurisdiction) {
        if (jurisdiction == null || jurisdiction.isBlank()) return "TX";
        String trimmed = jurisdiction.trim();
        // If it's already a 2-letter state code, validate and return it
        if (trimmed.length() == 2) {
            String upper = trimmed.toUpperCase();
            if (jurisdictionResolver.getStateName(upper) != null) return upper;
        }
        String code = jurisdictionResolver.getStateCode(trimmed);
        if (code != null) return code;
        log.warn("Unknown jurisdiction '{}', falling back to default", jurisdiction);
        return "TX";
    }
}
