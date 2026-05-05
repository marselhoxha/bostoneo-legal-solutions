package com.bostoneo.bostoneosolutions.service.ai.importing;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;

/**
 * Subprocess wrapper for LibreOffice headless conversions used by the Path-C canonical
 * pipeline:
 * <ul>
 *   <li>{@link #convertToDocx(byte[], SourceFormat)} — PDF or legacy DOC → DOCX, used at
 *       import time so every template ends up in DOCX form regardless of upload format.</li>
 *   <li>{@link #renderToPdf(byte[])} — DOCX → PDF, used to produce the wizard preview
 *       and the "Download as PDF" output.</li>
 * </ul>
 *
 * <p>Spawns {@code soffice --headless --convert-to <fmt>} per call. The subprocess is heavy
 * (~500 MB RAM, 1–3 s per conversion), so all calls go through a {@link Semaphore} cap
 * (default 3 concurrent — configurable via {@code template.import.libreoffice.max-concurrent})
 * to prevent OOM on multi-file batches.
 *
 * <p>{@link #isEnabled()} reports whether the configured {@code soffice} binary is reachable.
 * Callers should check it once and fall back to legacy text-extraction paths when LibreOffice
 * is unavailable (typical on a fresh dev machine without LibreOffice installed).
 */
@Service
@Slf4j
public class LibreOfficeConverterService {

    public enum SourceFormat {
        PDF("pdf"), DOC("doc");
        final String extension;
        SourceFormat(String extension) { this.extension = extension; }
    }

    @Value("${template.import.libreoffice.enabled:true}")
    private boolean enabled;

    @Value("${template.import.libreoffice.command:soffice}")
    private String command;

    @Value("${template.import.libreoffice.timeout-seconds:60}")
    private int timeoutSeconds;

    @Value("${template.import.libreoffice.max-concurrent:3}")
    private int maxConcurrent;

    private Semaphore slots;
    private Boolean reachableCache;  // tri-state: null=not checked, true/false=cached result

    /**
     * Returns true when the configured {@code soffice} command is reachable AND the flag is on.
     *
     * <p>We DO NOT run {@code soffice --version} as a probe — LibreOffice's first-run on macOS
     * can hang in profile init / Gatekeeper checks, and a hung subprocess deadlocks the
     * extraction pipeline. Instead we just verify the binary exists at the configured path.
     * If it's bogus, the first real conversion call will fail loudly with a clean exception.
     */
    public boolean isEnabled() {
        if (!enabled) {
            return false;
        }
        if (reachableCache != null) return reachableCache;
        synchronized (this) {
            if (reachableCache != null) return reachableCache;
            try {
                Path bin = Path.of(command);
                if (bin.isAbsolute()) {
                    if (!Files.isExecutable(bin)) {
                        log.warn("LibreOffice binary not found or not executable at '{}' — disabling converter", command);
                        reachableCache = false;
                    } else {
                        reachableCache = true;
                    }
                } else {
                    // Bare command name — trust PATH lookup; first conversion surfaces any failure.
                    reachableCache = true;
                }
            } catch (Exception e) {
                log.warn("LibreOffice reachability check threw for '{}': {} — disabling converter",
                    command, e.getMessage());
                reachableCache = false;
            }
            if (reachableCache) {
                slots = new Semaphore(Math.max(1, maxConcurrent), true);
                log.info("LibreOffice converter ready (command='{}', maxConcurrent={})",
                    command, maxConcurrent);
            } else {
                log.warn("LibreOffice converter DISABLED for this JVM. PDF/DOC uploads will fall back "
                    + "to text-only PDFBox extraction.");
            }
            return reachableCache;
        }
    }

    public byte[] convertToDocx(byte[] sourceBytes, SourceFormat format) throws ConversionException {
        return convert(sourceBytes, format.extension, "docx");
    }

    public byte[] renderToPdf(byte[] docxBytes) throws ConversionException {
        return convert(docxBytes, "docx", "pdf");
    }

