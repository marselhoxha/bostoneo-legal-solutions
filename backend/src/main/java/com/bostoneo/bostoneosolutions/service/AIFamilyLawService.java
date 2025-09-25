package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.model.AIFamilyLawCase;
import com.bostoneo.bostoneosolutions.model.AIFamilyLawCalculation;
import com.bostoneo.bostoneosolutions.enumeration.FamilyLawCaseType;
import com.bostoneo.bostoneosolutions.enumeration.FamilyLawStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

public interface AIFamilyLawService {
    
    // Case Management
    AIFamilyLawCase createFamilyLawCase(AIFamilyLawCase familyCase);
    AIFamilyLawCase updateFamilyLawCase(Long id, AIFamilyLawCase familyCase);
    AIFamilyLawCase getFamilyLawCaseById(Long id);
    Page<AIFamilyLawCase> getFamilyLawCasesByType(FamilyLawCaseType caseType, Pageable pageable);
    Page<AIFamilyLawCase> getFamilyLawCasesByStatus(FamilyLawStatus status, Pageable pageable);
    void deleteFamilyLawCase(Long id);
    
    // Child Support Calculations
    CompletableFuture<Map<String, Object>> calculateChildSupport(Long caseId, Map<String, Object> incomeData);
    CompletableFuture<String> generateChildSupportWorksheet(Long caseId);
    AIFamilyLawCalculation saveCalculation(AIFamilyLawCalculation calculation);
    List<AIFamilyLawCalculation> getCalculationsByCaseId(Long caseId);
    
    // Alimony Analysis
    CompletableFuture<Map<String, Object>> calculateAlimony(Long caseId, Map<String, Object> financialData);
    CompletableFuture<String> generateAlimonyGuidelines(Long caseId);
    CompletableFuture<List<String>> analyzeAlimonyFactors(Long caseId);
    
    // Asset Division
    CompletableFuture<Map<String, Object>> divideMaritalAssets(Long caseId, Map<String, Object> assetData);
    CompletableFuture<String> generatePropertyDivisionReport(Long caseId);
    CompletableFuture<List<String>> identifyMaritalVsSeparateProperty(Map<String, Object> assetList);
    
    // Custody Planning
    CompletableFuture<String> generateParentingPlan(Long caseId, Map<String, Object> custodyPreferences);
    CompletableFuture<Map<String, Object>> analyzeCustodyFactors(Long caseId);
    CompletableFuture<List<String>> suggestVisitationSchedule(Map<String, Object> parentSchedules);
    
    // Document Generation
    CompletableFuture<String> generateDivorceAgreement(Long caseId);
    CompletableFuture<String> generateCustodyOrder(Long caseId);
    CompletableFuture<String> generateSupportOrder(Long caseId);
    
    // Massachusetts Specific
    CompletableFuture<String> generateMAChildSupportGuidelines(Map<String, Object> incomeData);
    CompletableFuture<String> generateMAAlimonyGuidelines(Map<String, Object> marriageData);
    CompletableFuture<List<String>> getMAFamilyCourtRequirements(FamilyLawCaseType caseType);
}