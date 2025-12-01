package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.model.AIPDFFormField;
import com.bostoneo.bostoneosolutions.model.AILegalTemplate;
import com.bostoneo.bostoneosolutions.repository.AIPDFFormFieldRepository;
import com.bostoneo.bostoneosolutions.repository.AILegalTemplateRepository;
import lombok.extern.slf4j.Slf4j;
// PDFBox 2.x - no Loader class needed
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.interactive.form.PDAcroForm;
import org.apache.pdfbox.pdmodel.interactive.form.PDField;
import org.apache.pdfbox.pdmodel.interactive.form.PDNonTerminalField;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.File;
import java.io.IOException;
import java.nio.file.Path;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional
@Slf4j
public class AIPDFFormService {

    private final AIPDFFormFieldRepository pdfFormFieldRepository;
    private final AILegalTemplateRepository templateRepository;

    @Value("${app.pdf-forms.storage-path:uploads/pdf-forms}")
    private String pdfStoragePath;

    @Value("${app.documents.output-path:uploads/documents}")
    private String documentsOutputPath;

    public AIPDFFormService(AIPDFFormFieldRepository pdfFormFieldRepository,
                           AILegalTemplateRepository templateRepository) {
        this.pdfFormFieldRepository = pdfFormFieldRepository;
        this.templateRepository = templateRepository;
    }

    public List<Map<String, Object>> getAvailableTemplates() {
        // Get PDF form templates from the AILegalTemplate repository
        List<AILegalTemplate> templates = templateRepository.findByTemplateTypeIn(
            List.of("PDF_FORM", "HYBRID")
        );

        return templates.stream().map(template -> {
            Map<String, Object> templateMap = new HashMap<>();
            templateMap.put("id", template.getId());
            templateMap.put("name", template.getName());
            templateMap.put("description", template.getDescription());
            templateMap.put("category", template.getCategory());
            templateMap.put("templateType", template.getTemplateType());
            templateMap.put("pdfFormUrl", template.getPdfFormUrl());
            templateMap.put("createdAt", template.getCreatedAt());
            templateMap.put("updatedAt", template.getUpdatedAt());
            return templateMap;
        }).collect(Collectors.toList());
    }

    public List<AIPDFFormField> getFormFields(Long templateId) {
        return pdfFormFieldRepository.findByTemplateIdOrderByDisplayOrder(templateId);
    }

    public List<AIPDFFormField> getRequiredFields(Long templateId) {
        return pdfFormFieldRepository.findByTemplateIdAndIsRequiredTrueOrderByDisplayOrder(templateId);
    }

    public AIPDFFormField createFormField(AIPDFFormField field) {
        return pdfFormFieldRepository.save(field);
    }

    public List<AIPDFFormField> createFormFieldsForTemplate(Long templateId, List<AIPDFFormField> fields) {
        // Set template ID for all fields
        fields.forEach(field -> field.setTemplateId(templateId));
        return pdfFormFieldRepository.saveAll(fields);
    }

    public void deleteFormFieldsForTemplate(Long templateId) {
        pdfFormFieldRepository.deleteByTemplateId(templateId);
    }

    public Map<String, Object> fillPDFForm(Long templateId, Map<String, Object> caseData) {
        AILegalTemplate template = templateRepository.findById(templateId)
            .orElseThrow(() -> new RuntimeException("Template not found: " + templateId));

        if (!"PDF_FORM".equals(template.getTemplateType()) && !"HYBRID".equals(template.getTemplateType())) {
            throw new RuntimeException("Template is not a PDF form template");
        }

        try {
            // Log incoming data
            log.info("Filling PDF form for template {} with data: {}", templateId, caseData);

            String filledPdfPath = fillPDFWithPDFBox(template, caseData);
            List<AIPDFFormField> formFields = getFormFields(templateId);

            log.info("Retrieved {} form fields for template {}", formFields.size(), templateId);

            return Map.of(
                "templateId", templateId,
                "originalPdfUrl", template.getPdfFormUrl(),
                "filledPdfPath", filledPdfPath,
                "formFields", formFields.stream().map(this::fieldToMap).collect(Collectors.toList()),
                "generatedAt", new Date(),
                "status", "COMPLETED"
            );

        } catch (Exception e) {
            log.error("Error filling PDF form for template {}: {}", templateId, e.getMessage(), e);
            throw new RuntimeException("Failed to fill PDF form: " + e.getMessage());
        }
    }

