package com.bostoneo.bostoneosolutions.service.ai.importing;

import com.itextpdf.kernel.colors.Color;
import com.itextpdf.kernel.colors.ColorConstants;
import com.itextpdf.kernel.font.PdfFont;
import com.itextpdf.kernel.geom.Vector;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfPage;
import com.itextpdf.kernel.pdf.PdfReader;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.kernel.pdf.canvas.PdfCanvas;
import com.itextpdf.kernel.pdf.canvas.parser.EventType;
import com.itextpdf.kernel.pdf.canvas.parser.PdfCanvasProcessor;
import com.itextpdf.kernel.pdf.canvas.parser.data.IEventData;
import com.itextpdf.kernel.pdf.canvas.parser.data.TextRenderInfo;
import com.itextpdf.kernel.pdf.canvas.parser.listener.IEventListener;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;

/**
 * Glyph-level find-and-replace on text-layer PDFs.
 *
 * <p>Uses iText 8's {@link PdfCanvasProcessor} to capture each rendered glyph's
 * absolute position (baseline start/end, ascent, descent), font, size, and fill color.
 * For each {@code (rawText → token)} pair, the transformer:
 * <ol>
 *   <li>Locates the match in the page's joined text,</li>
 *   <li>Computes a bounding box spanning the match's glyphs,</li>
 *   <li>Overlays a solid white rectangle to hide the underlying text,</li>
 *   <li>Re-draws the token at the original baseline using the first glyph's font / size / color.</li>
 * </ol>
 *
 * <p><b>Feature flag.</b> Gated by {@code templateImport.pdfInPlaceEnabled} (default false).
 * Callers should check {@link #isEnabled()} before invoking transform.
 *
 * <p><b>Limitations (acceptable for MVP):</b>
 * <ul>
 *   <li>Cross-line matches are skipped — bbox would span a gap the overlay can't reason about.</li>
 *   <li>Rotated pages render the token horizontally regardless of page rotation (rare in legal docs).</li>
 *   <li>If the first glyph's font lacks glyphs for the token's characters, {@code showText} may
 *       silently substitute — the warning is logged and the page remains with the white overlay.</li>
 *   <li>Scanned (OCR-only) PDFs are rejected upstream by {@link PdfExtractor}; this class never
 *       runs on them.</li>
 *   <li><b>Overlay box is sized to the <i>rawText</i>, not the replacement.</b> At import time
 *       that's fine — the box exactly covers the original prose and a slightly-shorter
 *       {@code {{token}}} sits inside it. But when {@link BinaryTemplateRenderer} calls this
 *       transformer in reverse (rawText = {@code {{token}}}, replacement = attorney's value),
 *       the overlay is sized to the token: a shorter value leaves extra white space to the
 *       right of the drawn text, and a longer value overflows past the white rectangle and
 *       collides with neighboring glyphs. Acceptable for MVP given PDF is off by default
 *       ({@code templateImport.pdfInPlaceEnabled=false}); revisit before flipping the flag.</li>
 * </ul>
 */
@Component
@Slf4j
public class PdfTemplateTransformer {

    @Value("${templateImport.pdfInPlaceEnabled:false}")
    private boolean enabled;

    /** Caller-facing gate. When false, the import pipeline must NOT persist a binary template. */
    public boolean isEnabled() {
        return enabled;
    }

