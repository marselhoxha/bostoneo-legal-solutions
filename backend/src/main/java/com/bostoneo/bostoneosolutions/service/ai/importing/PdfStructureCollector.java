package com.bostoneo.bostoneosolutions.service.ai.importing;

import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.contentstream.PDFGraphicsStreamEngine;
import org.apache.pdfbox.cos.COSName;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.graphics.image.PDImage;

import java.awt.geom.Point2D;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * Walks a PDF's content stream and collects the visual-structure primitives that {@code
 * PDFTextStripper} discards: horizontal-rule lines (signature lines / fill-in blanks) and
 * bordered rectangles (callout boxes around notary disclaimers, sworn-statement blocks, etc.).
 *
 * <p>Used by {@link PdfExtractor} to build natural-language structural cues that travel
 * alongside the extracted text into Claude's prompt. Without these cues, Claude sees only
 * the flat text and emits unstyled paragraphs — losing the visual treatment that signals
 * "this is a signature block" or "this is a callout box that should render with a border."
 *
 * <p>This class deliberately collects per-page COUNTS and per-page bounding boxes only —
 * it does NOT attempt to correlate primitives with text positions. That semantic matching
 * ("which paragraph is inside the box?") is delegated to Claude, which is good at matching
 * "I see 1 bordered box" to "the notary disclaimer paragraph."
 */
@Slf4j
public class PdfStructureCollector extends PDFGraphicsStreamEngine {

    public record DetectedLine(int pageIndex, float x1, float y1, float x2, float y2) {
        float width() { return Math.abs(x2 - x1); }
    }

    public record DetectedRect(int pageIndex, float x1, float y1, float x2, float y2) {
        float width()  { return Math.abs(x2 - x1); }
        float height() { return Math.abs(y2 - y1); }
    }

    public record Result(List<DetectedLine> lines, List<DetectedRect> rects) {}

    private final int pageIndex;
    private final float pageWidth;
    private final float pageHeight;
    private final List<DetectedLine> lines = new ArrayList<>();
    private final List<DetectedRect> rects = new ArrayList<>();

    // Current subpath state — populated by moveTo/lineTo and finalized on strokePath/fillPath/endPath.
    private final List<Point2D> currentPath = new ArrayList<>();
    private final List<float[]> pendingRects = new ArrayList<>();
    private Point2D currentPoint = new Point2D.Float(0, 0);

    private PdfStructureCollector(PDPage page, int pageIndex) {
        super(page);
        this.pageIndex = pageIndex;
        this.pageWidth = page.getMediaBox().getWidth();
        this.pageHeight = page.getMediaBox().getHeight();
    }

    /**
     * Run the collector across every page of {@code doc} and return the aggregate detections.
     */
    public static Result collect(PDDocument doc) {
        List<DetectedLine> allLines = new ArrayList<>();
        List<DetectedRect> allRects = new ArrayList<>();
        for (int i = 0; i < doc.getNumberOfPages(); i++) {
            PDPage page = doc.getPage(i);
            try {
                PdfStructureCollector engine = new PdfStructureCollector(page, i);
                engine.processPage(page);
                allLines.addAll(engine.lines);
                allRects.addAll(engine.rects);
            } catch (IOException e) {
                // Best-effort — a single page failing should not abort extraction.
                log.warn("Structure collection failed on page {}: {}", i, e.getMessage());
            }
        }
        return new Result(allLines, allRects);
    }

    @Override
    public void moveTo(float x, float y) {
        currentPath.clear();
        Point2D p = new Point2D.Float(x, y);
        currentPath.add(p);
        currentPoint = p;
    }

    @Override
    public void lineTo(float x, float y) {
        Point2D p = new Point2D.Float(x, y);
        currentPath.add(p);
        currentPoint = p;
    }

    @Override
    public void curveTo(float x1, float y1, float x2, float y2, float x3, float y3) {
        // Curves break the "straight line" detection — discard the in-progress path.
        currentPath.clear();
        currentPoint = new Point2D.Float(x3, y3);
    }

    @Override
    public void appendRectangle(Point2D p0, Point2D p1, Point2D p2, Point2D p3) {
        float minX = (float) Math.min(Math.min(p0.getX(), p1.getX()), Math.min(p2.getX(), p3.getX()));
        float maxX = (float) Math.max(Math.max(p0.getX(), p1.getX()), Math.max(p2.getX(), p3.getX()));
        float minY = (float) Math.min(Math.min(p0.getY(), p1.getY()), Math.min(p2.getY(), p3.getY()));
        float maxY = (float) Math.max(Math.max(p0.getY(), p1.getY()), Math.max(p2.getY(), p3.getY()));
        pendingRects.add(new float[]{minX, minY, maxX, maxY});
    }

    @Override
    public void strokePath() {
        // Pending rectangles from appendRectangle become real bordered boxes when stroked.
        for (float[] r : pendingRects) {
            float w = r[2] - r[0], h = r[3] - r[1];
            // Reject page-bounds rectangles (page borders / decorative frames).
            if (w >= pageWidth * 0.95f && h >= pageHeight * 0.95f) continue;
            // Reject sub-50pt boxes — typically checkboxes / form bullets, not callouts.
            if (w < 50 || h < 20) continue;
            rects.add(new DetectedRect(pageIndex, r[0], r[1], r[2], r[3]));
        }
        pendingRects.clear();

        // A 2-point subpath stroked is a line. Filter to "near-horizontal, body-width" lines —
        // these are signature lines and fill-in blanks. Vertical or diagonal lines aren't
        // structural cues we care about for legal templates.
        if (currentPath.size() == 2) {
            Point2D p1 = currentPath.get(0);
            Point2D p2 = currentPath.get(1);
            float dx = (float) Math.abs(p1.getX() - p2.getX());
            float dy = (float) Math.abs(p1.getY() - p2.getY());
            // Horizontal: dy ≤ 2pt (allows for slight stroke jitter).
            // Width: ≥ 50pt (exclude tick marks / glyph artifacts).
            // Width: ≤ 95% page width (exclude page-spanning decorative rules).
            if (dy <= 2 && dx >= 50 && dx < pageWidth * 0.95f) {
                lines.add(new DetectedLine(pageIndex,
                    (float) Math.min(p1.getX(), p2.getX()), (float) p1.getY(),
                    (float) Math.max(p1.getX(), p2.getX()), (float) p2.getY()));
            }
        }
        currentPath.clear();
    }

    @Override
    public void fillAndStrokePath(int windingRule) throws IOException {
        // Treat fill+stroke the same as stroke for structural detection — bordered+filled
        // boxes (e.g., gray-shaded callouts) are still bordered callouts.
        strokePath();
    }

    @Override
    public void fillPath(int windingRule) {
        // Fill-only paths are typically background colors, not structural borders. Discard.
        pendingRects.clear();
        currentPath.clear();
    }

    @Override
    public void endPath() {
        pendingRects.clear();
        currentPath.clear();
    }

    @Override
    public void closePath() {
        // No-op for our detection logic — appendRectangle already provides closed quad info.
    }

    @Override
    public Point2D getCurrentPoint() {
        return currentPoint;
    }

    @Override
    public void clip(int windingRule) { /* not relevant to structural detection */ }

    @Override
    public void drawImage(PDImage pdImage) { /* images aren't structural primitives we track */ }

    @Override
    public void shadingFill(COSName shadingName) { /* gradients aren't structural primitives */ }
}
