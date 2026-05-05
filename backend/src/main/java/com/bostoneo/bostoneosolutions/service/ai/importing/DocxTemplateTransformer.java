package com.bostoneo.bostoneosolutions.service.ai.importing;

import lombok.extern.slf4j.Slf4j;
import org.apache.poi.xwpf.usermodel.IBodyElement;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFFootnote;
import org.apache.poi.xwpf.usermodel.XWPFFooter;
import org.apache.poi.xwpf.usermodel.XWPFHeader;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.springframework.stereotype.Component;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTR;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Run-aware find-and-replace on Word .docx files.
 *
 * <p>The hard problem: Word splits visible text across multiple {@link XWPFRun} objects
 * because each run owns its formatting. "John Smith" may live in one run, two adjacent runs,
 * or even a run + tab + run. A naive {@code run.setText(run.text().replace(x, y))} misses
 * cross-run matches; a naive concat-then-replace destroys formatting.
 *
 * <p>Algorithm per paragraph:
 * <pre>
 *   1. Flatten runs into an array of (run, localOffset, char) tuples.
 *   2. Build the concatenated text.
 *   3. For each match of rawText:
 *      a. Identify first run, last run, and their local offsets.
 *      b. Splice in the token: first run keeps its prefix + token; last run keeps its suffix;
 *         all strictly-middle runs are blanked.
 *      c. Formatting of the first run "wins" (token inherits its rPr — bold, color, font).
 *   4. Re-flatten after each mutation because run texts have changed.
 * </pre>
 *
 * <p>Walks, in order: body paragraphs → body tables (recursive cells) → every header part →
 * every footer part → footnotes → endnotes. Text boxes inside drawings are reached via POI's
 * paragraph traversal of SDT content.
 */
@Component
@Slf4j
public class DocxTemplateTransformer {

