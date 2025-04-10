package com.***REMOVED***.***REMOVED***solutions.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

@ResponseStatus(HttpStatus.NOT_FOUND)
public class LegalCaseException extends RuntimeException {
    public LegalCaseException(String message) {
        super(message);
    }
} 