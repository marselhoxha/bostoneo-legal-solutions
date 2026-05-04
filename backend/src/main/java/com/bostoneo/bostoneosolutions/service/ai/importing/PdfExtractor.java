package com.bostoneo.bostoneosolutions.service.ai.importing;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

/**
 * Extracts text from PDF templates using PDFBox directly (not Tika).
 *
 * <p>Why bypass Tika for the primary read: PDFBox gives us the page count cheaply, which we
 * use to distinguish a legitimate short text PDF (1 page, few words is fine) from an
 * image-only scan (no extractable text layer).
 *
 * <p>When the text layer is empty (typical for scanned letters), we fall back to
 * {@link PdfOcrService} which runs Tesseract via Tika. OCR text is noisier than a clean
 * extract, but for template ingestion the attorney is going to review every variable
 * anyway, so noisy-but-present is strictly better than rejecting the upload.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class PdfExtractor {

    private static final int SCANNED_PDF_CHAR_THRESHOLD = 100;

    private final PdfOcrService ocrService;

    public ExtractedDocument extract(MultipartFile file) throws IOException {
        byte[] bytes = file.getBytes();
        try (PDDocument doc = Loader.loadPDF(bytes)) {
            if (doc.isEncrypted()) {
                // Some PDFs are encrypted with an empty password — PDFBox opens them but flags them.
                // Either way, disallow: we don't want to persist encrypted derivatives.
                throw new TemplateImportException(
                    TemplateImportException.Code.ENCRYPTED_FILE,
                    "This PDF is password-protected or encrypted. Please remove the password protection and re-upload."
                );
            }

            int pageCount = doc.getNumberOfPages();
            PDFTextStripper stripper = new PDFTextStripper();
            // Preserve reading order and paragraph spacing so placeholder detection sees structure.
            stripper.setSortByPosition(true);
            stripper.setParagraphEnd("\n\n");
            String rawText = stripper.getText(doc);
            if (rawText == null) rawText = "";

            String trimmed = rawText.trim();
            List<ImportWarning> warnings = new ArrayList<>();
            boolean usedOcr = false;

            // PDF has no text layer (or only a trickle on a multi-pager) — fall back to Tesseract OCR.
            // OCR is slower and noisier than a clean text extract, but for template import the
            // attorney reviews every detected variable anyway, so producing *something* the
            // classifier can chew on is better than rejecting the upload outright.
            if (trimmed.isEmpty() || (pageCount > 1 && trimmed.length() < SCANNED_PDF_CHAR_THRESHOLD)) {
                log.info("PDF {} has no extractable text layer ({} chars / {} pages) — falling back to OCR.",
                    file.getOriginalFilename(), trimmed.length(), pageCount);
                String ocrText = ocrService.ocrPdfBytes(bytes, file.getOriginalFilename());
                if (ocrText.isEmpty()) {
                    throw new TemplateImportException(
                        TemplateImportException.Code.SCANNED_PDF,
                        "This PDF appears to be scanned images and OCR could not extract any text. " +
                        "Please re-upload a higher-resolution scan or a text-based PDF."
                    );
                }
                trimmed = ocrText;
                usedOcr = true;
                warnings.add(ImportWarning.warning(
                    "ocr_used",
                    "This PDF has no text layer — the body was reconstructed via OCR. " +
                    "Recognition errors are possible; please review the detected variables carefully."
                ));
            }

            int wordCount = trimmed.split("\\s+").length;

            // Collect graphics primitives (signature lines + bordered callouts) so Claude can
            // reconstruct the visual treatment that pure text extraction discards. OCR'd PDFs
            // have no useful graphics primitives in the text layer — skip the second pass for
            // those to save time.
            List<String> structureHints = usedOcr
                ? List.of()
                : buildStructureHints(PdfStructureCollector.collect(doc));

            return new ExtractedDocument(
                trimmed,
                pageCount,
                wordCount,
                ExtractorUtils.sha256(trimmed),
                usedOcr ? "IMPORTED_PDF_OCR" : "IMPORTED_PDF",
                warnings,
                structureHints
            );

        } catch (InvalidPasswordException ipe) {
            throw new TemplateImportException(
                TemplateImportException.Code.ENCRYPTED_FILE,
                "This PDF is password-protected. Please remove the password and re-upload.",
                ipe
            );
        } catch (IOException ioe) {
            log.error("PDF extraction failed for {}: {}", file.getOriginalFilename(), ioe.getMessage());
            throw new TemplateImportException(
                TemplateImportException.Code.CORRUPT_FILE,
                "Could not read PDF — file may be corrupt. " + ioe.getMessage(),
                ioe
            );
        }
    }

    /**
     * Translate raw graphics detections into compact, natural-language cues. Claude is good at
     * matching "1 bordered rectangle on page 12" with "the notary disclaimer paragraph" — much
     * better than reasoning over coordinates. Per-page grouping keeps the cue list short even
     * for long documents.
     */
    private List<String> buildStructureHints(PdfStructureCollector.Result r) {
        if (r.lines().isEmpty() && r.rects().isEmpty()) return List.of();

        // Group by page using TreeMap so the output is page-sorted.
        Map<Integer, int[]> perPage = new TreeMap<>();      // pageIndex -> {lines, rects}
        for (var l : r.lines()) perPage.computeIfAbsent(l.pageIndex(), k -> new int[2])[0]++;
        for (var rect : r.rects()) perPage.computeIfAbsent(rect.pageIndex(), k -> new int[2])[1]++;

        List<String> hints = new ArrayList<>();
        for (Map.Entry<Integer, int[]> e : perPage.entrySet()) {
            int page = e.getKey() + 1;  // human-readable page numbers (1-based)
            int lineCount = e.getValue()[0];
            int rectCount = e.getValue()[1];
            if (lineCount > 0) {
                hints.add(String.format("PAGE %d: %d horizontal rule line%s detected (likely signature lines or fill-in blanks)",
                    page, lineCount, lineCount == 1 ? "" : "s"));
            }
            if (rectCount > 0) {
                hints.add(String.format("PAGE %d: %d bordered rectangle%s detected (likely callout box around an important notice or disclaimer)",
                    page, rectCount, rectCount == 1 ? "" : "s"));
            }
        }
        log.info("PDF structure: {} signature lines, {} bordered rectangles across {} pages",
            r.lines().size(), r.rects().size(), perPage.size());
        return hints;
    }
}
