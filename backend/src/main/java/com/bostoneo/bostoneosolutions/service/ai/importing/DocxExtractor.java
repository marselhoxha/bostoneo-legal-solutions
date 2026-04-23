package com.bostoneo.bostoneosolutions.service.ai.importing;

import lombok.extern.slf4j.Slf4j;
import org.apache.poi.EncryptedDocumentException;
import org.apache.poi.hwpf.HWPFDocument;
import org.apache.poi.hwpf.extractor.WordExtractor;
import org.apache.poi.openxml4j.opc.OPCPackage;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * Extracts text from Microsoft Word templates:
 *   <ul>
 *     <li>{@code .docx} (Office Open XML) via Apache POI XWPF</li>
 *     <li>{@code .doc}  (legacy Word 97-2003 binary) via Apache POI HWPF</li>
 *   </ul>
 *
 * <p>For .docx we also inspect the OPC package for a {@code word/vbaProject.bin} entry so we can
 * warn the attorney that macros were present in their upload and will NOT be executed by Legience.
 */
@Component
@Slf4j
public class DocxExtractor {

    private static final String VBA_PROJECT_PART_NAME = "/word/vbaProject.bin";

    public ExtractedDocument extractDocx(MultipartFile file) throws IOException {
        byte[] bytes = file.getBytes();
        List<ImportWarning> warnings = new ArrayList<>();

        // 1) Inspect the OPC package for macros BEFORE we hand the doc to XWPF, since XWPF strips them silently.
        //    OPCPackage.open(InputStream) opens in READ-ONLY mode by default.
        try (OPCPackage pkg = OPCPackage.open(new ByteArrayInputStream(bytes))) {
            boolean hasMacros = pkg.getParts().stream()
                .anyMatch(p -> VBA_PROJECT_PART_NAME.equalsIgnoreCase(p.getPartName().getName()));
            if (hasMacros) {
                warnings.add(ImportWarning.warning(
                    "macros_stripped",
                    "Macros detected in this document and ignored for safety. The template body was imported normally."
                ));
            }
        } catch (EncryptedDocumentException ede) {
            throw new TemplateImportException(
                TemplateImportException.Code.ENCRYPTED_FILE,
                "This Word document is password-protected. Please remove the password and re-upload.",
                ede
            );
        } catch (Exception ignore) {
            // Can't inspect for macros (corrupt OPC, sharing violation, etc.) — proceed without the warning.
            // The XWPF parse below is the authoritative success/failure signal.
        }

        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(bytes));
             XWPFWordExtractor ex = new XWPFWordExtractor(doc)) {

            String rawText = ex.getText();
            String trimmed = rawText == null ? "" : rawText.trim();
            if (trimmed.isEmpty()) {
                throw new TemplateImportException(
                    TemplateImportException.Code.EMPTY_DOCUMENT,
                    "No readable text found in Word document."
                );
            }

            int wordCount = trimmed.split("\\s+").length;
            return new ExtractedDocument(
                trimmed,
                1,                   // XWPF doesn't expose page count without rendering — use 1 for metadata only
                wordCount,
                ExtractorUtils.sha256(trimmed),
                "IMPORTED_DOCX",
                warnings
            );

        } catch (EncryptedDocumentException ede) {
            throw new TemplateImportException(
                TemplateImportException.Code.ENCRYPTED_FILE,
                "This Word document is password-protected. Please remove the password and re-upload.",
                ede
            );
        } catch (IOException | IllegalArgumentException parse) {
            log.error("DOCX extraction failed for {}: {}", file.getOriginalFilename(), parse.getMessage());
            throw new TemplateImportException(
                TemplateImportException.Code.CORRUPT_FILE,
                "Could not read Word document — file may be corrupt. " + parse.getMessage(),
                parse
            );
        }
    }

    public ExtractedDocument extractDoc(MultipartFile file) throws IOException {
        byte[] bytes = file.getBytes();
        try (HWPFDocument doc = new HWPFDocument(new ByteArrayInputStream(bytes));
             WordExtractor ex = new WordExtractor(doc)) {

            String rawText = ex.getText();
            String trimmed = rawText == null ? "" : rawText.trim();
            if (trimmed.isEmpty()) {
                throw new TemplateImportException(
                    TemplateImportException.Code.EMPTY_DOCUMENT,
                    "No readable text found in legacy Word document."
                );
            }

            int wordCount = trimmed.split("\\s+").length;
            return new ExtractedDocument(
                trimmed,
                1,
                wordCount,
                ExtractorUtils.sha256(trimmed),
                "IMPORTED_DOC",
                new ArrayList<>()
            );

        } catch (EncryptedDocumentException ede) {
            throw new TemplateImportException(
                TemplateImportException.Code.ENCRYPTED_FILE,
                "This Word document is password-protected. Please remove the password and re-upload.",
                ede
            );
        } catch (IOException | IllegalArgumentException parse) {
            log.error("Legacy .doc extraction failed for {}: {}", file.getOriginalFilename(), parse.getMessage());
            throw new TemplateImportException(
                TemplateImportException.Code.CORRUPT_FILE,
                "Could not read legacy Word document — file may be corrupt or in an unsupported format. " + parse.getMessage(),
                parse
            );
        }
    }
}
