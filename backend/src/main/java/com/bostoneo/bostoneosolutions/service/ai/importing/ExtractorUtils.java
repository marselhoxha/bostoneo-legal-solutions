package com.bostoneo.bostoneosolutions.service.ai.importing;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

final class ExtractorUtils {

    private ExtractorUtils() {}

    /**
     * Deterministic SHA-256 hex of the extracted body text.
     * Used for (a) intra-batch deduplication before persisting, and
     * (b) cross-batch dedup via the {@code idx_templates_content_hash_org} partial index.
     *
     * <p>We hash the extracted TEXT, not the file bytes — so two PDFs rendered from the same
     * Word source (different byte-level representations, same legal content) collide correctly.
     */
    static String sha256(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 is mandated by the JDK — this path is unreachable on any conformant JVM.
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