    /**
     * Apply replacements in place. Returns the transformed PDF bytes, or the original bytes
     * if no replacements matched.
     *
     * @param pdfBytes     original PDF bytes (will NOT be mutated)
     * @param replacements {rawText, token} pairs; longest rawText is applied first so a short
     *                     rawText can't prefix-eat a longer one
     */
    public byte[] transform(byte[] pdfBytes, List<DocxTemplateTransformer.Replacement> replacements) throws Exception {
        if (pdfBytes == null || pdfBytes.length == 0) {
            throw new IllegalArgumentException("pdfBytes is empty");
        }
        if (replacements == null || replacements.isEmpty()) {
            return pdfBytes;
        }

        List<DocxTemplateTransformer.Replacement> sorted = new ArrayList<>(replacements);
        sorted.sort(Comparator.comparingInt((DocxTemplateTransformer.Replacement r) -> r.rawText().length()).reversed());

        ByteArrayOutputStream out = new ByteArrayOutputStream(pdfBytes.length);
        int totalReplacements = 0;
        int totalPages;

        try (PdfReader reader = new PdfReader(new ByteArrayInputStream(pdfBytes));
             PdfWriter writer = new PdfWriter(out);
             PdfDocument pdf = new PdfDocument(reader, writer)) {

            totalPages = pdf.getNumberOfPages();
            for (int pageNum = 1; pageNum <= totalPages; pageNum++) {
                PdfPage page = pdf.getPage(pageNum);

                GlyphCollector collector = new GlyphCollector();
                try {
                    new PdfCanvasProcessor(collector).processPageContent(page);
                } catch (Exception e) {
                    log.warn("Page {} content processing failed — skipping: {}", pageNum, e.getMessage());
                    continue;
                }
                List<GlyphInfo> glyphs = collector.getGlyphs();
                if (glyphs.isEmpty()) continue;

                StringBuilder joined = new StringBuilder(glyphs.size());
                for (GlyphInfo g : glyphs) joined.append(g.ch);
                String pageText = joined.toString();

                PdfCanvas canvas = new PdfCanvas(page.newContentStreamAfter(), page.getResources(), pdf);

                for (DocxTemplateTransformer.Replacement r : sorted) {
                    int idx = 0;
                    while ((idx = pageText.indexOf(r.rawText(), idx)) >= 0) {
                        int endExclusive = idx + r.rawText().length();
                        GlyphInfo first = glyphs.get(idx);
                        GlyphInfo last = glyphs.get(endExclusive - 1);

                        // Only handle same-line matches — baselines within half a pixel.
                        // Cross-line spans would produce a misleading bbox that paints over
                        // unrelated text on the line between. Falling through leaves the
                        // original prose intact; the text-only path still has the token.
                        if (Math.abs(first.baselineStartY - last.baselineStartY) > 0.5f) {
                            log.warn("Skipping cross-line match of '{}' on page {} (baseline delta {})",
                                r.rawText(), pageNum, first.baselineStartY - last.baselineStartY);
                            idx = endExclusive;
                            continue;
                        }

                        float x = first.baselineStartX;
                        float y = first.descentY;
                        float width = last.baselineEndX - first.baselineStartX;
                        float height = first.ascentY - first.descentY;
                        if (width <= 0 || height <= 0) {
                            idx = endExclusive;
                            continue;
                        }

                        // Cover original text with a solid white rectangle.
                        canvas.saveState();
                        canvas.setFillColor(ColorConstants.WHITE);
                        canvas.rectangle(x, y, width, height);
                        canvas.fill();
                        canvas.restoreState();

                        // Render token at captured baseline with first glyph's font/size/color.
                        try {
                            canvas.saveState();
                            canvas.beginText();
                            canvas.setFontAndSize(first.font, first.fontSize);
                            if (first.color != null) {
                                canvas.setFillColor(first.color);
                            }
                            canvas.moveText(first.baselineStartX, first.baselineStartY);
                            canvas.showText(r.token());
                            canvas.endText();
                            canvas.restoreState();
                            totalReplacements++;
                        } catch (Exception e) {
                            log.warn("Failed to render token '{}' on page {}: {}",
                                r.token(), pageNum, e.getMessage());
                            try { canvas.endText(); } catch (Exception ignore) {}
                            try { canvas.restoreState(); } catch (Exception ignore) {}
                        }

                        idx = endExclusive;
                    }
                }
            }

            log.info("PDF transform: {} replacement(s) applied across {} page(s)", totalReplacements, totalPages);
        }

        return out.toByteArray();
    }

    // ==================== Internals ====================

    /**
     * Collects every glyph rendered on a page into a flat list preserving the reading order
     * iText walks the content stream in. Order matters for cross-glyph substring search.
     */
    private static final class GlyphCollector implements IEventListener {
        private static final Set<EventType> SUPPORTED = Set.of(EventType.RENDER_TEXT);
        private final List<GlyphInfo> glyphs = new ArrayList<>();

        @Override
        public void eventOccurred(IEventData data, EventType type) {
            if (type != EventType.RENDER_TEXT) return;
            TextRenderInfo info = (TextRenderInfo) data;
            List<TextRenderInfo> chars = info.getCharacterRenderInfos();
            for (TextRenderInfo charInfo : chars) {
                String text = charInfo.getText();
                if (text == null || text.isEmpty()) continue;

                Vector start = charInfo.getBaseline().getStartPoint();
                Vector end = charInfo.getBaseline().getEndPoint();
                Vector ascent = charInfo.getAscentLine().getStartPoint();
                Vector descent = charInfo.getDescentLine().getStartPoint();

                float baselineStartX = start.get(0);
                float baselineStartY = start.get(1);
                float baselineEndX = end.get(0);
                float ascentY = ascent.get(1);
                float descentY = descent.get(1);

                PdfFont font = charInfo.getFont();
                float fontSize = charInfo.getFontSize();
                Color color = charInfo.getFillColor();

                // In iText 8 each charInfo usually holds a single Unicode char; ligatures may
                // hold more. Share the bbox across all of them — imperfect for ligatures but
                // acceptable for legal-template text.
                for (int i = 0; i < text.length(); i++) {
                    glyphs.add(new GlyphInfo(
                        text.charAt(i),
                        baselineStartX,
                        baselineStartY,
                        baselineEndX,
                        ascentY,
                        descentY,
                        font,
                        fontSize,
                        color
                    ));
                }
            }
        }

        @Override
        public Set<EventType> getSupportedEvents() {
            return SUPPORTED;
        }

        public List<GlyphInfo> getGlyphs() {
            return glyphs;
        }
    }

    /** One glyph's provenance: which char + its rendering position, font, and color. */
    private record GlyphInfo(
        char ch,
        float baselineStartX,
        float baselineStartY,
        float baselineEndX,
        float ascentY,
        float descentY,
        PdfFont font,
        float fontSize,
        Color color
    ) {}
}
