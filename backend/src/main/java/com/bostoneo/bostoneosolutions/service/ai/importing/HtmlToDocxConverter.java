package com.bostoneo.bostoneosolutions.service.ai.importing;

import lombok.extern.slf4j.Slf4j;
import org.docx4j.Docx4J;
import org.docx4j.convert.in.xhtml.XHTMLImporterImpl;
import org.docx4j.openpackaging.packages.WordprocessingMLPackage;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.StringReader;

/**
 * Convert CKEditor-edited HTML back to DOCX bytes for the Path-C round-trip.
 *
 * <p>Used when an attorney saves edits in the template editor: we accept the new HTML
 * body, regenerate the canonical DOCX (so "Download as DOCX" stays in sync), and
 * mark the cached rendered PDF stale so the next preview reflects the edits.
 *
 * <p>Implementation: docx4j's XHTML import. It preserves headings, paragraphs, lists,
 * tables, bold/italic, and most inline styles. Some Word-specific features (custom
 * paragraph styles, complex numbering) may not round-trip perfectly — that's an
 * acknowledged Tier B trade-off; visible drift is preferred over a hard-fail save.
 *
 * <p>Failure mode: returns {@code null} on conversion error so the caller can keep
 * the previous {@code templateBinary} unchanged and surface a "couldn't fully save
 * formatting" warning to the attorney.
 */
@Component
@Slf4j
public class HtmlToDocxConverter {

    /**
     * Convert HTML to DOCX bytes. Returns null on any conversion failure (the caller
     * should keep the previously-stored DOCX in that case).
     */
    public byte[] convert(String html) {
        if (html == null || html.isBlank()) return null;
        // docx4j's HTML import requires well-formed XHTML. Wrap in a minimal envelope so
        // partial bodies (typical from CKEditor) parse cleanly. The XHTMLImporter is
        // tolerant of the duplicated <html> wrappers most CKEditor setups produce.
        String xhtml = ensureXhtmlEnvelope(html);
        try {
            WordprocessingMLPackage pkg = WordprocessingMLPackage.createPackage();
            XHTMLImporterImpl importer = new XHTMLImporterImpl(pkg);
            pkg.getMainDocumentPart().getContent()
                .addAll(importer.convert(new StringReader(xhtml).toString(), null));
            try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                Docx4J.save(pkg, out);
                return out.toByteArray();
            }
        } catch (Exception e) {
            log.warn("docx4j HTML→DOCX conversion failed: {}", e.getMessage(), e);
            return null;
        }
    }

    private String ensureXhtmlEnvelope(String html) {
        String stripped = html.strip();
        if (stripped.toLowerCase().startsWith("<!doctype") || stripped.toLowerCase().startsWith("<html")) {
            return stripped;
        }
        return "<!DOCTYPE html>"
            + "<html xmlns=\"http://www.w3.org/1999/xhtml\"><head>"
            + "<meta charset=\"utf-8\"/><title>template</title>"
            + "</head><body>" + stripped + "</body></html>";
    }
}
