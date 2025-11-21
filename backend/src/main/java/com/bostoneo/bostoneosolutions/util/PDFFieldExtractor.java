package com.bostoneo.bostoneosolutions.util;

// PDFBox 2.x - no Loader class needed
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.interactive.form.PDAcroForm;
import org.apache.pdfbox.pdmodel.interactive.form.PDField;
import org.apache.pdfbox.pdmodel.interactive.form.PDNonTerminalField;

import java.io.File;
import java.io.IOException;
import java.util.List;

public class PDFFieldExtractor {

    public static void main(String[] args) {
        if (args.length < 1) {
            System.out.println("Usage: PDFFieldExtractor <pdf-file-path>");
            return;
        }

        String pdfPath = args[0];
        System.out.println("Extracting fields from: " + pdfPath);
        System.out.println("========================================");

        try {
            File pdfFile = new File(pdfPath);
            if (!pdfFile.exists()) {
                System.err.println("File not found: " + pdfPath);
                return;
            }

            try (PDDocument document = PDDocument.load(pdfFile)) {
                if (document.isEncrypted()) {
                    document.setAllSecurityToBeRemoved(true);
                }

                PDAcroForm acroForm = document.getDocumentCatalog().getAcroForm();

                if (acroForm == null) {
                    System.out.println("No AcroForm found in this PDF");
                    return;
                }

                System.out.println("Total fields: " + acroForm.getFields().size());
                System.out.println("\nField Names and Types:");
                System.out.println("----------------------------------------");

                extractFieldsRecursively(acroForm.getFields(), "");
            }

        } catch (IOException e) {
            System.err.println("Error reading PDF: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private static void extractFieldsRecursively(List<PDField> fields, String indent) {
        for (PDField field : fields) {
            String fieldName = field.getFullyQualifiedName();
            String fieldType = field.getFieldType();
            String currentValue = field.getValueAsString();

            System.out.printf("%s[%s] %s = \"%s\"%n",
                indent, fieldType, fieldName,
                currentValue != null ? currentValue : "<empty>");

            // If this field has children, extract them recursively
            if (field instanceof PDNonTerminalField) {
                PDNonTerminalField nonTerminal = (PDNonTerminalField) field;
                if (!nonTerminal.getChildren().isEmpty()) {
                    extractFieldsRecursively(nonTerminal.getChildren(), indent + "  ");
                }
            }
        }
    }
}