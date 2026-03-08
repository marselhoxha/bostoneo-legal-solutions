package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.AttorneyInfoDTO;
import com.bostoneo.bostoneosolutions.dto.StationeryRenderResponse;
import com.bostoneo.bostoneosolutions.model.AIStyleGuide;
import com.bostoneo.bostoneosolutions.model.Attorney;
import com.bostoneo.bostoneosolutions.model.Organization;
import com.bostoneo.bostoneosolutions.model.User;
import com.bostoneo.bostoneosolutions.repository.AIStyleGuideRepository;
import com.bostoneo.bostoneosolutions.repository.AttorneyRepository;
import com.bostoneo.bostoneosolutions.repository.OrganizationRepository;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class StationeryService {

    private final AIStyleGuideRepository styleGuideRepository;
    private final AttorneyRepository attorneyRepository;
    private final OrganizationRepository organizationRepository;
    private final EntityManager entityManager;

    /**
     * List stationery templates for the organization — only templates that have
     * at least one stationery field populated (letterhead, signature, or footer).
     */
    public List<AIStyleGuide> getTemplates(Long orgId) {
        return styleGuideRepository.findByOrganizationIdAndIsActiveTrue(orgId).stream()
                .filter(sg -> hasStationeryContent(sg))
                .collect(Collectors.toList());
    }

    /**
     * Get a single template, validated against the organization.
     */
    public AIStyleGuide getTemplate(Long id, Long orgId) {
        return styleGuideRepository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new IllegalArgumentException("Template not found or access denied"));
    }

    /**
     * Create or update a stationery template. Sets orgId from caller.
     */
    public AIStyleGuide saveTemplate(AIStyleGuide template, Long orgId, Long userId) {
        template.setOrganizationId(orgId);

        // If setting as default, clear default flag on all other templates in this org
        if (Boolean.TRUE.equals(template.getIsDefault())) {
            styleGuideRepository.findByOrganizationIdAndIsActiveTrue(orgId).stream()
                    .filter(sg -> !sg.getId().equals(template.getId()) && Boolean.TRUE.equals(sg.getIsDefault()))
                    .forEach(sg -> {
                        sg.setIsDefault(false);
                        styleGuideRepository.save(sg);
                    });
        }

        if (template.getId() != null) {
            // Update: verify it belongs to this org
            AIStyleGuide existing = getTemplate(template.getId(), orgId);
            existing.setName(template.getName());
            existing.setDescription(template.getDescription());
            existing.setLetterheadTemplate(template.getLetterheadTemplate());
            existing.setSignatureBlocks(template.getSignatureBlocks());
            existing.setFooterTemplate(template.getFooterTemplate());
            existing.setFormattingPreferences(template.getFormattingPreferences());
            existing.setIsDefault(template.getIsDefault());
            return styleGuideRepository.save(existing);
        } else {
            template.setCreatedBy(userId);
            template.setIsActive(true);
            return styleGuideRepository.save(template);
        }
    }

    /**
     * Soft-delete a template.
     */
    public void deleteTemplate(Long id, Long orgId) {
        AIStyleGuide template = getTemplate(id, orgId);
        template.setIsActive(false);
        styleGuideRepository.save(template);
    }

    /**
     * Render stationery by replacing placeholders in the template with attorney + org data.
     */
    public StationeryRenderResponse renderStationery(Long templateId, Long attorneyId, Long orgId) {
        AIStyleGuide template = getTemplate(templateId, orgId);
        Attorney attorney = attorneyRepository.findByIdAndOrganizationId(attorneyId, orgId)
                .orElseThrow(() -> new IllegalArgumentException("Attorney not found or access denied"));

        // Load user for name
        User user = entityManager.find(User.class, attorney.getUserId());
        if (user == null) {
            throw new IllegalArgumentException("Attorney's user record not found");
        }

        // Load organization for firm info
        Organization org = organizationRepository.findById(orgId)
                .orElseThrow(() -> new IllegalArgumentException("Organization not found"));

        String attorneyName = (user.getFirstName() != null ? user.getFirstName() : "") + " " +
                              (user.getLastName() != null ? user.getLastName() : "");
        attorneyName = attorneyName.trim();

        String today = LocalDate.now().format(DateTimeFormatter.ofPattern("MMMM d, yyyy"));

        String letterhead = ensureFontFamily(stripEmptyContactLines(
                replacePlaceholders(template.getLetterheadTemplate(), attorneyName, attorney, org, today)));
        String signature = ensureFontFamily(replacePlaceholders(template.getSignatureBlocks(), attorneyName, attorney, org, today));
        String footer = ensureFontFamily(replacePlaceholders(template.getFooterTemplate(), attorneyName, attorney, org, today));

        return StationeryRenderResponse.builder()
                .letterheadHtml(letterhead)
                .signatureBlockHtml(signature)
                .footerHtml(footer)
                .build();
    }

    /**
     * List attorneys for the dropdown, with user names joined.
     */
    public List<AttorneyInfoDTO> getAttorneysForOrg(Long orgId) {
        return attorneyRepository.findAttorneyInfoByOrganizationId(orgId).stream()
                .map(row -> AttorneyInfoDTO.builder()
                        .id((Long) row[0])
                        .firstName((String) row[1])
                        .lastName((String) row[2])
                        .barNumber((String) row[3])
                        .licenseState((String) row[4])
                        .build())
                .collect(Collectors.toList());
    }

    private String replacePlaceholders(String html, String attorneyName, Attorney attorney, Organization org, String date) {
        if (html == null || html.isBlank()) return "";
        return html
                .replace("{{attorney_name}}", safe(attorneyName))
                .replace("{{bar_number}}", safe(attorney.getBarNumber()))
                .replace("{{license_state}}", safe(attorney.getLicenseState()))
                .replace("{{firm_name}}", safe(org.getName()))
                .replace("{{firm_address}}", safe(org.getAddress()))
                .replace("{{firm_phone}}", safe(org.getPhone()))
                .replace("{{firm_email}}", safe(org.getEmail()))
                .replace("{{firm_website}}", safe(org.getWebsite()))
                .replace("{{firm_logo_url}}", safe(org.getLogoUrl()))
                .replace("{{date}}", safe(date));
    }

    /**
     * Build a plain-text description of the stationery for AI prompt injection.
     * Tells the AI what's already in the letterhead so it doesn't duplicate it.
     */
    public String getStationeryContextForPrompt(Long templateId, Long attorneyId, Long orgId) {
        // Load template to check which sections actually have content
        AIStyleGuide template = styleGuideRepository.findByIdAndOrganizationId(templateId, orgId).orElse(null);
        if (template == null) return null;

        Attorney attorney = attorneyRepository.findByIdAndOrganizationId(attorneyId, orgId).orElse(null);
        if (attorney == null) return null;

        User user = entityManager.find(User.class, attorney.getUserId());
        Organization org = organizationRepository.findById(orgId).orElse(null);
        if (user == null || org == null) return null;

        boolean hasLetterhead = isNotBlank(template.getLetterheadTemplate());
        boolean hasSignature = isNotBlank(template.getSignatureBlocks());
        boolean hasFooter = isNotBlank(template.getFooterTemplate());

        if (!hasLetterhead && !hasSignature && !hasFooter) return null;

        String attorneyName = (safe(user.getFirstName()) + " " + safe(user.getLastName())).trim();
        StringBuilder ctx = new StringBuilder();
        ctx.append("This document has firm letterhead stationery applied.\n");
        ctx.append("Letterhead firm: ").append(safe(org.getName())).append("\n");
        ctx.append("Letterhead attorney: ").append(attorneyName);
        if (attorney.getBarNumber() != null) {
            ctx.append(" (").append(safe(attorney.getLicenseState())).append(" Bar #").append(attorney.getBarNumber()).append(")");
        }
        ctx.append("\n");
        if (user.getEmail() != null) ctx.append("Attorney email: ").append(user.getEmail()).append("\n");
        if (user.getPhone() != null) ctx.append("Attorney phone: ").append(user.getPhone()).append("\n");
        if (org.getAddress() != null) ctx.append("Firm address in letterhead: ").append(org.getAddress()).append("\n");
        if (org.getPhone() != null) ctx.append("Firm phone in letterhead: ").append(org.getPhone()).append("\n");
        // Tell AI which sections are present so it only skips what's actually in the stationery
        ctx.append("Stationery sections present:");
        if (hasLetterhead) ctx.append(" LETTERHEAD");
        if (hasSignature) ctx.append(" SIGNATURE");
        if (hasFooter) ctx.append(" FOOTER");
        ctx.append("\n");
        return ctx.toString();
    }

    /**
     * Get the logged-in user's own attorney profile (for one-click stationery apply).
     */
    public AttorneyInfoDTO getMyAttorneyProfile(Long userId, Long orgId) {
        Attorney attorney = attorneyRepository.findByUserIdAndOrganizationId(userId, orgId).orElse(null);
        if (attorney == null || !Boolean.TRUE.equals(attorney.getIsActive())) return null;

        User user = entityManager.find(User.class, attorney.getUserId());
        if (user == null) return null;

        return AttorneyInfoDTO.builder()
                .id(attorney.getId())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .barNumber(attorney.getBarNumber())
                .licenseState(attorney.getLicenseState())
                .build();
    }

    private boolean hasStationeryContent(AIStyleGuide sg) {
        return isNotBlank(sg.getLetterheadTemplate()) ||
               isNotBlank(sg.getSignatureBlocks()) ||
               isNotBlank(sg.getFooterTemplate());
    }

    private boolean isNotBlank(String s) {
        return s != null && !s.isBlank();
    }

    /**
     * After placeholder replacement, strip contact lines that have only a label prefix
     * with no actual value (e.g., "Tel: " with empty phone, "Fax: " with empty fax).
     */
    private String stripEmptyContactLines(String html) {
        if (html == null || html.isBlank()) return html;
        // Remove <p> tags that are empty or contain only a label prefix with no value
        // Matches: <p style="..."></p>, <p style="...">  </p>, <p style="...">Tel: </p>, etc.
        html = html.replaceAll("<p[^>]*>\\s*(p:|f:|Tel:|Fax:|Email:|Website:|Address:)?\\s*</p>\\n?", "");
        // Also remove completely empty paragraphs (from resolved-to-empty placeholders)
        html = html.replaceAll("<p[^>]*>\\s*</p>\\n?", "");
        return html;
    }

    /**
     * Post-process rendered HTML to inject inline font-family on all <td> and <p> elements.
     * CKEditor's global .ck { font-family: sans-serif !important } overrides inherited styles,
     * so we must use inline styles to guarantee serif fonts in stationery.
     */
    private String ensureFontFamily(String html) {
        if (html == null || html.isBlank()) return html;
        String font = "font-family:'Times New Roman',Georgia,serif;";
        // Add font-family to <td> and <p> that have a style attribute but no font-family in it
        html = html.replaceAll(
                "<(td|p)(\\s+style=\")(?![^\"]*font-family)([^\"]*)(\")",
                "<$1$2" + font + "$3$4");
        // Add font-family to <td> and <p> that have NO style attribute at all
        html = html.replaceAll(
                "<(td|p)(\\s+)(?!style=)",
                "<$1 style=\"" + font + "\"$2");
        // Handle self-contained <td> or <p> with no attributes at all (e.g., <p>)
        html = html.replaceAll(
                "<(td|p)>",
                "<$1 style=\"" + font + "\">");
        return html;
    }

    private String safe(String value) {
        return value != null ? value : "";
    }
}