    private String fillPDFWithPDFBox(AILegalTemplate template, Map<String, Object> caseData) throws IOException {
        // Get source PDF file - handle both URLs and local paths
        String sourcePdfPath = template.getPdfFormUrl();
        File sourceFile;

        // Extract form type from template name or path
        String formType = "";
        if (template.getName().contains("I-130") || sourcePdfPath.contains("I-130") || sourcePdfPath.contains("i-130")) {
            formType = "I-130";
        } else if (template.getName().contains("I-485") || sourcePdfPath.contains("I-485") || sourcePdfPath.contains("i-485")) {
            formType = "I-485";
        } else if (template.getName().contains("I-765") || sourcePdfPath.contains("I-765") || sourcePdfPath.contains("i-765")) {
            formType = "I-765";
        } else if (template.getName().contains("N-400") || sourcePdfPath.contains("N-400") || sourcePdfPath.contains("n-400")) {
            formType = "N-400";
        }

        // If it's a URL or we couldn't find the file, use the standard USCIS filename
        if (sourcePdfPath.startsWith("http") || !new File(sourcePdfPath).exists()) {
            // Use standard USCIS filename format
            String standardFileName = !formType.isEmpty() ? "USCIS_" + formType + ".pdf" :
                                    template.getName().replaceAll("[^a-zA-Z0-9_-]", "_") + ".pdf";

            // Use absolute path to avoid duplication
            File pdfDir = new File(System.getProperty("user.dir"), pdfStoragePath);
            sourceFile = new File(pdfDir, standardFileName);

            // If still not found, try without USCIS prefix
            if (!sourceFile.exists() && !formType.isEmpty()) {
                sourceFile = new File(pdfDir, formType + ".pdf");
            }

            log.info("Looking for PDF file at: {}", sourceFile.getAbsolutePath());
        } else if (sourcePdfPath.startsWith("/")) {
            // Absolute path
            sourceFile = new File(sourcePdfPath);
        } else {
            // Relative path - resolve it properly without duplication
            // First check if it's already a valid relative path from project root
            File directFile = new File(sourcePdfPath);
            if (directFile.exists()) {
                sourceFile = directFile;
            } else {
                // Try resolving from project root with pdfStoragePath
                File pdfDir = new File(System.getProperty("user.dir"), pdfStoragePath);
                String fileName = new File(sourcePdfPath).getName();

                // Convert lowercase filename to uppercase USCIS format if needed
                if (fileName.matches("(?i)i-\\d+\\.pdf")) {
                    String formNumber = fileName.substring(0, fileName.lastIndexOf('.')).toUpperCase();
                    fileName = "USCIS_" + formNumber + ".pdf";
                }

                sourceFile = new File(pdfDir, fileName);
            }
        }

        if (!sourceFile.exists()) {
            throw new RuntimeException("Source PDF file not found: " + sourceFile.getAbsolutePath());
        }

        // Create output filename with absolute path
        String timestamp = String.valueOf(System.currentTimeMillis());
        String outputFilename = "filled_" + template.getName().replaceAll("[^a-zA-Z0-9]", "_") + "_" + timestamp + ".pdf";

        // Use absolute path for output directory - resolve properly to avoid duplication
        File outputDir;
        if (documentsOutputPath.startsWith("/")) {
            // Absolute path
            outputDir = new File(documentsOutputPath);
        } else {
            // Relative path - resolve from project root
            outputDir = new File(System.getProperty("user.dir"), documentsOutputPath);
        }

        // Ensure output directory exists
        if (!outputDir.exists()) {
            outputDir.mkdirs();
            log.info("Created output directory: {}", outputDir.getAbsolutePath());
        }

        File outputFile = new File(outputDir, outputFilename);
        Path outputPath = outputFile.toPath();

        try (PDDocument document = PDDocument.load(sourceFile)) {
            // Handle encrypted PDFs
            if (document.isEncrypted()) {
                document.setAllSecurityToBeRemoved(true);
            }

            PDAcroForm acroForm = document.getDocumentCatalog().getAcroForm();

            if (acroForm == null) {
                log.warn("PDF form has no AcroForm fields: {}", sourcePdfPath);
                // Save copy of original document
                document.save(outputPath.toFile());
                return outputPath.toString();
            }

            // Get form fields configured for this template
            List<AIPDFFormField> configuredFields = getFormFields(template.getId());
            log.info("Found {} configured fields for template {}", configuredFields.size(), template.getId());

            // If no configured fields, create default mappings
            if (configuredFields.isEmpty()) {
                log.info("No configured fields found. Creating default field mappings for form type");
                String detectedFormType = template.getName().contains("I-130") ? "I-130" :
                                         template.getName().contains("I-765") ? "I-765" :
                                         template.getName().contains("I-485") ? "I-485" : "I-130";
                createDefaultFieldsForImmigrationForm(template.getId(), detectedFormType);
                configuredFields = getFormFields(template.getId());
                log.info("Created {} default field mappings", configuredFields.size());
            }

            // Log all available PDF fields
            log.info("PDF form has {} fields total", acroForm.getFields().size());
            for (PDField field : acroForm.getFields()) {
                log.debug("Available PDF field: {}", field.getFullyQualifiedName());
            }

            // Fill each configured field
            int fieldsSet = 0;
            for (AIPDFFormField field : configuredFields) {
                try {
                    PDField pdfField = acroForm.getField(field.getPdfFieldName());
                    if (pdfField != null) {
                        Object value = extractValueFromCaseData(field, caseData);
                        log.debug("Extracting value for field '{}' with path '{}': {}",
                                  field.getPdfFieldName(), field.getCaseDataPath(), value);

                        if (value != null && !value.toString().isEmpty()) {
                            String stringValue = formatFieldValue(field, value).toString();
                            pdfField.setValue(stringValue);
                            fieldsSet++;
                            log.info("Successfully set field '{}' to value: {}",
                                    field.getPdfFieldName(), stringValue);
                        } else {
                            log.debug("No value found for field '{}'", field.getPdfFieldName());
                        }
                    } else {
                        log.warn("PDF field not found in form: {}", field.getPdfFieldName());
                    }
                } catch (Exception e) {
                    log.error("Error setting field '{}': {}", field.getPdfFieldName(), e.getMessage());
                }
            }

            log.info("Successfully set {} out of {} configured fields", fieldsSet, configuredFields.size());

            // Flatten the form to prevent further editing (optional)
            // acroForm.flatten();

            // Save the filled PDF
            document.save(outputFile);
            log.info("Successfully filled PDF form and saved to: {}", outputFile.getAbsolutePath());

            // Return absolute path for /tmp directory or relative for others
            String returnPath;
            if (documentsOutputPath.startsWith("/tmp")) {
                returnPath = outputFile.getAbsolutePath();
            } else {
                returnPath = documentsOutputPath + "/" + outputFilename;
            }
            log.info("Returning path: {}", returnPath);

            return returnPath;
        }
    }

