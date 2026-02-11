package com.bostoneo.bostoneosolutions.util;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;
import java.security.SecureRandom;
import java.security.spec.KeySpec;
import java.util.Base64;

@Component
@Slf4j
public class EncryptionUtil {

    private static final String ALGORITHM = "AES/CBC/PKCS5Padding";
    private static final String SECRET_KEY_ALGORITHM = "PBKDF2WithHmacSHA256";
    private static final int ITERATION_COUNT = 65536;
    private static final int KEY_LENGTH = 256;
    private static final int IV_LENGTH = 16;

    private static final java.util.Set<String> INSECURE_DEFAULTS = java.util.Set.of(
            "default-encryption-secret-key", "dev-encryption-secret-change-prod",
            "default-salt-value", "dev-salt-value-change-in-production"
    );

    private final Environment environment;

    @Value("${encryption.secret}")
    private String encryptionSecret;

    @Value("${encryption.salt}")
    private String salt;

    public EncryptionUtil(Environment environment) {
        this.environment = environment;
    }

    @PostConstruct
    public void validateEncryptionConfig() {
        boolean isProduction = environment.matchesProfiles("prod | staging");
        if (INSECURE_DEFAULTS.contains(encryptionSecret) || INSECURE_DEFAULTS.contains(salt)) {
            if (isProduction) {
                throw new IllegalStateException(
                        "CRITICAL: Encryption secret/salt must be changed from defaults in production/staging. " +
                        "Set ENCRYPTION_SECRET and ENCRYPTION_SALT environment variables.");
            }
            log.warn("WARNING: Using default encryption secret/salt. This is acceptable for dev only.");
        }
    }
    
    public String encrypt(String data) {
        if (data == null) return null;
        
        try {
            // Generate IV
            byte[] iv = new byte[IV_LENGTH];
            SecureRandom random = new SecureRandom();
            random.nextBytes(iv);
            IvParameterSpec ivSpec = new IvParameterSpec(iv);
            
            // Generate secret key
            SecretKey secretKey = generateSecretKey();
            
            // Encrypt
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.ENCRYPT_MODE, secretKey, ivSpec);
            byte[] encrypted = cipher.doFinal(data.getBytes());
            
            // Combine IV and encrypted data
            byte[] combined = new byte[IV_LENGTH + encrypted.length];
            System.arraycopy(iv, 0, combined, 0, IV_LENGTH);
            System.arraycopy(encrypted, 0, combined, IV_LENGTH, encrypted.length);
            
            return Base64.getEncoder().encodeToString(combined);
        } catch (Exception e) {
            throw new RuntimeException("Error encrypting data", e);
        }
    }
    
    public String decrypt(String encryptedData) {
        if (encryptedData == null) return null;
        
        try {
            byte[] combined = Base64.getDecoder().decode(encryptedData);
            
            // Extract IV
            byte[] iv = new byte[IV_LENGTH];
            System.arraycopy(combined, 0, iv, 0, IV_LENGTH);
            IvParameterSpec ivSpec = new IvParameterSpec(iv);
            
            // Extract encrypted data
            byte[] encrypted = new byte[combined.length - IV_LENGTH];
            System.arraycopy(combined, IV_LENGTH, encrypted, 0, encrypted.length);
            
            // Generate secret key
            SecretKey secretKey = generateSecretKey();
            
            // Decrypt
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.DECRYPT_MODE, secretKey, ivSpec);
            byte[] decrypted = cipher.doFinal(encrypted);
            
            return new String(decrypted);
        } catch (Exception e) {
            throw new RuntimeException("Error decrypting data", e);
        }
    }
    
    private SecretKey generateSecretKey() throws Exception {
        SecretKeyFactory factory = SecretKeyFactory.getInstance(SECRET_KEY_ALGORITHM);
        KeySpec spec = new PBEKeySpec(encryptionSecret.toCharArray(), salt.getBytes(), ITERATION_COUNT, KEY_LENGTH);
        SecretKey tmp = factory.generateSecret(spec);
        return new SecretKeySpec(tmp.getEncoded(), "AES");
    }
    
    // Helper methods for specific field types
    public String encryptAccountNumber(String accountNumber) {
        if (accountNumber == null || accountNumber.length() <= 4) return accountNumber;
        
        // Keep last 4 digits visible
        String last4 = accountNumber.substring(accountNumber.length() - 4);
        String toEncrypt = accountNumber.substring(0, accountNumber.length() - 4);
        
        return encrypt(toEncrypt) + ":" + last4;
    }
    
    public String decryptAccountNumber(String encryptedAccountNumber) {
        if (encryptedAccountNumber == null || !encryptedAccountNumber.contains(":")) {
            return encryptedAccountNumber;
        }
        
        String[] parts = encryptedAccountNumber.split(":");
        String decryptedPart = decrypt(parts[0]);
        return decryptedPart + parts[1];
    }
}