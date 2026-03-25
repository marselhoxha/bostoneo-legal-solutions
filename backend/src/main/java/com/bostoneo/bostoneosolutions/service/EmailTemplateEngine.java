package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.email.EmailBranding;
import com.bostoneo.bostoneosolutions.dto.email.EmailContent;
import com.bostoneo.bostoneosolutions.dto.email.EmailContent.CtaButton;
import com.bostoneo.bostoneosolutions.dto.email.EmailContent.DetailCard;
import com.bostoneo.bostoneosolutions.dto.email.EmailContent.InfoBox;
import com.bostoneo.bostoneosolutions.dto.email.EmailContent.MfaCode;
import com.bostoneo.bostoneosolutions.dto.email.EmailContent.UrgencyBanner;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * Centralized HTML email renderer. Takes {@link EmailBranding} + {@link EmailContent}
 * and produces a complete, inline-styled HTML string compatible with Gmail, Outlook,
 * Apple Mail, and other major email clients.
 *
 * <p>All styles are inline — no {@code <style>} blocks — because Gmail and Outlook
 * strip them.</p>
 */
@Slf4j
@Component
public class EmailTemplateEngine {

    private static final String FONT_FAMILY =
            "-apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
    private static final String MONO_FONT =
            "'SF Mono', 'Fira Code', Consolas, monospace";

    // Layout
    private static final String BG_COLOR       = "#e8eaed";
    private static final String CARD_BG        = "#ffffff";
    private static final String FOOTER_BG      = "#f9fafb";
    private static final String FOOTER_BORDER  = "#eef0f4";

    // Text colors
    private static final String TEXT_DARK       = "#111827";
    private static final String TEXT_MEDIUM     = "#374151";
    private static final String TEXT_LIGHT      = "#6b7280";
    private static final String TEXT_MUTED      = "#9ca3af";
    private static final String TEXT_FAINT      = "#d1d5db";

    // MFA digit box
    private static final String MFA_BG         = "#f0f4ff";
    private static final String MFA_BORDER     = "#dce3f5";
    private static final String MFA_TEXT       = "#1e56b6";

    // Detail card
    private static final String CARD_DETAIL_BG = "#f9fafb";

    // Divider
    private static final String DIVIDER_COLOR  = "#f3f4f6";