    public List<String> extractPDFFieldNames(String pdfPath) throws IOException {
        List<String> fieldNames = new ArrayList<>();

        try (PDDocument document = PDDocument.load(new File(pdfPath))) {
            // Handle encrypted PDFs
            if (document.isEncrypted()) {
                document.setAllSecurityToBeRemoved(true);
            }

            PDAcroForm acroForm = document.getDocumentCatalog().getAcroForm();

            if (acroForm != null) {
                log.info("Found AcroForm with {} fields", acroForm.getFields().size());
                extractFieldsRecursively(acroForm.getFields(), fieldNames, "");
            } else {
                log.warn("No AcroForm found in PDF: {}", pdfPath);
            }
        }

        return fieldNames;
    }

    private void extractFieldsRecursively(List<PDField> fields, List<String> fieldNames, String prefix) {
        for (PDField field : fields) {
            String fieldName = prefix.isEmpty() ? field.getPartialName() : prefix + "." + field.getPartialName();
            fieldNames.add(fieldName);

            log.debug("Found field: {} (Type: {}, Value: {})",
                fieldName, field.getFieldType(), field.getValueAsString());

            // If this field has children, extract them recursively
            if (field instanceof PDNonTerminalField) {
                PDNonTerminalField nonTerminal = (PDNonTerminalField) field;
                if (!nonTerminal.getChildren().isEmpty()) {
                    extractFieldsRecursively(nonTerminal.getChildren(), fieldNames, fieldName);
                }
            }
        }
    }

