package com.bostoneo.bostoneosolutions.service.ai.importing;

import lombok.extern.slf4j.Slf4j;
import org.apache.tika.metadata.Metadata;
import org.apache.tika.metadata.TikaCoreProperties;
import org.apache.tika.parser.ParseContext;
import org.apache.tika.parser.ocr.TesseractOCRConfig;
import org.apache.tika.parser.pdf.PDFParser;
import org.apache.tika.parser.pdf.PDFParserConfig;
import org.apache.tika.sax.BodyContentHandler;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;

/**
 * Runs Tesseract OCR on image-only / scanned PDFs via Apache Tika. Used as a fallback inside
 * {@link PdfExtractor} when PDFBox's direct text extraction returns nothing — i.e., a PDF whose
 * pages are images rather than a text layer.
 *
 * <p>Requires the system Tesseract binary (same requirement as
 * {@code AIDocumentAnalysisService}'s document-analysis OCR path). If Tesseract is missing,
 * Tika raises a {@link TikaException}; this service swallows the failure and returns an empty
 * string so the caller can fall back to a user-actionable error.
 */
@Component
@Slf4j
public class PdfOcrService {

    /**
     * OCR a PDF byte stream. Returns extracted text (trimmed) or an empty string if OCR was
     * unavailable or produced no output. Never returns null.
     */
    public String ocrPdfBytes(byte[] bytes, String filenameForLog) {
        TesseractOCRConfig ocrConfig = new TesseractOCRConfig();
        ocrConfig.setLanguage("eng");

        PDFParserConfig pdfConfig = new PDFParserConfig();
        // OCR_ONLY rasterizes each PDF page (via PDFBox's PDFRenderer) and OCRs the
        // rendered page-image directly. We pick this over OCR_AND_TEXT_EXTRACTION because:
        //
        //   1. The caller (PdfExtractor) only invokes us AFTER confirming the text layer is
        //      empty — so re-running text extraction is wasted work.
        //
        //   2. OCR_AND_TEXT_EXTRACTION combined with setExtractInlineImages(true) pulls
        //      every inline image out of the PDF and routes each one through Tika's
        //      EmbeddedDocumentExtractor → AutoDetectParser → full detector chain. That
        //      chain includes DefaultZipContainerDetector, which sniffs bytes for a ZIP
        //      signature and (in some Tika versions) throws ArchiveException when a
        //      "looks-like-ZIP" JPEG header fails archive identification. The exception
        //      is unchecked-by-Tika's-contract (commons-compress, not Tika) and aborts
        //      the whole parse. OCR_ONLY skips inline-image extraction entirely.
        pdfConfig.setOcrStrategy(PDFParserConfig.OCR_STRATEGY.OCR_ONLY);
        pdfConfig.setExtractInlineImages(false);
        pdfConfig.setExtractAcroFormContent(false);
        pdfConfig.setExtractAnnotationText(false);

        ParseContext context = new ParseContext();
        context.set(TesseractOCRConfig.class, ocrConfig);
        context.set(PDFParserConfig.class, pdfConfig);

        // PDFParser directly — not AutoDetectParser — because PdfExtractor has already
        // validated the bytes are a PDF via PDFBox. No outer detection step needed.
        PDFParser parser = new PDFParser();
        BodyContentHandler handler = new BodyContentHandler(-1);  // no char limit
        Metadata metadata = new Metadata();
        metadata.set(Metadata.CONTENT_TYPE, "application/pdf");
        metadata.set(TikaCoreProperties.RESOURCE_NAME_KEY, filenameForLog);

        try (ByteArrayInputStream in = new ByteArrayInputStream(bytes)) {
            parser.parse(in, handler, metadata, context);
            String text = handler.toString().trim();
            log.info("OCR on {}: extracted {} chars", filenameForLog, text.length());
            return text;
        } catch (Exception e) {
            // Catch Exception (not just TikaException/SAXException/IOException) because
            // Tika has been observed to leak unchecked types from its detector chain
            // (e.g., commons-compress ArchiveException). Our contract is "returns text
            // or empty string, never throws" — so we swallow all failures and let the
            // caller render a user-friendly error. Full stack trace logged for diagnosis.
            log.warn("OCR failed for {} ({}): {}",
                filenameForLog, e.getClass().getSimpleName(), e.getMessage(), e);
            return "";
        }
    }
}
