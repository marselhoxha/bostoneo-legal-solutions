package com.***REMOVED***.***REMOVED***solutions.util;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CustomHttpResponse<T> {
    private int statusCode;
    private String message;
    private T data;
    
    public CustomHttpResponse(String message, T data) {
        this.statusCode = 200;
        this.message = message;
        this.data = data;
    }
} 