    private Object extractValueFromCaseData(AIPDFFormField field, Map<String, Object> caseData) {
        if (field.getCaseDataPath() != null && !field.getCaseDataPath().isEmpty()) {
            log.debug("Extracting value for path: {} from data: {}", field.getCaseDataPath(), caseData);

            // Extract value using JSON path or direct key
            String[] pathParts = field.getCaseDataPath().split("\\.");
            Object value = caseData;

            for (String part : pathParts) {
                if (value instanceof Map) {
                    Map<?, ?> map = (Map<?, ?>) value;
                    value = map.get(part);
                    log.debug("Navigating path '{}': found value {}", part, value);
                } else {
                    log.debug("Value is not a Map at path '{}', current value: {}", part, value);
                    value = null;
                    break;
                }
            }

            // Special handling for checkbox fields with relationship values
            if ("CHECKBOX".equals(field.getFieldType()) && field.getDefaultValue() != null) {
                // For checkboxes, check if the value matches the expected value
                if (value != null && value.toString().equalsIgnoreCase(field.getDefaultValue())) {
                    return "Yes";
                } else {
                    return "Off";
                }
            }

            if (value != null) {
                log.debug("Found value '{}' for path '{}'", value, field.getCaseDataPath());
                return value;
            } else {
                log.debug("No value found for path '{}'", field.getCaseDataPath());
            }
        }

        // Return default value if no case data found
        Object defaultValue = field.getDefaultValue() != null ? field.getDefaultValue() : "";
        log.debug("Using default value '{}' for field '{}'", defaultValue, field.getPdfFieldName());
        return defaultValue;
    }

    private Object formatFieldValue(AIPDFFormField field, Object value) {
        if (value == null) return "";
        
        switch (field.getFieldType().toUpperCase()) {
            case "DATE":
                // Format date values
                if (value instanceof Date) {
                    return java.time.format.DateTimeFormatter.ofPattern("MM/dd/yyyy")
                        .format(((Date) value).toInstant().atZone(java.time.ZoneId.systemDefault()).toLocalDate());
                }
                return value.toString();
                
            case "CHECKBOX":
                // Convert boolean values for checkboxes
                if (value instanceof Boolean) {
                    return (Boolean) value ? "Yes" : "Off";
                }
                return "Yes".equalsIgnoreCase(value.toString()) ? "Yes" : "Off";
                
            case "TEXT":
            default:
                return value.toString();
        }
    }

    private Map<String, Object> fieldToMap(AIPDFFormField field) {
        Map<String, Object> fieldMap = new HashMap<>();
        fieldMap.put("id", field.getId());
        fieldMap.put("pdfFieldName", field.getPdfFieldName());
        fieldMap.put("fieldType", field.getFieldType());
        fieldMap.put("isRequired", field.getIsRequired());
        fieldMap.put("defaultValue", field.getDefaultValue());
        fieldMap.put("caseDataPath", field.getCaseDataPath());
        return fieldMap;
    }

    public void createDefaultFieldsForImmigrationForm(Long templateId, String formType) {
        List<AIPDFFormField> fields = new ArrayList<>();
        
        if ("I-130".equals(formType)) {
            // Create default field mappings for USCIS Form I-130
            fields.addAll(createI130FieldMappings());
        }
        
        // Set template ID and save
        fields.forEach(field -> field.setTemplateId(templateId));
        pdfFormFieldRepository.saveAll(fields);
    }

