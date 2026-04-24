package com.bostoneo.bostoneosolutions.service.ai;

import com.bostoneo.bostoneosolutions.dto.ai.DocumentTypeTemplate;
import com.bostoneo.bostoneosolutions.dto.ai.GatingContext;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;

/**
 * Computes gating state for a generated document and applies the disclaimer
 * footer. The DRAFT indicator is rendered by the UI as a CSS watermark bound
 * to {@link GatingContext#approvalStatus()} (see ai-workspace.component.scss)
 * — no banner text is injected into the document body, which keeps the
 * generated content clean for PDF/DOCX export and for inline editing.
 *
 * Design notes:
 *  - {@link GatingContext} is a snapshot per request — never mutate the
 *    shared {@link DocumentTypeTemplate} registry instance.
 *  - Overdue check is warn-only for v1 (per §6.1 behavior). If the review
 *    date is missing or malformed, we treat the document as not overdue —
 *    a bad date must not block generation.
 */
@Service
@Slf4j
public class DocumentGatingService {

    private static final String HTML_MARKER = "<!-- HTML_TEMPLATE -->";

    /**
     * Build a {@link GatingContext} from the resolved template's §6.1 fields.
     * When {@code template} is null (cascade miss / legacy type), returns a
     * null-approval context that skips watermarking and disclaimer rendering.
     */
    public GatingContext computeGating(DocumentTypeTemplate template) {
        if (template == null) {
            return new GatingContext(null, false, null, null, null, null, null);
        }

        boolean overdue = isOverdue(template.getNextReviewDue());

        return new GatingContext(
                template.getApprovalStatus(),
                overdue,
                template.getType(),
                template.getTemplateVersion(),
                template.getLastVerified(),
                template.getNextReviewDue(),
                template.getDisclaimer()
        );
    }

    /**
     * Append the disclaimer footer to the generated content. The DRAFT/
     * IN_REVIEW indicator itself is not baked into the body — the UI reads
     * {@link GatingContext#approvalStatus()} from the response and renders
     * a CSS watermark overlay that disappears once the document is approved.
     * Detects HTML vs. markdown from the leading
     * {@code <!-- HTML_TEMPLATE -->} marker emitted by
     * {@link com.bostoneo.bostoneosolutions.service.DocumentTemplateEngine}.
     *
     * Idempotent: if the disclaimer text is already present (from a
     * regeneration), we do not double-stamp.
     */
    public String applyContentGating(String content, GatingContext gating) {
        if (content == null || gating == null) return content;

        boolean isHtml = content.startsWith(HTML_MARKER);
        String footer = buildFooter(gating, isHtml);

        if (footer.isEmpty() || content.contains(gating.disclaimer())) {
            return content;
        }

        return content + footer;
    }

    private String buildFooter(GatingContext gating, boolean isHtml) {
        if (!gating.hasDisclaimer()) return "";

        if (isHtml) {
            return "\n<hr style=\"margin-top:32px;border:none;border-top:1px solid #e5e7eb;\"/>\n"
                    + "<p class=\"gating-disclaimer\" style=\"margin-top:12px;font-size:11px;color:#6b7280;font-style:italic;line-height:1.5;\">"
                    + escapeHtml(gating.disclaimer())
                    + "</p>\n";
        }
        return "\n\n---\n\n*" + gating.disclaimer() + "*\n";
    }

    private boolean isOverdue(String nextReviewDue) {
        if (nextReviewDue == null || nextReviewDue.isBlank()) return false;
        try {
            LocalDate due = LocalDate.parse(nextReviewDue);
            return LocalDate.now().isAfter(due);
        } catch (DateTimeParseException e) {
            log.warn("Malformed nextReviewDue date '{}' — skipping overdue check", nextReviewDue);
            return false;
        }
    }

    private String escapeHtml(String s) {
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;");
    }
}
