package com.bostoneo.bostoneosolutions.query;

public class ClientQuery {

    // SECURITY: Added organization_id filter to prevent cross-tenant data leakage
    public static final String STATS_QUERY = " SELECT c.total_clients, i.total_invoices, inv.total_billed FROM " +
            "(SELECT COUNT(*) total_clients FROM clients WHERE organization_id = :organizationId) c, " +
            "(SELECT COUNT(*) total_invoices FROM invoices WHERE organization_id = :organizationId) i, " +
            "(SELECT COALESCE(ROUND(SUM(total_amount)), 0) total_billed FROM invoices WHERE organization_id = :organizationId) inv";
}
