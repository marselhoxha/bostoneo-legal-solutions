package com.***REMOVED***.***REMOVED***solutions.enumeration;

public enum DocumentCategory {
    // RBAC-compliant categories
    PUBLIC,                      // Accessible to all authorized users including clients
    INTERNAL,                    // Staff only (not clients)
    CONFIDENTIAL,                // Attorney/Admin only
    ATTORNEY_CLIENT_PRIVILEGE    // Attorney + specific client only
} 


 
 