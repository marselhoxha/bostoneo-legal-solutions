package com.bostoneo.bostoneosolutions.service.ai.importing;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Locale;
import java.util.Set;

/**
 * Entry point for extracting text from uploaded template files.
 * Routes by MIME type + filename extension to the PDF or DOCX/DOC extractors
 * and adds a light-weight English-language heuristic for Claude's benefit.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class TemplateImportExtractor {

    private static final long MAX_FILE_BYTES = 10L * 1024 * 1024; // 10 MB per file (plan rate-limit)

    private static final Set<String> PDF_CONTENT_TYPES = Set.of(
        "application/pdf", "application/x-pdf"
    );
    private static final Set<String> DOCX_CONTENT_TYPES = Set.of(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    private static final Set<String> DOC_CONTENT_TYPES = Set.of(
        "application/msword", "application/vnd.ms-word"
    );

    private static final Set<String> COMMON_ENGLISH_STOPWORDS = Set.of(
        "the", "and", "of", "to", "a", "in", "that", "is", "for", "on", "with", "as", "be", "by", "this"
    );

    private final PdfExtractor pdfExtractor;
    private final DocxExtractor docxExtractor;
    /**
     * Optional LibreOffice converter. When present and enabled, PDF and DOC files are
     * converted to DOCX so the rest of the pipeline can use the high-fidelity DOCX path
     * (Mammoth → HTML, POI → tokenized DOCX, LibreOffice render → preview PDF).
     * When LibreOffice is unavailable or conversion fails, falls back to the legacy
     * PDFBox / POI-HWPF text-extraction path.
     */
    private final LibreOfficeConverterService libreOfficeConverter;

    public ExtractedDocument extract(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new TemplateImportException(
                TemplateImportException.Code.EMPTY_DOCUMENT,
                "Uploaded file is empty."
            );
        }
        if (file.getSize() > MAX_FILE_BYTES) {
            throw new TemplateImportException(
                TemplateImportException.Code.FILE_TOO_LARGE,
                "File exceeds 10 MB limit. Please compress or split the document."
            );
        }

        ExtractedDocument doc = switch (classify(file)) {
            case PDF  -> extractPdf(file);
            case DOC  -> extractDoc(file);
            case DOCX -> docxExtractor.extractDocx(file);
            case UNSUPPORTED -> throw new TemplateImportException(
                TemplateImportException.Code.UNSUPPORTED_FORMAT,
                "Unsupported file type. Please upload PDF, DOCX, or DOC."
            );
        };

        return maybeAddLanguageWarning(doc);
    }

    /**
     * PDF → DOCX via LibreOffice when available, else legacy PDFBox text extraction.
     * The DOCX path is the canonical Path-C flow; the PDFBox fallback exists for
     * environments without LibreOffice (local dev) and for OCR-only scanned PDFs
     * where LibreOffice produces nothing useful.
     */
    private ExtractedDocument extractPdf(MultipartFile file) throws IOException {
        if (libreOfficeConverter != null && libreOfficeConverter.isEnabled()) {
            try {
                log.debug("Converting PDF {} to DOCX via LibreOffice", file.getOriginalFilename());
                byte[] docxBytes = libreOfficeConverter.convertToDocx(
                    file.getBytes(),
                    LibreOfficeConverterService.SourceFormat.PDF
                );
                return docxExtractor.extractDocxBytes(
                    docxBytes,
                    file.getOriginalFilename(),
                    "IMPORTED_PDF",
                    file.getBytes()
                );
            } catch (Exception e) {
                log.warn("LibreOffice PDF→DOCX failed for {} — falling back to PDFBox: {}",
                    file.getOriginalFilename(), e.getMessage());
                ExtractedDocument fallback = pdfExtractor.extract(file);
                fallback.warnings().add(ImportWarning.warning(
                    "low_fidelity_extraction",
                    "Could not produce a high-fidelity DOCX from this PDF. Imported as text only — "
                        + "tables, fonts, and formatting may not match the source document."
                ));
                return fallback;
            }
        }
        log.debug("Routing PDF {} through PDFBox (LibreOffice unavailable)", file.getOriginalFilename());
        return pdfExtractor.extract(file);
    }

    /**
     * DOC → DOCX via LibreOffice when available, else legacy POI HWPF text extraction.
     */
    private ExtractedDocument extractDoc(MultipartFile file) throws IOException {
        if (libreOfficeConverter != null && libreOfficeConverter.isEnabled()) {
            try {
                log.debug("Converting DOC {} to DOCX via LibreOffice", file.getOriginalFilename());
                byte[] docxBytes = libreOfficeConverter.convertToDocx(
                    file.getBytes(),
                    LibreOfficeConverterService.SourceFormat.DOC
                );
                return docxExtractor.extractDocxBytes(
                    docxBytes,
                    file.getOriginalFilename(),
                    "IMPORTED_DOC",
                    file.getBytes()
                );
            } catch (Exception e) {
                log.warn("LibreOffice DOC→DOCX failed for {} — falling back to POI HWPF: {}",
                    file.getOriginalFilename(), e.getMessage());
                return docxExtractor.extractDoc(file);
            }
        }
        return docxExtractor.extractDoc(file);
    }

    private enum FileKind { PDF, DOCX, DOC, UNSUPPORTED }

    private FileKind classify(MultipartFile file) {
        String ct = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(Locale.ROOT);

        if (PDF_CONTENT_TYPES.contains(ct) || name.endsWith(".pdf"))   return FileKind.PDF;
        if (DOCX_CONTENT_TYPES.contains(ct) || name.endsWith(".docx")) return FileKind.DOCX;
        if (DOC_CONTENT_TYPES.contains(ct)  || name.endsWith(".doc"))  return FileKind.DOC;
        return FileKind.UNSUPPORTED;
    }

    /**
     * Cheap language check: count well-known English stopwords as a fraction of all tokens.
     * Below 1% is usually non-English (or legal boilerplate in Latin, etc.) — flag so the
     * attorney knows Claude may mis-classify.
     */
    private ExtractedDocument maybeAddLanguageWarning(ExtractedDocument doc) {
        String[] tokens = doc.rawText().toLowerCase(Locale.ROOT).split("\\W+");
        if (tokens.length == 0) return doc;

        long hits = 0;
        for (String t : tokens) if (COMMON_ENGLISH_STOPWORDS.contains(t)) hits++;
        double ratio = (double) hits / tokens.length;

        if (ratio < 0.01) {
            doc.warnings().add(ImportWarning.warning(
                "non_english_content",
                "Most of this document is not English. AI classification accuracy may be low."
            ));
        }
        return doc;
    }
}