    // ─────────────────────────────────────────────────────────────────────
    //  Public API
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Renders a complete HTML email from branding and content.
     *
     * @param branding firm/platform branding context
     * @param content  the email body, cards, buttons, etc.
     * @return complete HTML document string
     */
    public String render(EmailBranding branding, EmailContent content) {
        StringBuilder sb = new StringBuilder(4096);

        // DOCTYPE + html + head
        sb.append("<!DOCTYPE html>");
        sb.append("<html lang=\"en\">");
        sb.append("<head><meta charset=\"utf-8\">");
        sb.append("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">");
        sb.append("<title>Email</title></head>");

        // Body with background
        sb.append("<body style=\"margin:0; padding:0; background-color:").append(BG_COLOR)
          .append("; font-family:").append(FONT_FAMILY).append(";\">");

        // Outer centering table
        sb.append("<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"background-color:")
          .append(BG_COLOR).append(";\">");
        sb.append("<tr><td align=\"center\" style=\"padding:32px 16px;\">");

        // Card wrapper
        sb.append("<table width=\"600\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width:600px; width:100%; ")
          .append("background-color:").append(CARD_BG).append("; border-radius:12px; ")
          .append("box-shadow:0 4px 16px rgba(0,0,0,0.08); overflow:hidden;\">");

        // 1. Urgency banner (optional)
        if (content.getUrgency() != null) {
            sb.append(buildUrgencyBanner(content.getUrgency()));
        }

        // 2. Header
        sb.append(buildHeader(branding));

        // 3. Content area
        sb.append("<tr><td style=\"padding:0 44px 40px; font-family:").append(FONT_FAMILY).append(";\">");

        // Greeting
        String greeting = content.getGreeting() != null
                ? escapeHtml(content.getGreeting())
                : "Hello " + escapeHtml(content.getRecipientName()) + ",";
        sb.append("<p style=\"font-size:18px; font-weight:600; color:").append(TEXT_DARK)
          .append("; margin:0 0 18px; font-family:").append(FONT_FAMILY).append(";\">")
          .append(greeting).append("</p>");

        // Body paragraphs
        List<String> paragraphs = content.getBodyParagraphs();
        if (paragraphs != null) {
            for (int i = 0; i < paragraphs.size(); i++) {
                boolean isLast = (i == paragraphs.size() - 1)
                        && content.getDetailCard() == null
                        && content.getMfaCode() == null
                        && content.getInfoBox() == null
                        && content.getCtaButton() == null;
                String marginBottom = isLast ? "0" : "14px";
                sb.append("<p style=\"font-size:15px; line-height:1.7; color:").append(TEXT_LIGHT)
                  .append("; margin:0 0 ").append(marginBottom)
                  .append("; font-family:").append(FONT_FAMILY).append(";\">")
                  .append(paragraphs.get(i)) // Allow inline HTML — content is backend-controlled, not user input
                  .append("</p>");
            }
        }

        // Detail card (optional)
        if (content.getDetailCard() != null) {
            sb.append(buildDetailCard(content.getDetailCard(), branding.getPrimaryColor()));
        }

        // MFA code (optional)
        if (content.getMfaCode() != null) {
            sb.append(buildMfaCode(content.getMfaCode()));
        }

        // Info box (optional)
        if (content.getInfoBox() != null) {
            sb.append(buildInfoBox(content.getInfoBox()));
        }

        // CTA button (optional)
        if (content.getCtaButton() != null) {
            sb.append(buildCtaButton(content.getCtaButton(), branding.getPrimaryColor()));
        }

        // Sign-off
        if (content.getSignOffName() != null) {
            sb.append(buildSignOff(content.getSignOffName()));
        }

        sb.append("</td></tr>"); // end content area

        // 4. Footer
        sb.append(buildFooter(branding, content.getFooterNote()));

        // Close card, centering table, body, html
        sb.append("</table>");  // card
        sb.append("</td></tr></table>"); // centering
        sb.append("</body></html>");

        return sb.toString();
    }

    // ─────────────────────────────────────────────────────────────────────
    //  Private helpers
    // ─────────────────────────────────────────────────────────────────────

    private String buildUrgencyBanner(UrgencyBanner urgency) {
        String bgColor;
        String textColor;
        if ("red".equalsIgnoreCase(urgency.getLevel())) {
            bgColor = "#fef2f2";
            textColor = "#991b1b";
        } else {
            // amber (default)
            bgColor = "#fffbeb";
            textColor = "#92400e";
        }

        return "<tr><td style=\"background-color:" + bgColor
                + "; padding:12px 44px; text-align:center; font-family:" + FONT_FAMILY
                + "; font-size:12px; font-weight:700; color:" + textColor
                + "; text-transform:uppercase; letter-spacing:0.5px;\">"
                + escapeHtml(urgency.getText())
                + "</td></tr>";
    }

    private String buildHeader(EmailBranding branding) {
        StringBuilder sb = new StringBuilder();
        sb.append("<tr><td style=\"padding:44px 40px 36px; text-align:center; font-family:")
          .append(FONT_FAMILY).append(";\">");

        if (branding.getLogoUrl() != null && !branding.getLogoUrl().isBlank()) {
            sb.append("<img src=\"").append(escapeHtml(branding.getLogoUrl()))
              .append("\" alt=\"").append(escapeHtml(branding.getName()))
              .append("\" style=\"height:24px; width:auto; display:inline-block;\">");
        } else {
            sb.append("<span style=\"font-size:24px; font-weight:700; color:")
              .append(escapeHtml(branding.getPrimaryColor()))
              .append("; letter-spacing:-0.3px;\">")
              .append(escapeHtml(branding.getName()))
              .append("</span>");
        }

        sb.append("</td></tr>");
        return sb.toString();
    }

    private String buildMfaCode(MfaCode mfaCode) {
        String code = mfaCode.getCode();
        if (code == null || code.isBlank()) {
            return "";
        }

        StringBuilder sb = new StringBuilder();
        sb.append("<table cellpadding=\"0\" cellspacing=\"0\" style=\"margin:0 auto 32px; border-collapse:separate;\">");
        sb.append("<tr>");

        for (int i = 0; i < code.length(); i++) {
            String paddingLeft = (i == 0) ? "0" : "6px";
            sb.append("<td style=\"padding-left:").append(paddingLeft).append(";\">");
            sb.append("<table cellpadding=\"0\" cellspacing=\"0\"><tr>");
            sb.append("<td style=\"width:52px; height:64px; background-color:").append(MFA_BG)
              .append("; border:1px solid ").append(MFA_BORDER)
              .append("; border-radius:10px; text-align:center; vertical-align:middle;")
              .append(" font-family:").append(MONO_FONT)
              .append("; font-size:32px; font-weight:700; color:").append(MFA_TEXT).append(";\">");
            sb.append(escapeHtml(String.valueOf(code.charAt(i))));
            sb.append("</td></tr></table>");
            sb.append("</td>");
        }

        sb.append("</tr></table>");
        return sb.toString();
    }

    private String buildDetailCard(DetailCard card, String defaultColor) {
        String accentColor = (card.getAccentColor() != null && !card.getAccentColor().isBlank())
                ? card.getAccentColor() : defaultColor;

        StringBuilder sb = new StringBuilder();
        sb.append("<div style=\"background-color:").append(CARD_DETAIL_BG)
          .append("; border-left:3px solid ").append(escapeHtml(accentColor))
          .append("; padding:22px 24px; border-radius:0 8px 8px 0; margin:0 0 28px;\">");

        // Title
        if (card.getTitle() != null) {
            sb.append("<p style=\"font-size:17px; font-weight:700; color:").append(TEXT_DARK)
              .append("; margin:0 0 14px; font-family:").append(FONT_FAMILY).append(";\">")
              .append(escapeHtml(card.getTitle()))
              .append("</p>");
        }

        // Rows
        List<Map.Entry<String, String>> rows = card.getRows();
        if (rows != null) {
            for (int i = 0; i < rows.size(); i++) {
                Map.Entry<String, String> row = rows.get(i);
                String marginBottom = (i < rows.size() - 1) ? "6px" : "0";
                sb.append("<p style=\"font-size:14px; color:").append(TEXT_LIGHT)
                  .append("; margin:0 0 ").append(marginBottom)
                  .append("; font-family:").append(FONT_FAMILY).append(";\">");
                sb.append("<strong style=\"color:").append(TEXT_MEDIUM)
                  .append("; display:inline-block; min-width:95px;\">")
                  .append(escapeHtml(row.getKey()))
                  .append("</strong> ")
                  .append(escapeHtml(row.getValue()));
                sb.append("</p>");
            }
        }

        // Highlight amount
        if (card.getHighlightAmount() != null && !card.getHighlightAmount().isBlank()) {
            String hlColor = (card.getHighlightColor() != null && !card.getHighlightColor().isBlank())
                    ? card.getHighlightColor() : accentColor;
            sb.append("<p style=\"font-size:30px; font-weight:700; color:")
              .append(escapeHtml(hlColor))
              .append("; margin:14px 0 0; font-family:").append(FONT_FAMILY).append(";\">")
              .append(escapeHtml(card.getHighlightAmount()))
              .append("</p>");
        }

        sb.append("</div>");
        return sb.toString();
    }

    private String buildCtaButton(CtaButton button, String color) {
        if (button.getText() == null || button.getUrl() == null) {
            return "";
        }

        StringBuilder sb = new StringBuilder();
        sb.append("<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"margin:0 0 16px;\"><tr><td align=\"center\">");
        sb.append("<table cellpadding=\"0\" cellspacing=\"0\"><tr>");
        sb.append("<td style=\"background-color:").append(escapeHtml(color))
          .append("; border-radius:8px; padding:14px 44px;\">");
        sb.append("<a href=\"").append(escapeHtml(button.getUrl()))
          .append("\" style=\"color:#ffffff; text-decoration:none; font-size:15px; font-weight:600; font-family:")
          .append(FONT_FAMILY).append("; display:inline-block;\">")
          .append(escapeHtml(button.getText()))
          .append("</a>");
        sb.append("</td></tr></table>");
        sb.append("</td></tr></table>");

        // Show raw URL below button if it looks like a plain URL
        String url = button.getUrl();
        if (url.startsWith("http://") || url.startsWith("https://")) {
            sb.append("<p style=\"font-size:12px; color:").append(TEXT_FAINT)
              .append("; text-align:center; word-break:break-all; margin:0 0 16px; font-family:")
              .append(FONT_FAMILY).append(";\">")
              .append(escapeHtml(url))
              .append("</p>");
        }

        return sb.toString();
    }

    private String buildInfoBox(InfoBox box) {
        if (box.getHtml() == null) {
            return "";
        }

        String bgColor;
        String textColor;
        if ("blue".equalsIgnoreCase(box.getLevel())) {
            bgColor = "#eff6ff";
            textColor = "#1e40af";
        } else {
            // amber (default)
            bgColor = "#fffbeb";
            textColor = "#92400e";
        }

        return "<div style=\"background-color:" + bgColor
                + "; border-radius:8px; padding:16px 20px; margin:0 0 32px;\">"
                + "<p style=\"font-size:13px; color:" + textColor
                + "; line-height:1.6; margin:0; font-family:" + FONT_FAMILY + ";\">"
                + box.getHtml()  // intentionally NOT escaped — allows inline HTML
                + "</p></div>";
    }

    private String buildSignOff(String signOffName) {
        return "<div style=\"border-top:1px solid " + DIVIDER_COLOR + "; margin:0 0 24px;\"></div>"
                + "<p style=\"font-size:14px; color:" + TEXT_LIGHT
                + "; line-height:1.7; margin:0; font-family:" + FONT_FAMILY + ";\">"
                + "Best regards,<br><strong style=\"color:" + TEXT_MEDIUM + ";\">"
                + escapeHtml(signOffName)
                + "</strong></p>";
    }

    private String buildFooter(EmailBranding branding, String footerNote) {
        StringBuilder sb = new StringBuilder();
        sb.append("<tr><td style=\"background-color:").append(FOOTER_BG)
          .append("; border-top:1px solid ").append(FOOTER_BORDER)
          .append("; padding:20px 44px; text-align:center; font-family:").append(FONT_FAMILY).append(";\">");

        boolean hasContent = false;

        // Full footer: name + address + phone
        if (branding.isShowFullFooter()
                && (branding.getAddress() != null || branding.getPhone() != null)) {
            sb.append("<p style=\"font-size:12px; color:").append(TEXT_MUTED)
              .append("; line-height:1.6; margin:0 0 6px;\">");
            sb.append(escapeHtml(branding.getName()));
            if (branding.getAddress() != null && !branding.getAddress().isBlank()) {
                sb.append(" &middot; ").append(escapeHtml(branding.getAddress()));
            }
            if (branding.getPhone() != null && !branding.getPhone().isBlank()) {
                sb.append(" &middot; ").append(escapeHtml(branding.getPhone()));
            }
            sb.append("</p>");
            hasContent = true;
        }

        // Powered by Legience
        if (branding.isShowPoweredBy()) {
            sb.append("<p style=\"font-size:11px; color:").append(TEXT_FAINT)
              .append("; margin:").append(hasContent ? "6px" : "0").append(" 0 0;\">");
            sb.append("Powered by <a href=\"https://legience.com\" style=\"color:#c0c0c0; text-decoration:none;\">Legience</a>");
            sb.append("</p>");
            hasContent = true;
        }

        // Platform footer (no powered-by, no full footer) — just the platform name
        if (!branding.isShowPoweredBy() && !branding.isShowFullFooter()) {
            sb.append("<p style=\"font-size:12px; color:").append(TEXT_MUTED)
              .append("; margin:0 0 0;\">");
            sb.append(escapeHtml(branding.getName())).append(" &middot; Legal Practice Management");
            sb.append("</p>");
            hasContent = true;
        }

        // Footer note (e.g., "If you didn't request this, ignore this email.")
        if (footerNote != null && !footerNote.isBlank()) {
            sb.append("<p style=\"font-size:12px; color:#aaaaaa; line-height:1.5; margin:")
              .append(hasContent ? "10px" : "0").append(" 0 0;\">");
            sb.append(escapeHtml(footerNote));
            sb.append("</p>");
        }

        sb.append("</td></tr>");
        return sb.toString();
    }

    /**
     * Basic HTML entity escaping for text that goes into HTML attributes or content.
     * Handles the four critical characters: &amp; &lt; &gt; &quot;
     */
    private String escapeHtml(String text) {
        if (text == null) {
            return "";
        }
        return text.replace("&", "&amp;")
                   .replace("<", "&lt;")
                   .replace(">", "&gt;")
                   .replace("\"", "&quot;");
    }
}
