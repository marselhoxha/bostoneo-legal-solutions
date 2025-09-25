package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.model.AIImmigrationCase;
import com.bostoneo.bostoneosolutions.model.AIImmigrationDocument;
import com.bostoneo.bostoneosolutions.enumeration.ImmigrationCaseType;
import com.bostoneo.bostoneosolutions.enumeration.ImmigrationStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

public interface AIImmigrationService {
    
    // Case Management
    AIImmigrationCase createImmigrationCase(AIImmigrationCase immigrationCase);
    AIImmigrationCase updateImmigrationCase(Long id, AIImmigrationCase immigrationCase);
    AIImmigrationCase getImmigrationCaseById(Long id);
    Page<AIImmigrationCase> getImmigrationCasesByType(ImmigrationCaseType caseType, Pageable pageable);
    Page<AIImmigrationCase> getImmigrationCasesByStatus(ImmigrationStatus status, Pageable pageable);
    void deleteImmigrationCase(Long id);
    
    // Document Processing
    CompletableFuture<String> generateImmigrationForm(Long caseId, String formType, Map<String, Object> data);
    CompletableFuture<String> fillUSCISForm(Long caseId, String formNumber, Map<String, Object> personalData);
    CompletableFuture<List<String>> batchProcessForms(Long caseId, List<String> formNumbers);
    
    // Deadline Management
    CompletableFuture<List<Map<String, Object>>> calculateImmigrationDeadlines(Long caseId);
    CompletableFuture<String> generateDeadlineReport(Long caseId);
    List<Map<String, Object>> getUpcomingDeadlines(Long userId, int daysAhead);
    
    // Evidence Analysis
    CompletableFuture<Map<String, Object>> analyzeEvidenceRequirements(ImmigrationCaseType caseType);
    CompletableFuture<List<String>> suggestMissingEvidence(Long caseId);
    CompletableFuture<String> generateEvidenceChecklist(Long caseId);
    
    // Document Storage
    AIImmigrationDocument saveImmigrationDocument(AIImmigrationDocument document);
    List<AIImmigrationDocument> getDocumentsByCaseId(Long caseId);
    Page<AIImmigrationDocument> getDocumentsByType(String documentType, Pageable pageable);
    
    // Filing Assistance
    CompletableFuture<Map<String, Object>> validateFormData(String formNumber, Map<String, Object> formData);
    CompletableFuture<String> generateFilingInstructions(Long caseId, String formNumber);
    CompletableFuture<List<String>> getRequiredSupportingDocs(String formNumber);
}