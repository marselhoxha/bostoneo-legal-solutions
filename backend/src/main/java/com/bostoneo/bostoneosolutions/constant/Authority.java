package com.bostoneo.bostoneosolutions.constant;

public class Authority {
    // Calendar authorities
    public static final String[] CALENDAR_AUTHORITIES = { "CALENDAR:VIEW", "CALENDAR:CREATE", "CALENDAR:EDIT", "CALENDAR:DELETE", "CALENDAR:SYNC" };
    
    // Existing authorities in the correct format based on the database
    public static final String[] USER_AUTHORITIES = { "READ:USER", "UPDATE:USER" };
    public static final String[] ADMIN_AUTHORITIES = { "READ:USER", "CREATE:USER", "UPDATE:USER", "DELETE:USER" };
    public static final String[] SUPER_ADMIN_AUTHORITIES = { "READ:USER", "CREATE:USER", "UPDATE:USER", "DELETE:USER" };
    public static final String[] CLIENT_AUTHORITIES = { "READ:CLIENT", "CREATE:CLIENT", "UPDATE:CLIENT" };
    public static final String[] EXPENSE_AUTHORITIES = { "READ:EXPENSE", "CREATE:EXPENSE", "UPDATE:EXPENSE", "DELETE:EXPENSE" };
    public static final String[] REPORT_AUTHORITIES = { "READ:REPORT", "CREATE:REPORT", "UPDATE:REPORT", "DELETE:REPORT" };
    public static final String[] INVOICE_AUTHORITIES = { "READ:INVOICE", "CREATE:INVOICE", "UPDATE:INVOICE", "DELETE:INVOICE" };
    public static final String[] CASES_AUTHORITIES = { "READ:CASE", "CREATE:CASE", "UPDATE:CASE", "DELETE:CASE" };
    
    private Authority() {}
} 