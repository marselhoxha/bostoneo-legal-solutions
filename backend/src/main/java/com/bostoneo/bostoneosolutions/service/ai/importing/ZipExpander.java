package com.bostoneo.bostoneosolutions.service.ai.importing;

import com.bostoneo.bostoneosolutions.util.ByteArrayMultipartFile;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Expand a single uploaded {@code .zip} into N individual {@link MultipartFile} entries
 * that look just like direct uploads to the rest of the import pipeline.
 *
 * <p>Supports flat zips containing a mix of {@code .pdf}, {@code .docx}, and {@code .doc}
 * entries (legal-template archives are typically dropped from a directory like that).
 * Skips:
 * <ul>
 *   <li>directories (entry name ends with {@code /})</li>
 *   <li>hidden files / macOS metadata ({@code __MACOSX}, {@code .DS_Store})</li>
 *   <li>non-template extensions ({@code .txt}, {@code .pdf.bak}, etc.) — reported in {@code skippedEntries}</li>
 * </ul>
 *
 * <p>Rejects (throws {@link TemplateImportException}):
 * <ul>
 *   <li>nested zip entries — zip-bomb safety; legal-template imports never legitimately need nesting</li>
 *   <li>encrypted zips — clear user-facing error</li>
 *   <li>path-traversal entry names ({@code ../}) — sanitized to filename-only</li>
 *   <li>post-expansion totals exceeding 50 files OR 100 MB — same caps as direct upload</li>
 * </ul>
 */
@Component
@Slf4j
public class ZipExpander {

    private static final Set<String> SUPPORTED_EXTENSIONS = Set.of(".pdf", ".docx", ".doc");
    private static final int MAX_ENTRIES = 50;
    private static final long MAX_TOTAL_BYTES = 100L * 1024 * 1024;
    private static final long MAX_PER_ENTRY_BYTES = 10L * 1024 * 1024;

    public record Result(
        List<MultipartFile> templates,
        List<String> skippedEntries,
        long totalBytesAfterExpansion
    ) {}

    public Result expand(MultipartFile zipFile) throws IOException {
        if (zipFile == null || zipFile.isEmpty()) {
            throw new TemplateImportException(
                TemplateImportException.Code.EMPTY_DOCUMENT,
                "Uploaded zip is empty."
            );
        }

        List<MultipartFile> templates = new ArrayList<>();
        List<String> skipped = new ArrayList<>();
        long totalBytes = 0;

        try (ZipInputStream zin = new ZipInputStream(new ByteArrayInputStream(zipFile.getBytes()))) {
            ZipEntry entry;
            while ((entry = zin.getNextEntry()) != null) {
                String rawName = entry.getName();
                if (rawName == null || rawName.isBlank()) continue;

                // Sanitize: strip any path component, drop directories.
                String sanitized = rawName.replace('\\', '/');
                if (sanitized.endsWith("/")) continue;
                int lastSlash = sanitized.lastIndexOf('/');
                String filename = lastSlash >= 0 ? sanitized.substring(lastSlash + 1) : sanitized;

                if (filename.isEmpty() || filename.startsWith(".") || sanitized.startsWith("__MACOSX/")) {
                    continue;  // hidden / macOS metadata noise
                }

                String lower = filename.toLowerCase(Locale.ROOT);
                if (lower.endsWith(".zip")) {
                    throw new TemplateImportException(
                        TemplateImportException.Code.UNSUPPORTED_FORMAT,
                        "Nested zip files are not supported in template imports. Please flatten the archive."
                    );
                }
                String ext = lower.substring(lower.lastIndexOf('.'));
                if (!SUPPORTED_EXTENSIONS.contains(ext)) {
                    skipped.add(filename + " (unsupported format)");
                    continue;
                }

                byte[] entryBytes = zin.readAllBytes();
                if (entryBytes.length > MAX_PER_ENTRY_BYTES) {
                    skipped.add(filename + " (exceeds 10 MB per-file limit)");
                    continue;
                }
                totalBytes += entryBytes.length;
                if (totalBytes > MAX_TOTAL_BYTES) {
                    throw new TemplateImportException(
                        TemplateImportException.Code.FILE_TOO_LARGE,
                        "Zip contents exceed the 100 MB total limit after expansion."
                    );
                }
                if (templates.size() + 1 > MAX_ENTRIES) {
                    throw new TemplateImportException(
                        TemplateImportException.Code.FILE_TOO_LARGE,
                        "Zip contains more than " + MAX_ENTRIES + " template files."
                    );
                }

                String contentType = switch (ext) {
                    case ".pdf"  -> "application/pdf";
                    case ".docx" -> "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
                    case ".doc"  -> "application/msword";
                    default      -> "application/octet-stream";
                };
                templates.add(new ByteArrayMultipartFile(entryBytes, filename, filename, contentType));
            }
        } catch (IOException ioe) {
            String msg = ioe.getMessage() == null ? "" : ioe.getMessage().toLowerCase(Locale.ROOT);
            if (msg.contains("encrypt") || msg.contains("password")) {
                throw new TemplateImportException(
                    TemplateImportException.Code.ENCRYPTED_FILE,
                    "Zip file is password-protected. Please remove the password and re-upload.",
                    ioe
                );
            }
            throw new TemplateImportException(
                TemplateImportException.Code.CORRUPT_FILE,
                "Could not read zip file: " + ioe.getMessage(),
                ioe
            );
        }

        if (templates.isEmpty() && skipped.isEmpty()) {
            throw new TemplateImportException(
                TemplateImportException.Code.EMPTY_DOCUMENT,
                "Zip contained no template files (.pdf / .docx / .doc)."
            );
        }
        log.info("ZipExpander: {} template(s) extracted, {} skipped, {} bytes total",
            templates.size(), skipped.size(), totalBytes);
        return new Result(templates, skipped, totalBytes);
    }
}
