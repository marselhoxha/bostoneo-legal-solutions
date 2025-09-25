package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.model.AILegalTemplate;
import com.bostoneo.bostoneosolutions.repository.AILegalTemplateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.util.HexFormat;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class PDFStorageService {

    private final AILegalTemplateRepository templateRepository;

    @Value("${app.pdf-forms.storage-path:backend/uploads/pdf-forms}")
    private String pdfStoragePath;

    public String downloadAndStorePDF(String pdfUrl, String filename) throws Exception {
        log.info("Downloading PDF from URL: {}", pdfUrl);

        // Create storage directory if it doesn't exist
        Path storageDir = Paths.get(pdfStoragePath);
        Files.createDirectories(storageDir);

        // Generate filename if not provided
        if (filename == null || filename.isEmpty()) {
            filename = generateFilenameFromUrl(pdfUrl);
        }

        Path filePath = storageDir.resolve(filename);

        // Download PDF
        URL url = new URL(pdfUrl);
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod("GET");
        connection.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
        connection.setConnectTimeout(10000);
        connection.setReadTimeout(30000);

        try (InputStream inputStream = connection.getInputStream()) {
            Files.copy(inputStream, filePath, StandardCopyOption.REPLACE_EXISTING);
        }

        log.info("PDF downloaded and stored at: {}", filePath);
        return filePath.toString();
    }

    public String calculatePDFHash(String filePath) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (FileInputStream fis = new FileInputStream(filePath)) {
            byte[] buffer = new byte[8192];
            int bytesRead;
            while ((bytesRead = fis.read(buffer)) != -1) {
                digest.update(buffer, 0, bytesRead);
            }
        }
        return HexFormat.of().formatHex(digest.digest());
    }

    public boolean verifyPDFIntegrity(String filePath, String expectedHash) throws Exception {
        String actualHash = calculatePDFHash(filePath);
        return actualHash.equals(expectedHash);
    }

    public void downloadOfficialForms() {
        log.info("Starting download of official PDF forms");

        try {
            // Download USCIS I-130 form
            downloadUSCISForm("I-130",
                "https://www.uscis.gov/sites/default/files/document/forms/i-130.pdf",
                "Petition for Alien Relative");

            // Download USCIS I-485 form
            downloadUSCISForm("I-485",
                "https://www.uscis.gov/sites/default/files/document/forms/i-485.pdf",
                "Application to Register Permanent Residence");

            // Download USCIS I-765 form
            downloadUSCISForm("I-765",
                "https://www.uscis.gov/sites/default/files/document/forms/i-765.pdf",
                "Application for Employment Authorization");

            log.info("Official forms download completed");

        } catch (Exception e) {
            log.error("Error downloading official forms: {}", e.getMessage(), e);
        }
    }

    private void downloadUSCISForm(String formNumber, String url, String description) {
        try {
            String filename = "USCIS_" + formNumber + ".pdf";
            String localPath = downloadAndStorePDF(url, filename);
            String hash = calculatePDFHash(localPath);

            // Update or create template in database
            AILegalTemplate existingTemplate = templateRepository.findByNameContaining("USCIS Form " + formNumber)
                .stream().findFirst().orElse(null);

            if (existingTemplate == null) {
                // Create new template
                AILegalTemplate template = AILegalTemplate.builder()
                    .name("USCIS Form " + formNumber + " - " + description)
                    .description("Official USCIS form for " + description.toLowerCase())
                    .category(com.bostoneo.bostoneosolutions.enumeration.TemplateCategory.IMMIGRATION_FORM)
                    .practiceArea("Immigration Law")
                    .jurisdiction("Federal")
                    .maJurisdictionSpecific(false)
                    .templateType("PDF_FORM")
                    .pdfFormUrl(localPath)
                    .pdfFormHash(hash)
                    .isApproved(true)
                    .isPublic(true)
                    .build();

                templateRepository.save(template);
                log.info("Created new template for USCIS Form {}", formNumber);
            } else {
                // Update existing template
                existingTemplate.setPdfFormUrl(localPath);
                existingTemplate.setPdfFormHash(hash);
                templateRepository.save(existingTemplate);
                log.info("Updated template for USCIS Form {}", formNumber);
            }

        } catch (Exception e) {
            log.error("Error downloading USCIS Form {}: {}", formNumber, e.getMessage(), e);
        }
    }

    private String generateFilenameFromUrl(String url) {
        try {
            String filename = url.substring(url.lastIndexOf('/') + 1);
            if (!filename.toLowerCase().endsWith(".pdf")) {
                filename += ".pdf";
            }
            return filename;
        } catch (Exception e) {
            return "form_" + System.currentTimeMillis() + ".pdf";
        }
    }

    public File getPDFFile(String filename) {
        Path filePath = Paths.get(pdfStoragePath, filename);
        File file = filePath.toFile();
        return file.exists() ? file : null;
    }

    public boolean deletePDFFile(String filename) {
        try {
            Path filePath = Paths.get(pdfStoragePath, filename);
            return Files.deleteIfExists(filePath);
        } catch (Exception e) {
            log.error("Error deleting PDF file {}: {}", filename, e.getMessage());
            return false;
        }
    }
}