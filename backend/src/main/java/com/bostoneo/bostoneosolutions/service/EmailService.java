package com.***REMOVED***.***REMOVED***solutions.service;

import com.***REMOVED***.***REMOVED***solutions.enumeration.VerificationType;


public interface EmailService {

    void sendVerificationEmail(String firstName, String email, String verificationUrl, VerificationType verificationType);
}
