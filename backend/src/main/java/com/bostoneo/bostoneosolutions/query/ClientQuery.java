package com.***REMOVED***.***REMOVED***solutions.query;

public class ClientQuery {

    public static final String STATS_QUERY = " SELECT c.total_clients, i.total_invoices, inv.total_billed FROM " +
            "(SELECT COUNT(*) total_clients FROM clients) c, " +
            "(SELECT COUNT(*) total_invoices FROM invoices) i, " +
            "(SELECT ROUND(SUM(total_amount)) total_billed FROM invoices) inv";
}
