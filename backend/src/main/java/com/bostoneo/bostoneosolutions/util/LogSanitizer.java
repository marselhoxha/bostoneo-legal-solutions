package com.bostoneo.bostoneosolutions.util;

import java.util.regex.Pattern;

/**
 * Utility to mask PII in log messages.
 * Use: log.info("User logged in: {}", LogSanitizer.maskEmail(email));
 */
public final class LogSanitizer {

    private static final Pattern EMAIL_PATTERN = Pattern.compile("([^@\\s]{1,3})[^@\\s]*@([^.\\s]{1,2})[^.\\s]*\\.");

    private LogSanitizer() {}

    /**
     * Mask email: "marsel.hox@gmail.com" -> "mar***@gm***.com"
     */
    public static String maskEmail(String email) {
        if (email == null || !email.contains("@")) return "***";
        return EMAIL_PATTERN.matcher(email).replaceAll("$1***@$2***.");
    }

    /**
     * Mask phone: "+1234567890" -> "***7890"
     */
    public static String maskPhone(String phone) {
        if (phone == null || phone.length() < 4) return "***";
        return "***" + phone.substring(phone.length() - 4);
    }

    /**
     * Mask name: "Marsel Hoxha" -> "M*** H***"
     */
    public static String maskName(String name) {
        if (name == null || name.isBlank()) return "***";
        String[] parts = name.trim().split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (String part : parts) {
            if (sb.length() > 0) sb.append(" ");
            sb.append(part.charAt(0)).append("***");
        }
        return sb.toString();
    }

    /**
     * Mask any string to first 2 + last 2 chars: "somevalue" -> "so***ue"
     */
    public static String mask(String value) {
        if (value == null) return "***";
        if (value.length() <= 4) return "***";
        return value.substring(0, 2) + "***" + value.substring(value.length() - 2);
    }
}
