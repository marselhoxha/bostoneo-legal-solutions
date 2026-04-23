package com.bostoneo.bostoneosolutions.service.ai.importing;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Draft-time counterpart to the import-time {@link DocxTemplateTransformer} /
 * {@link PdfTemplateTransformer}: given a cached binary template that contains
 * {@code {{token}}} placeholders and a map of values, produce the final bytes
 * with every token swapped for its value — visual fidelity preserved.
 *
 * <p>The transformers are direction-agnostic find-and-replace engines (they preserve
 * POI run formatting and iText glyph positioning regardless of which string is the
 * "needle" and which is the "replacement"). So rendering is just the inverse feed:
 * each {@code (key, value)} becomes a {@code Replacement("{{key}}", value)} pair.
 *
 * <p>Longest-first sort inside the transformer protects against prefix-eating —
 * e.g. {@code {{client}}} cannot overwrite {@code {{client_name}}} because the
 * longer token is processed first.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class BinaryTemplateRenderer {

    private final DocxTemplateTransformer docxTransformer;
    private final PdfTemplateTransformer pdfTransformer;

    /**
     * Render the binary template by swapping every {@code {{key}}} in its bytes with the
     * corresponding value from {@code values}.
     *
     * @param binaryBytes  the cached template bytes stored on {@code AILegalTemplate.templateBinary}
     * @param binaryFormat "DOCX" or "PDF" (matches {@code AILegalTemplate.templateBinaryFormat})
     * @param values       attorney-supplied values keyed by variable name (without braces)
     * @return rendered bytes ready to stream to the browser for download / in-browser preview
     * @throws IllegalArgumentException on empty input or unsupported format
     * @throws IllegalStateException    when PDF rendering is requested but the feature flag is off
     */
    public byte[] render(byte[] binaryBytes, String binaryFormat, Map<String, String> values) {
        if (binaryBytes == null || binaryBytes.length == 0) {
            throw new IllegalArgumentException("binaryBytes is empty");
        }
        if (binaryFormat == null || binaryFormat.isBlank()) {
            throw new IllegalArgumentException("binaryFormat is required");
        }

        List<DocxTemplateTransformer.Replacement> replacements = toReplacements(values);
        if (replacements.isEmpty()) {
            log.debug("No values supplied — returning template binary unchanged ({} bytes)", binaryBytes.length);
            return binaryBytes;
        }

        try {
            if ("DOCX".equalsIgnoreCase(binaryFormat)) {
                byte[] out = docxTransformer.transform(binaryBytes, replacements);
                log.info("DOCX render: {} token(s) substituted -> {} bytes", replacements.size(), out.length);
                return out;
            }
            if ("PDF".equalsIgnoreCase(binaryFormat)) {
                if (!pdfTransformer.isEnabled()) {
                    throw new IllegalStateException("PDF in-place rendering is disabled (templateImport.pdfInPlaceEnabled=false)");
                }
                byte[] out = pdfTransformer.transform(binaryBytes, replacements);
                log.info("PDF render: {} token(s) substituted -> {} bytes", replacements.size(), out.length);
                return out;
            }
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new RuntimeException("Binary template render failed: " + e.getMessage(), e);
        }

        throw new IllegalArgumentException("Unsupported binaryFormat: " + binaryFormat);
    }

    /**
     * Convert the attorney's {@code {key -> value}} map into the {@code Replacement} list the
     * transformers expect. Null values render as empty strings; null/blank keys are dropped.
     */
    private List<DocxTemplateTransformer.Replacement> toReplacements(Map<String, String> values) {
        List<DocxTemplateTransformer.Replacement> out = new ArrayList<>();
        if (values == null || values.isEmpty()) return out;
        for (Map.Entry<String, String> e : values.entrySet()) {
            String key = e.getKey();
            if (key == null || key.isBlank()) continue;
            String value = e.getValue() == null ? "" : e.getValue();
            out.add(new DocxTemplateTransformer.Replacement("{{" + key + "}}", value));
        }
        return out;
    }
}
