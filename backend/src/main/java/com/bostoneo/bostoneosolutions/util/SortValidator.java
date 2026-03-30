package com.bostoneo.bostoneosolutions.util;

import java.util.Set;

/**
 * SECURITY: Validates user-supplied sortBy parameters against whitelists to prevent
 * HQL injection and information disclosure via Sort.by() in Spring Data.
 * Invalid sort fields silently fall back to "createdAt".
 */
public final class SortValidator {

    private SortValidator() {}

    // Common fields shared by most entities
    private static final Set<String> COMMON_FIELDS = Set.of(
        "id", "createdAt", "updatedAt"
    );

    private static final Set<String> CASE_FIELDS = Set.of(
        "id", "createdAt", "updatedAt", "title", "caseNumber", "status",
        "practiceArea", "priority", "caseType", "openDate", "closeDate"
    );

    private static final Set<String> FILE_FIELDS = Set.of(
        "id", "createdAt", "updatedAt", "originalName", "name", "size",
        "mimeType", "fileType", "category"
    );

    private static final Set<String> TASK_FIELDS = Set.of(
        "id", "createdAt", "updatedAt", "title", "priority", "status",
        "dueDate", "assignedTo", "taskType"
    );

    private static final Set<String> LEAD_FIELDS = Set.of(
        "id", "createdAt", "updatedAt", "firstName", "lastName", "email",
        "status", "source", "phone"
    );

    private static final Set<String> INVOICE_FIELDS = Set.of(
        "id", "createdAt", "updatedAt", "invoiceNumber", "status",
        "totalAmount", "dueDate", "issueDate", "paidDate"
    );

    private static final Set<String> USER_FIELDS = Set.of(
        "id", "createdAt", "updatedAt", "firstName", "lastName", "email",
        "enabled", "roleName"
    );

    private static final Set<String> SUBMISSION_FIELDS = Set.of(
        "id", "createdAt", "updatedAt", "submittedAt", "status",
        "firstName", "lastName", "email"
    );

    private static final Set<String> CONFLICT_CHECK_FIELDS = Set.of(
        "id", "createdAt", "updatedAt", "checkDate", "status", "result"
    );

    private static final Set<String> SIGNATURE_FIELDS = Set.of(
        "id", "createdAt", "updatedAt", "documentTitle", "status",
        "sentAt", "completedAt", "expiresAt"
    );

    private static final Set<String> ASSIGNMENT_FIELDS = Set.of(
        "id", "createdAt", "updatedAt", "assignedAt", "role", "status"
    );

    private static final Set<String> ORGANIZATION_FIELDS = Set.of(
        "id", "createdAt", "updatedAt", "name", "firmType", "status"
    );

    private static final Set<String> PI_PORTFOLIO_FIELDS = Set.of(
        "id", "createdAt", "updatedAt", "title", "status", "filedDate",
        "totalDamages", "settlementAmount"
    );

    private static final String DEFAULT_SORT = "createdAt";

    public static String forCases(String sortBy) { return validate(sortBy, CASE_FIELDS); }
    public static String forFiles(String sortBy) { return validate(sortBy, FILE_FIELDS); }
    public static String forTasks(String sortBy) { return validate(sortBy, TASK_FIELDS); }
    public static String forLeads(String sortBy) { return validate(sortBy, LEAD_FIELDS); }
    public static String forInvoices(String sortBy) { return validate(sortBy, INVOICE_FIELDS); }
    public static String forUsers(String sortBy) { return validate(sortBy, USER_FIELDS); }
    public static String forSubmissions(String sortBy) { return validate(sortBy, SUBMISSION_FIELDS); }
    public static String forConflictChecks(String sortBy) { return validate(sortBy, CONFLICT_CHECK_FIELDS); }
    public static String forSignatures(String sortBy) { return validate(sortBy, SIGNATURE_FIELDS); }
    public static String forAssignments(String sortBy) { return validate(sortBy, ASSIGNMENT_FIELDS); }
    public static String forOrganizations(String sortBy) { return validate(sortBy, ORGANIZATION_FIELDS); }
    public static String forPIPortfolio(String sortBy) { return validate(sortBy, PI_PORTFOLIO_FIELDS); }
    public static String forGeneric(String sortBy) { return validate(sortBy, COMMON_FIELDS); }

    private static String validate(String sortBy, Set<String> allowed) {
        if (sortBy == null || sortBy.isBlank() || !allowed.contains(sortBy.trim())) {
            return DEFAULT_SORT;
        }
        return sortBy.trim();
    }
}
