package com.bostoneo.bostoneosolutions.dto.email;

import lombok.Builder;
import lombok.Getter;

import java.util.List;
import java.util.Map;

/**
 * Holds the content for an email — everything except branding.
 */
@Getter
@Builder
public class EmailContent {
    private final String recipientName;
    private final String greeting;          // null = "Hello {recipientName},"
    private final List<String> bodyParagraphs;
    private final DetailCard detailCard;    // nullable
    private final CtaButton ctaButton;      // nullable
    private final String signOffName;
    private final String footerNote;        // nullable — small text in footer area
    private final UrgencyBanner urgency;    // nullable
    private final MfaCode mfaCode;          // nullable — for MFA emails only
    private final InfoBox infoBox;          // nullable — amber/blue info box

    @Getter
    @Builder
    public static class DetailCard {
        private final String title;
        private final List<Map.Entry<String, String>> rows;
        private final String accentColor;       // null = use primaryColor from branding
        private final String highlightAmount;   // nullable — big number like "$4,500.00"
        private final String highlightColor;    // nullable — color for the amount
    }

    @Getter
    @Builder
    public static class CtaButton {
        private final String text;
        private final String url;
    }

    @Getter
    @Builder
    public static class UrgencyBanner {
        private final String text;       // "COURT APPEARANCE TODAY"
        private final String level;      // "red" or "amber"
    }

    @Getter
    @Builder
    public static class MfaCode {
        private final String code;       // "847293"
    }

    @Getter
    @Builder
    public static class InfoBox {
        private final String html;       // inner HTML content
        private final String level;      // "amber" or "blue"
    }
}
