package com.bostoneo.bostoneosolutions.converter;

import com.bostoneo.bostoneosolutions.util.EncryptionUtil;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
@Converter
@Slf4j
public class EncryptedStringConverter implements AttributeConverter<String, String> {
    
    private static EncryptionUtil encryptionUtil;
    
    @Autowired
    public void setEncryptionUtil(EncryptionUtil util) {
        EncryptedStringConverter.encryptionUtil = util;
    }
    
    @Override
    public String convertToDatabaseColumn(String attribute) {
        if (encryptionUtil == null || attribute == null) {
            return attribute;
        }
        return encryptionUtil.encrypt(attribute);
    }
    
    @Override
    public String convertToEntityAttribute(String dbData) {
        if (encryptionUtil == null || dbData == null) {
            return dbData;
        }
        try {
            return encryptionUtil.decrypt(dbData);
        } catch (Exception e) {
            // Graceful fallback: plaintext data written before encryption was enabled
            log.debug("Decryption fallback — plaintext data not yet migrated to encryption");
            return dbData;
        }
    }
}