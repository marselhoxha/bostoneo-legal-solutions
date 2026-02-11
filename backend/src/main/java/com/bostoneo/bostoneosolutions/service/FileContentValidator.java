package com.bostoneo.bostoneosolutions.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.Map;

/**
 * Validates file content by checking magic bytes to prevent executable uploads
 * disguised as documents. Replace with ClamAV integration for production virus scanning.
 */
@Service
@Slf4j
public class FileContentValidator {

    // Dangerous magic bytes (executables, scripts)
    private static final Map<String, byte[]> DANGEROUS_SIGNATURES = Map.of(
            "EXE/DLL (MZ)", new byte[]{0x4D, 0x5A},
            "ELF binary", new byte[]{0x7F, 0x45, 0x4C, 0x46},
            "Java class", new byte[]{(byte) 0xCA, (byte) 0xFE, (byte) 0xBA, (byte) 0xBE},
            "Shell script", new byte[]{0x23, 0x21}  // #!
    );

    /**
     * Validates file content is safe for upload.
     * @return true if file passes validation, false if suspicious
     */
    public boolean validate(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) return true;

        try (InputStream is = file.getInputStream()) {
            byte[] header = new byte[8];
            int read = is.read(header);
            if (read < 2) return true;

            for (Map.Entry<String, byte[]> sig : DANGEROUS_SIGNATURES.entrySet()) {
                if (startsWith(header, sig.getValue())) {
                    log.warn("SECURITY: Blocked upload of file '{}' — matched dangerous signature: {}",
                            file.getOriginalFilename(), sig.getKey());
                    return false;
                }
            }
        }

        return true;
    }

    private boolean startsWith(byte[] data, byte[] prefix) {
        if (data.length < prefix.length) return false;
        for (int i = 0; i < prefix.length; i++) {
            if (data[i] != prefix[i]) return false;
        }
        return true;
    }
}