    private byte[] convert(byte[] inputBytes, String inputExt, String outputExt) throws ConversionException {
        if (!isEnabled()) {
            throw new ConversionException("LibreOffice is not enabled or not reachable on this host");
        }
        Path tmpDir = null;
        boolean acquired = false;
        try {
            slots.acquire();
            acquired = true;

            tmpDir = Files.createTempDirectory("legience-soffice-");
            Path inputFile = tmpDir.resolve("input-" + UUID.randomUUID() + "." + inputExt);
            Files.write(inputFile, inputBytes);

            // Isolate this invocation in its own profile dir. Critical for two reasons:
            //   1. Prevents lock contention with the user's interactive LibreOffice profile
            //      (which is what causes "first run from JVM hangs" — soffice tries to grab
            //      ~/.config/libreoffice/4/user/.~lock and blocks indefinitely).
            //   2. Skips first-run dialogs and the "did LibreOffice crash?" recovery prompt.
            Path profileDir = tmpDir.resolve("soffice-profile");
            Files.createDirectories(profileDir);
            String userInstallation = "-env:UserInstallation=file://" + profileDir.toAbsolutePath();

            ProcessBuilder pb = new ProcessBuilder(
                command,
                userInstallation,
                "--headless",
                "--norestore",                // skip crash-recovery prompt
                "--nologo",                   // skip splash
                "--nofirststartwizard",       // skip the welcome wizard
                "--nodefault",                // don't open Start Center
                "--nolockcheck",              // don't probe for other instances
                "--convert-to", outputExt,
                "--outdir", tmpDir.toString(),
                inputFile.toString()
            ).redirectErrorStream(true);

            Process process = pb.start();

            // Drain stdout/stderr in a daemon thread so a noisy subprocess doesn't deadlock
            // on a full pipe buffer (~16-64 KB on macOS) while we waitFor.
            StringBuilder output = new StringBuilder();
            java.io.InputStream is = process.getInputStream();
            Thread drainer = new Thread(() -> {
                byte[] buf = new byte[4096];
                try {
                    int n;
                    while ((n = is.read(buf)) > 0) {
                        synchronized (output) { output.append(new String(buf, 0, n)); }
                    }
                } catch (IOException ignore) { /* pipe closed */ }
            }, "soffice-stdout-drain");
            drainer.setDaemon(true);
            drainer.start();

            boolean finished = process.waitFor(timeoutSeconds, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                drainer.join(2_000);
                String partial; synchronized (output) { partial = output.toString(); }
                throw new ConversionException("LibreOffice timed out after " + timeoutSeconds + "s. Output: " + partial);
            }
            drainer.join(2_000);  // drain remaining bytes after process exits
            String captured; synchronized (output) { captured = output.toString(); }

            int exit = process.exitValue();
            if (exit != 0) {
                throw new ConversionException("LibreOffice exited " + exit + ". Output: " + captured);
            }

            // Locate the converted file (LibreOffice names it <basename>.<outputExt>).
            String inputBaseName = inputFile.getFileName().toString();
            String outputBaseName = inputBaseName.substring(0, inputBaseName.lastIndexOf('.')) + "." + outputExt;
            Path outputFile = tmpDir.resolve(outputBaseName);
            if (!Files.exists(outputFile)) {
                throw new ConversionException(
                    "LibreOffice did not produce expected output file " + outputFile + ". Output: " + captured
                );
            }
            return Files.readAllBytes(outputFile);

        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            throw new ConversionException("LibreOffice conversion interrupted", ie);
        } catch (IOException ioe) {
            throw new ConversionException("I/O error during LibreOffice conversion: " + ioe.getMessage(), ioe);
        } finally {
            if (acquired) slots.release();
            if (tmpDir != null) deleteRecursive(tmpDir);
        }
    }

    private void deleteRecursive(Path path) {
        if (!Files.exists(path)) return;
        try (Stream<Path> walk = Files.walk(path)) {
            walk.sorted((a, b) -> b.getNameCount() - a.getNameCount())
                .forEach(p -> {
                    try { Files.deleteIfExists(p); } catch (IOException ignored) { /* best-effort */ }
                });
        } catch (IOException e) {
            log.debug("Failed to clean up LibreOffice tmpdir {}: {}", path, e.getMessage());
        }
    }

    /** Thrown when LibreOffice fails or is unavailable. Caller should fall back to legacy path. */
    public static class ConversionException extends RuntimeException {
        public ConversionException(String message) { super(message); }
        public ConversionException(String message, Throwable cause) { super(message, cause); }
    }
}