    /**
     * Apply the given replacements to the DOCX file and return the transformed bytes.
     *
     * @param docxBytes    original uploaded .docx bytes (will NOT be mutated)
     * @param replacements {rawText, token} pairs — "John Smith" -> "{{client_name}}" — longest rawText first
     * @return transformed .docx bytes, or the original bytes unchanged if no replacements matched
     */
    /**
     * Same as {@link #transform(byte[], List)} but additionally applies a yellow highlight
     * to every run that ends up containing a {@code {{token}}} marker, so the wizard PDF
     * preview shows attorneys exactly where placeholders sit in the document. Used by the
     * Path-C canonical pipeline at import time.
     */
    public byte[] transformWithHighlights(byte[] docxBytes, List<Replacement> replacements) throws Exception {
        byte[] tokenizedBytes = transform(docxBytes, replacements);
        if (replacements == null || replacements.isEmpty()) return tokenizedBytes;
        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(tokenizedBytes));
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            // Walk every run in body, headers, footers, tables. Highlight any run whose text
            // contains a {{token}} marker. Mammoth/Word render the highlight as a yellow
            // background, which is exactly the "clearly artificial" placeholder style the
            // attorney UX expects.
            for (IBodyElement el : doc.getBodyElements()) {
                applyHighlightsTo(el);
            }
            for (XWPFHeader h : doc.getHeaderList()) {
                for (IBodyElement el : h.getBodyElements()) applyHighlightsTo(el);
            }
            for (XWPFFooter f : doc.getFooterList()) {
                for (IBodyElement el : f.getBodyElements()) applyHighlightsTo(el);
            }
            doc.write(out);
            return out.toByteArray();
        }
    }

    private static final java.util.regex.Pattern TOKEN_PATTERN = java.util.regex.Pattern.compile("\\{\\{[^}]+\\}\\}");

    private void applyHighlightsTo(IBodyElement el) {
        if (el instanceof XWPFParagraph p) {
            for (XWPFRun r : p.getRuns()) highlightIfTokenBearing(r);
        } else if (el instanceof XWPFTable t) {
            for (XWPFTableRow row : t.getRows()) {
                for (XWPFTableCell cell : row.getTableCells()) {
                    for (IBodyElement cellEl : cell.getBodyElements()) applyHighlightsTo(cellEl);
                }
            }
        }
    }

    private void highlightIfTokenBearing(XWPFRun run) {
        String text = run.text();
        if (text == null || text.isEmpty()) return;
        if (!TOKEN_PATTERN.matcher(text).find()) return;
        try {
            CTR ctr = run.getCTR();
            var rpr = ctr.getRPr() != null ? ctr.getRPr() : ctr.addNewRPr();
            // Remove any existing highlight to avoid duplicates on repeated runs.
            while (rpr.sizeOfHighlightArray() > 0) rpr.removeHighlight(0);
            rpr.addNewHighlight().setVal(
                org.openxmlformats.schemas.wordprocessingml.x2006.main.STHighlightColor.YELLOW
            );
        } catch (Exception e) {
            // Highlighting is cosmetic — never break the pipeline if a single run resists styling.
            log.debug("Could not highlight token-bearing run: {}", e.getMessage());
        }
    }

    public byte[] transform(byte[] docxBytes, List<Replacement> replacements) throws Exception {
        if (docxBytes == null || docxBytes.length == 0) {
            throw new IllegalArgumentException("docxBytes is empty");
        }
        if (replacements == null || replacements.isEmpty()) {
            return docxBytes;
        }

        // Longest-first ordering prevents a shorter rawText from eating a prefix of a longer one
        // (e.g. "John" before "John Smith" would tokenize just the first name).
        List<Replacement> sorted = new ArrayList<>(replacements);
        sorted.sort(Comparator.comparingInt((Replacement r) -> r.rawText().length()).reversed());

        try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(docxBytes))) {

            int totalReplaced = 0;

            // Body paragraphs (top-level) + body tables
            for (IBodyElement el : doc.getBodyElements()) {
                if (el instanceof XWPFParagraph p)      totalReplaced += replaceInParagraph(p, sorted);
                else if (el instanceof XWPFTable t)     totalReplaced += replaceInTable(t, sorted);
            }

            // Headers
            for (XWPFHeader h : doc.getHeaderList()) {
                for (XWPFParagraph p : h.getParagraphs()) totalReplaced += replaceInParagraph(p, sorted);
                for (XWPFTable t : h.getTables())         totalReplaced += replaceInTable(t, sorted);
            }

            // Footers
            for (XWPFFooter f : doc.getFooterList()) {
                for (XWPFParagraph p : f.getParagraphs()) totalReplaced += replaceInParagraph(p, sorted);
                for (XWPFTable t : f.getTables())         totalReplaced += replaceInTable(t, sorted);
            }

            // Footnotes
            for (XWPFFootnote fn : doc.getFootnotes()) {
                for (XWPFParagraph p : fn.getParagraphs()) totalReplaced += replaceInParagraph(p, sorted);
                for (XWPFTable t : fn.getTables())         totalReplaced += replaceInTable(t, sorted);
            }

            // Endnotes
            if (doc.getEndnotes() != null) {
                for (var en : doc.getEndnotes()) {
                    for (XWPFParagraph p : en.getParagraphs()) totalReplaced += replaceInParagraph(p, sorted);
                    for (XWPFTable t : en.getTables())         totalReplaced += replaceInTable(t, sorted);
                }
            }

            log.info("DOCX transform: {} total replacement(s) applied across document", totalReplaced);

            ByteArrayOutputStream out = new ByteArrayOutputStream(docxBytes.length);
            doc.write(out);
            return out.toByteArray();
        }
    }

    private int replaceInTable(XWPFTable table, List<Replacement> reps) {
        int n = 0;
        for (XWPFTableRow row : table.getRows()) {
            for (XWPFTableCell cell : row.getTableCells()) {
                for (XWPFParagraph p : cell.getParagraphs()) n += replaceInParagraph(p, reps);
                for (XWPFTable nested : cell.getTables())    n += replaceInTable(nested, reps);
            }
        }
        return n;
    }

    /** Apply ALL replacements to a single paragraph. Re-flattens after every match. */
    private int replaceInParagraph(XWPFParagraph p, List<Replacement> reps) {
        int count = 0;
        for (Replacement r : reps) {
            // Loop until no more occurrences of this specific raw text remain — there may be many.
            while (replaceFirstOccurrence(p, r.rawText(), r.token())) {
                count++;
            }
        }
        return count;
    }

    /**
     * Find the first occurrence of {@code raw} in the paragraph's concatenated text and replace
     * it with {@code token}, preserving formatting. Returns true if a replacement was made.
     *
     * <p>The algorithm operates on a fresh flattening because the previous call may have mutated
     * run text lengths.
     */
    private boolean replaceFirstOccurrence(XWPFParagraph p, String raw, String token) {
        if (raw == null || raw.isEmpty()) return false;

        List<RunChar> flat = flatten(p);
        if (flat.isEmpty()) return false;

        StringBuilder joined = new StringBuilder(flat.size());
        for (RunChar rc : flat) joined.append(rc.ch);
        int idx = joined.indexOf(raw);
        if (idx < 0) return false;

        RunChar first = flat.get(idx);
        RunChar last  = flat.get(idx + raw.length() - 1);

        if (first.run == last.run) {
            // Single-run case: simple splice within one run
            String t = first.run.getText(0);
            if (t == null) t = "";
            String replaced = t.substring(0, first.localOffset) + token + t.substring(last.localOffset + 1);
            first.run.setText(replaced, 0);
            return true;
        }

        // Multi-run case:
        //   firstRun.text  = prefix + token
        //   middle runs    = cleared
        //   lastRun.text   = suffix
        String firstText = first.run.getText(0);
        if (firstText == null) firstText = "";
        first.run.setText(firstText.substring(0, first.localOffset) + token, 0);

        String lastText = last.run.getText(0);
        if (lastText == null) lastText = "";
        last.run.setText(lastText.substring(last.localOffset + 1), 0);

        // Clear every run strictly between first and last
        List<XWPFRun> runs = p.getRuns();
        int firstIdx = runs.indexOf(first.run);
        int lastIdx  = runs.indexOf(last.run);
        if (firstIdx >= 0 && lastIdx > firstIdx + 1) {
            for (int i = firstIdx + 1; i < lastIdx; i++) {
                XWPFRun mid = runs.get(i);
                String midText = mid.getText(0);
                if (midText != null && !midText.isEmpty()) mid.setText("", 0);
                // Also clear additional text positions inside the run's CTR (multiple <w:t> children)
                CTR ctr = mid.getCTR();
                int tCount = ctr.sizeOfTArray();
                for (int j = tCount - 1; j >= 0; j--) ctr.removeT(j);
            }
        }
        return true;
    }

    /**
     * Flatten a paragraph's runs into a character-indexed list so we can find matches that
     * span multiple runs.
     *
     * <p>Runs that don't carry text (pure tabs, breaks, drawings, field codes) are skipped so
     * we never try to match across a page break or replace inside a field code.
     */
    private List<RunChar> flatten(XWPFParagraph p) {
        List<RunChar> out = new ArrayList<>();
        for (XWPFRun run : p.getRuns()) {
            // Skip runs that are field codes or math or pure drawings — replacing inside them
            // would corrupt the document.
            if (isFieldOrSpecialRun(run)) continue;

            String text = run.getText(0);
            if (text == null) continue;

            for (int i = 0; i < text.length(); ) {
                int cp = text.codePointAt(i);
                out.add(new RunChar(run, i, (char) cp));
                i += Character.charCount(cp);
            }
        }
        return out;
    }

    /**
     * Runs holding field codes ({@code <w:fldChar>}/{@code <w:instrText>}), math ({@code <w:oMath>}),
     * or only drawings should be left alone — their text is structural, not prose.
     */
    private boolean isFieldOrSpecialRun(XWPFRun run) {
        CTR ctr = run.getCTR();
        if (ctr.sizeOfFldCharArray()  > 0) return true;
        if (ctr.sizeOfInstrTextArray() > 0) return true;
        // A run with ONLY drawings / tabs / breaks and no <w:t> holds no replaceable prose.
        if (ctr.sizeOfTArray() == 0 && (ctr.sizeOfDrawingArray() > 0 || ctr.sizeOfTabArray() > 0 || ctr.sizeOfBrArray() > 0)) {
            return true;
        }
        return false;
    }

    /** {rawText, token} pair — "John Smith" -> "{{client_name}}". */
    public record Replacement(String rawText, String token) {
        public Replacement {
            if (rawText == null) throw new IllegalArgumentException("rawText is required");
            if (token   == null) throw new IllegalArgumentException("token is required");
        }
    }

    /** One character's provenance: which run it lives in and at what offset within that run. */
    private record RunChar(XWPFRun run, int localOffset, char ch) {}
}
