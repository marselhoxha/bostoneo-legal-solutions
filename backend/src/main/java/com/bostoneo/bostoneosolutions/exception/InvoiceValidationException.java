package com.***REMOVED***.***REMOVED***solutions.exception;

import java.util.List;

public class InvoiceValidationException extends RuntimeException {
    private final List<String> errors;
    
    public InvoiceValidationException(String message) {
        super(message);
        this.errors = null;
    }
    
    public InvoiceValidationException(String message, List<String> errors) {
        super(message + ": " + String.join(", ", errors));
        this.errors = errors;
    }
    
    public List<String> getErrors() {
        return errors;
    }
}