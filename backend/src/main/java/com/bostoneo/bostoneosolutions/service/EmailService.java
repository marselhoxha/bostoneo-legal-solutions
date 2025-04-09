package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.enumeration.VerificationType;


public interface EmailService {

    void sendVerificationEmail(String firstName, String email, String verificationUrl, VerificationType verificationType);
}
