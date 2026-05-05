package com.bostoneo.bostoneosolutions.service.ai.importing;

/**
 * Thrown when a template upload cannot be extracted for a reason the attorney can resolve
 * (e.g., scanned PDF, password-protected file, unsupported format). The message is safe to
 * display to the user; the code is stable for frontend error-handling.
 */
public class TemplateImportException extends RuntimeException {

    public enum Code {
        SCANNED_PDF,
        ENCRYPTED_FILE,
        UNSUPPORTED_FORMAT,
        FILE_TOO_LARGE,
        CORRUPT_FILE,
        EMPTY_DOCUMENT,
        /** Unrecoverable infra-side error (S3 upload failure, Textract job failure, polling timeout, etc.). */
        INTERNAL_ERROR
    }

    private final Code code;

    public TemplateImportException(Code code, String message) {
        super(message);
        this.code = code;
    }

    public TemplateImportException(Code code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    public Code getCode() {
        return code;
    }
}
