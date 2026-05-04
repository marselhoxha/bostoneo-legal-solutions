package com.bostoneo.bostoneosolutions.service.ai.importing;

import java.util.List;

/**
 * Structured result of extracting text from an uploaded template file.
 * Preserves paragraph breaks via {@code \n\n} so the downstream AI can detect template sections.
 *
 * @param rawText        text body used for AI classification and dedup hashing
 * @param pageCount      best-effort page count (1 for DOCX unless POI exposes it; PDF page count from PDFBox)
 * @param wordCount      cheap whitespace tokenization used for language heuristics
 * @param contentHash    lowercase SHA-256 hex of rawText — used for intra-batch and cross-batch dedup
 * @param sourceType     one of MANUAL | IMPORTED_DOCX | IMPORTED_PDF | IMPORTED_DOC
 * @param warnings       non-fatal issues (macros stripped, non-English content, PII detected)
 * @param structureHints natural-language descriptions of PDF graphics primitives (signature lines,
 *                       bordered callout boxes) that PDFBox text extraction would otherwise discard.
 *                       Anchored to nearby text so Claude can correlate with the body and emit
 *                       matching HTML treatment ({@code <hr>}, {@code <div style="border…">}).
 *                       Empty list when extraction is from DOCX/DOC or when no primitives detected.
 */
public record ExtractedDocument(
    String rawText,
    int pageCount,
    int wordCount,
    String contentHash,
    String sourceType,
    List<ImportWarning> warnings,
    List<String> structureHints
) {}
