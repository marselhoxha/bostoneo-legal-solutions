package com.bostoneo.bostoneosolutions.dto.email;

import lombok.Builder;
import lombok.Getter;

/**
 * Holds branding context for email rendering.
 * Platform emails use Legience defaults; firm emails use Organization data.
 */
@Getter
@Builder
public class EmailBranding {
    private final String name;           // "Legience" or org name
    private final String logoUrl;        // URL or null (falls back to name as text)
    @Builder.Default
    private final String primaryColor = "#405189";
    private final String replyToEmail;   // for Reply-To header, null = use from address
    private final String phone;          // for footer, null = omit
    private final String address;        // for footer, null = omit
    private final String baseUrl;        // UI_APP_URL for links
    @Builder.Default
    private final boolean showPoweredBy = true;
    @Builder.Default
    private final boolean showFullFooter = true;  // false for internal emails (no address/phone)

    /** Legience platform branding */
    public static EmailBranding platform(String baseUrl, String logoUrl) {
        return EmailBranding.builder()
                .name("Legience")
                .logoUrl(logoUrl)
                .primaryColor("#1e56b6")
                .replyToEmail(null)
                .baseUrl(baseUrl)
                .showPoweredBy(false)
                .showFullFooter(false)
                .build();
    }

    /** Firm branding for client-facing emails (full footer with address/phone) */
    public static EmailBranding firmClient(String name, String logoUrl, String primaryColor,
                                            String email, String phone, String address, String baseUrl) {
        return EmailBranding.builder()
                .name(name)
                .logoUrl(logoUrl)
                .primaryColor(primaryColor != null ? primaryColor : "#405189")
                .replyToEmail(email)
                .phone(phone)
                .address(address)
                .baseUrl(baseUrl)
                .showPoweredBy(true)
                .showFullFooter(true)
                .build();
    }

    /** Firm branding for internal emails (compact footer, no address/phone) */
    public static EmailBranding firmInternal(String name, String logoUrl, String primaryColor,
                                              String email, String baseUrl) {
        return EmailBranding.builder()
                .name(name)
                .logoUrl(logoUrl)
                .primaryColor(primaryColor != null ? primaryColor : "#405189")
                .replyToEmail(email)
                .baseUrl(baseUrl)
                .showPoweredBy(true)
                .showFullFooter(false)
                .build();
    }
}
