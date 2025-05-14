package com.***REMOVED***.***REMOVED***solutions.constant;

public class Authority {
    // Calendar authorities
    public static final String[] CALENDAR_AUTHORITIES = { "READ:CALENDAR", "CREATE:CALENDAR", "UPDATE:CALENDAR", "DELETE:CALENDAR", "SYNC:CALENDAR" };
    
    // Existing authorities in the correct format based on the database
    public static final String[] USER_AUTHORITIES = { "READ:USER", "UPDATE:USER" };
    public static final String[] ADMIN_AUTHORITIES = { "READ:USER", "CREATE:USER", "UPDATE:USER", "DELETE:USER" };
    public static final String[] SUPER_ADMIN_AUTHORITIES = { "READ:USER", "CREATE:USER", "UPDATE:USER", "DELETE:USER" };
    public static final String[] CUSTOMER_AUTHORITIES = { "READ:CUSTOMER", "CREATE:CUSTOMER", "UPDATE:CUSTOMER" };
    public static final String[] EXPENSE_AUTHORITIES = { "READ:EXPENSE", "CREATE:EXPENSE", "UPDATE:EXPENSE", "DELETE:EXPENSE" };
    public static final String[] REPORT_AUTHORITIES = { "READ:REPORT", "CREATE:REPORT", "UPDATE:REPORT", "DELETE:REPORT" };
    public static final String[] INVOICE_AUTHORITIES = { "READ:INVOICE", "CREATE:INVOICE", "UPDATE:INVOICE", "DELETE:INVOICE" };
    public static final String[] CASES_AUTHORITIES = { "READ:CASE", "CREATE:CASE", "UPDATE:CASE", "DELETE:CASE" };
    
    private Authority() {}
} 