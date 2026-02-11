package com.bostoneo.bostoneosolutions.util;

import com.bostoneo.bostoneosolutions.exception.ApiException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class PasswordPolicyValidator {

    @Value("${app.password.min-length:12}")
    private int minLength;

    @Value("${app.password.require-uppercase:true}")
    private boolean requireUppercase;

    @Value("${app.password.require-lowercase:true}")
    private boolean requireLowercase;

    @Value("${app.password.require-numbers:true}")
    private boolean requireNumbers;

    @Value("${app.password.require-special-chars:true}")
    private boolean requireSpecialChars;

    public void validate(String password) {
        if (password == null || password.length() < minLength) {
            throw new ApiException("Password must be at least " + minLength + " characters long.");
        }
        if (requireUppercase && !password.matches(".*[A-Z].*")) {
            throw new ApiException("Password must contain at least one uppercase letter.");
        }
        if (requireLowercase && !password.matches(".*[a-z].*")) {
            throw new ApiException("Password must contain at least one lowercase letter.");
        }
        if (requireNumbers && !password.matches(".*\\d.*")) {
            throw new ApiException("Password must contain at least one number.");
        }
        if (requireSpecialChars && !password.matches(".*[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>/?].*")) {
            throw new ApiException("Password must contain at least one special character.");
        }
    }
}
