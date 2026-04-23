package com.bostoneo.bostoneosolutions.service.ai.importing;

/**
 * A non-fatal issue detected during template import extraction or analysis.
 * The import can continue; the attorney reviews these before committing.
 */
public record ImportWarning(Severity severity, String code, String message) {
    public enum Severity { INFO, WARNING, ERROR }

    public static ImportWarning info(String code, String message) {
        return new ImportWarning(Severity.INFO, code, message);
    }
    public static ImportWarning warning(String code, String message) {
        return new ImportWarning(Severity.WARNING, code, message);
    }
    public static ImportWarning error(String code, String message) {
        return new ImportWarning(Severity.ERROR, code, message);
    }
}
