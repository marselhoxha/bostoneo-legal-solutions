package com.bostoneo.bostoneosolutions.service.ai.importing;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.zwobble.mammoth.DocumentConverter;
import org.zwobble.mammoth.Result;

import java.io.ByteArrayInputStream;

/**
 * Convert canonical DOCX bytes to styled HTML using Mammoth Java.
 *
 * <p>This is the Path-C replacement for the regex-and-anchor HTML reconstruction we used
 * during the Textract experiments. Mammoth walks the DOCX semantic structure (paragraphs,
 * runs, tables, lists, styles) and emits clean HTML that preserves headings, bold/italic
 * runs, table structure, and inline styling annotations — the kind of fidelity we
 * specifically agreed to (Tier B: ~85–95% visual match).
 *
 * <p>Custom style mappings pin Word's named styles to specific HTML tags so legal-document
 * conventions (Article headings, sub-section numbering) map predictably:
 *
 * <pre>{@code
 *   "Title"     → <h1 style="text-align:center">
 *   "Heading 1" → <h2>
 *   "Heading 2" → <h3>
 *   "Heading 3" → <h4>
 *   ...
 * }</pre>
 *
 * <p>Failure mode: any conversion error (malformed DOCX, unsupported element) is caught
 * and logged, and we return a minimal fallback {@code <p>} so the import doesn't hard-fail.
 * Variable substitution and the wizard preview still work even with degraded HTML.
 */
@Component
@Slf4j
public class DocxToHtmlConverter {

    private static final String STYLE_MAP = String.join("\n",
        // Document title — centered for legal instruments (trusts, wills, contracts).
        "p[style-name='Title'] => h1.legal-title:fresh",
        // Headings: pin Word's "Heading N" → HTML hN. Add one level so legal templates,
        // which often use "Heading 1" for top-level Articles, end up as <h2> (the wizard
        // template-import preview reserves <h1> for the centered title).
        "p[style-name='Heading 1'] => h2:fresh",
        "p[style-name='Heading 2'] => h3:fresh",
        "p[style-name='Heading 3'] => h4:fresh",
        "p[style-name='Heading 4'] => h5:fresh",
        "p[style-name='Heading 5'] => h6:fresh",
        "p[style-name='Heading 6'] => h6:fresh",
        // Common alternative names.
        "p[style-name='Subtitle'] => h2.subtitle:fresh",
        "p[style-name='Quote'] => blockquote:fresh",
        "p[style-name='Intense Quote'] => blockquote.intense:fresh",
        // Inline emphasis.
        "r[style-name='Strong'] => strong",
        "r[style-name='Emphasis'] => em",
        // Mammoth's default also handles bold/italic runs; styles above only override.
        ""
    );

    private final DocumentConverter converter = new DocumentConverter().addStyleMap(STYLE_MAP);

    /**
     * Convert DOCX bytes to semantic HTML preserving original styles.
     *
     * @return the HTML body. Returns a minimal {@code <p>}-only fallback rather than throwing
     *         on conversion errors, so the import pipeline can still produce a usable template.
     */
    public String convert(byte[] docxBytes) {
        if (docxBytes == null || docxBytes.length == 0) return "";
        try {
            Result<String> result = converter.convertToHtml(new ByteArrayInputStream(docxBytes));
            if (!result.getWarnings().isEmpty()) {
                log.debug("Mammoth produced {} warning(s): {}",
                    result.getWarnings().size(),
                    result.getWarnings().stream().limit(5).toList());
            }
            return result.getValue();
        } catch (Exception e) {
            log.error("Mammoth DOCX→HTML conversion failed: {}", e.getMessage(), e);
            return "<p>(Could not render document body — please open the original file)</p>";
        }
    }
}