    private List<AIPDFFormField> createI130FieldMappings() {
        List<AIPDFFormField> fields = new ArrayList<>();

        // Map the form fields that match what frontend sends
        // Petitioner Information
        fields.add(AIPDFFormField.builder()
            .pdfFieldName("form1[0].#subform[0].Pt1Line1a_FamilyName[0]")
            .caseDataPath("petitionerLastName")
            .fieldType("TEXT")
            .isRequired(true)
            .displayOrder(1)
            .build());

        fields.add(AIPDFFormField.builder()
            .pdfFieldName("form1[0].#subform[0].Pt1Line1b_GivenName[0]")
            .caseDataPath("petitionerFirstName")
            .fieldType("TEXT")
            .isRequired(true)
            .displayOrder(2)
            .build());

        fields.add(AIPDFFormField.builder()
            .pdfFieldName("form1[0].#subform[0].Pt1Line1c_MiddleName[0]")
            .caseDataPath("petitionerMiddleName")
            .fieldType("TEXT")
            .isRequired(false)
            .displayOrder(3)
            .build());

        // Petitioner Address
        fields.add(AIPDFFormField.builder()
            .pdfFieldName("form1[0].#subform[0].Pt1Line2a_StreetNumberName[0]")
            .caseDataPath("currentAddress.street")
            .fieldType("TEXT")
            .isRequired(true)
            .displayOrder(4)
            .build());

        fields.add(AIPDFFormField.builder()
            .pdfFieldName("form1[0].#subform[0].Pt1Line2c_CityOrTown[0]")
            .caseDataPath("currentAddress.city")
            .fieldType("TEXT")
            .isRequired(true)
            .displayOrder(5)
            .build());

        fields.add(AIPDFFormField.builder()
            .pdfFieldName("form1[0].#subform[0].Pt1Line2d_State[0]")
            .caseDataPath("currentAddress.state")
            .fieldType("TEXT")
            .isRequired(true)
            .displayOrder(6)
            .build());

        fields.add(AIPDFFormField.builder()
            .pdfFieldName("form1[0].#subform[0].Pt1Line2e_ZipCode[0]")
            .caseDataPath("currentAddress.zipCode")
            .fieldType("TEXT")
            .isRequired(true)
            .displayOrder(7)
            .build());

        // Petitioner Date of Birth
        fields.add(AIPDFFormField.builder()
            .pdfFieldName("form1[0].#subform[0].Pt1Line8_DateOfBirth[0]")
            .caseDataPath("petitionerDOB")
            .fieldType("DATE")
            .isRequired(true)
            .displayOrder(8)
            .build());

        // Petitioner Country of Birth
        fields.add(AIPDFFormField.builder()
            .pdfFieldName("form1[0].#subform[1].Pt1Line11_CountryOfBirth[0]")
            .caseDataPath("petitionerCountryOfBirth")
            .fieldType("TEXT")
            .isRequired(true)
            .displayOrder(9)
            .build());

        // Petitioner Alien Number (if applicable)
        fields.add(AIPDFFormField.builder()
            .pdfFieldName("form1[0].#subform[0].Pt1Line3_AlienNumber[0]")
            .caseDataPath("petitionerAlienNumber")
            .fieldType("TEXT")
            .isRequired(false)
            .displayOrder(10)
            .build());

        // Beneficiary Information
        fields.add(AIPDFFormField.builder()
            .pdfFieldName("form1[0].#subform[2].Pt2Line1a_FamilyName[0]")
            .caseDataPath("beneficiaryLastName")
            .fieldType("TEXT")
            .isRequired(true)
            .displayOrder(11)
            .build());

        fields.add(AIPDFFormField.builder()
            .pdfFieldName("form1[0].#subform[2].Pt2Line1b_GivenName[0]")
            .caseDataPath("beneficiaryFirstName")
            .fieldType("TEXT")
            .isRequired(true)
            .displayOrder(12)
            .build());

        // Beneficiary Date of Birth
        fields.add(AIPDFFormField.builder()
            .pdfFieldName("form1[0].#subform[2].Pt2Line12_DateOfBirth[0]")
            .caseDataPath("beneficiaryDOB")
            .fieldType("DATE")
            .isRequired(true)
            .displayOrder(13)
            .build());

        // Beneficiary Country of Birth
        fields.add(AIPDFFormField.builder()
            .pdfFieldName("form1[0].#subform[2].Pt2Line14_CountryOfBirth[0]")
            .caseDataPath("beneficiaryCountryOfBirth")
            .fieldType("TEXT")
            .isRequired(true)
            .displayOrder(14)
            .build());

        // Beneficiary Alien Number (if applicable)
        fields.add(AIPDFFormField.builder()
            .pdfFieldName("form1[0].#subform[2].Pt2Line2_AlienNumber[0]")
            .caseDataPath("beneficiaryAlienNumber")
            .fieldType("TEXT")
            .isRequired(false)
            .displayOrder(15)
            .build());

        // Relationship - checkboxes
        String relationship = "beneficiaryRelationship";
        fields.add(AIPDFFormField.builder()
            .pdfFieldName("form1[0].#subform[2].Pt2Line8_Spouse[0]")
            .caseDataPath(relationship)
            .fieldType("CHECKBOX")
            .isRequired(false)
            .displayOrder(16)
            .defaultValue("Spouse")
            .build());

        // US Citizen checkbox field
        fields.add(AIPDFFormField.builder()
            .pdfFieldName("form1[0].#subform[0].Pt1Line6_USCitizen[0]")
            .caseDataPath("petitionerUSCitizen")
            .fieldType("CHECKBOX")
            .isRequired(false)
            .displayOrder(17)
            .build());

        // Employment Information
        fields.add(AIPDFFormField.builder()
            .pdfFieldName("form1[0].#subform[1].Pt1Line16_EmployerName[0]")
            .caseDataPath("employerName")
            .fieldType("TEXT")
            .isRequired(false)
            .displayOrder(17)
            .build());

        return fields;
    }
}