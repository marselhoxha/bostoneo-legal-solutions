package com.bostoneo.bostoneosolutions.query;

public class InvoicePaymentQuery {

    // ==================== TENANT-FILTERED QUERIES (SECURE) ====================

    public static final String INSERT_PAYMENT_WITH_ORG_QUERY = """
            INSERT INTO invoice_payments (invoice_id, organization_id, payment_date, amount, payment_method,
                reference_number, notes, created_by)
            VALUES (:invoiceId, :organizationId, :paymentDate, :amount, :paymentMethod,
                :referenceNumber, :notes, :createdBy)
            """;

    public static final String SELECT_PAYMENT_BY_ID_AND_ORG_QUERY = """
            SELECT * FROM invoice_payments WHERE id = :id AND organization_id = :organizationId
            """;

    public static final String SELECT_PAYMENTS_BY_INVOICE_AND_ORG_QUERY = """
            SELECT p.*, CONCAT(u.first_name, ' ', u.last_name) as created_by_name
            FROM invoice_payments p
            LEFT JOIN users u ON p.created_by = u.id
            WHERE p.invoice_id = :invoiceId AND p.organization_id = :organizationId
            ORDER BY p.payment_date DESC, p.created_at DESC
            """;

    public static final String GET_TOTAL_PAYMENTS_BY_INVOICE_AND_ORG_QUERY = """
            SELECT COALESCE(SUM(amount), 0) as total
            FROM invoice_payments
            WHERE invoice_id = :invoiceId AND organization_id = :organizationId
            """;

    public static final String DELETE_PAYMENT_BY_ID_AND_ORG_QUERY = """
            DELETE FROM invoice_payments WHERE id = :id AND organization_id = :organizationId
            """;

    public static final String SELECT_RECENT_PAYMENTS_BY_ORG_QUERY = """
            SELECT p.*, i.invoice_number, c.name as client_name
            FROM invoice_payments p
            JOIN invoices i ON p.invoice_id = i.id
            JOIN clients c ON i.client_id = c.id
            WHERE p.organization_id = :organizationId
            ORDER BY p.created_at DESC
            LIMIT :limit
            """;

    public static final String GET_TOTAL_PAYMENTS_BY_DATE_RANGE_AND_ORG_QUERY = """
            SELECT COALESCE(SUM(amount), 0) as total
            FROM invoice_payments
            WHERE organization_id = :organizationId
            AND payment_date BETWEEN :startDate AND :endDate
            """;

    // ==================== LEGACY QUERIES (DEPRECATED) ====================

    /** @deprecated Use INSERT_PAYMENT_WITH_ORG_QUERY for tenant isolation */
    @Deprecated
    public static final String INSERT_PAYMENT_QUERY = """
            INSERT INTO invoice_payments (invoice_id, payment_date, amount, payment_method,
                reference_number, notes, created_by)
            VALUES (:invoiceId, :paymentDate, :amount, :paymentMethod,
                :referenceNumber, :notes, :createdBy)
            """;

    /** @deprecated Use SELECT_PAYMENT_BY_ID_AND_ORG_QUERY for tenant isolation */
    @Deprecated
    public static final String SELECT_PAYMENT_BY_ID_QUERY = """
            SELECT * FROM invoice_payments WHERE id = :id
            """;

    /** @deprecated Use SELECT_PAYMENTS_BY_INVOICE_AND_ORG_QUERY for tenant isolation */
    @Deprecated
    public static final String SELECT_PAYMENTS_BY_INVOICE_ID_QUERY = """
            SELECT p.*, CONCAT(u.first_name, ' ', u.last_name) as created_by_name
            FROM invoice_payments p
            LEFT JOIN users u ON p.created_by = u.id
            WHERE p.invoice_id = :invoiceId
            ORDER BY p.payment_date DESC, p.created_at DESC
            """;

    /** @deprecated Use GET_TOTAL_PAYMENTS_BY_INVOICE_AND_ORG_QUERY for tenant isolation */
    @Deprecated
    public static final String GET_TOTAL_PAYMENTS_BY_INVOICE_QUERY = """
            SELECT COALESCE(SUM(amount), 0) as total
            FROM invoice_payments
            WHERE invoice_id = :invoiceId
            """;

    /** @deprecated Use DELETE_PAYMENT_BY_ID_AND_ORG_QUERY for tenant isolation */
    @Deprecated
    public static final String DELETE_PAYMENT_QUERY = """
            DELETE FROM invoice_payments WHERE id = :id
            """;

    /** @deprecated Use SELECT_RECENT_PAYMENTS_BY_ORG_QUERY for tenant isolation */
    @Deprecated
    public static final String SELECT_RECENT_PAYMENTS_QUERY = """
            SELECT p.*, i.invoice_number, c.name as client_name
            FROM invoice_payments p
            JOIN invoices i ON p.invoice_id = i.id
            JOIN clients c ON i.client_id = c.id
            ORDER BY p.created_at DESC
            LIMIT :limit
            """;

    /** @deprecated Use GET_TOTAL_PAYMENTS_BY_DATE_RANGE_AND_ORG_QUERY for tenant isolation */
    @Deprecated
    public static final String GET_TOTAL_PAYMENTS_BY_DATE_RANGE_QUERY = """
            SELECT COALESCE(SUM(amount), 0) as total
            FROM invoice_payments
            WHERE payment_date BETWEEN :startDate AND :endDate
            """;
}