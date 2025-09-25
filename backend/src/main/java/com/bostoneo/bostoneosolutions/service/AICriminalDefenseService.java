package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.model.AICriminalCase;
import com.bostoneo.bostoneosolutions.model.AICriminalMotion;
import com.bostoneo.bostoneosolutions.enumeration.CriminalCaseType;
import com.bostoneo.bostoneosolutions.enumeration.CriminalCaseStatus;
import com.bostoneo.bostoneosolutions.enumeration.MotionType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

public interface AICriminalDefenseService {
    
    // Case Management
    AICriminalCase createCriminalCase(AICriminalCase criminalCase);
    AICriminalCase updateCriminalCase(Long id, AICriminalCase criminalCase);
    AICriminalCase getCriminalCaseById(Long id);
    Page<AICriminalCase> getCriminalCasesByType(CriminalCaseType caseType, Pageable pageable);
    Page<AICriminalCase> getCriminalCasesByStatus(CriminalCaseStatus status, Pageable pageable);
    void deleteCriminalCase(Long id);
    
    // Motion Practice
    CompletableFuture<String> generateMotion(Long caseId, MotionType motionType, Map<String, Object> facts);
    CompletableFuture<String> generateMotionToSuppress(Long caseId, Map<String, Object> evidenceDetails);
    CompletableFuture<String> generateMotionToDismiss(Long caseId, Map<String, Object> legalArguments);
    AICriminalMotion saveMotion(AICriminalMotion motion);
    List<AICriminalMotion> getMotionsByCaseId(Long caseId);
    
    // Sentencing Analysis
    CompletableFuture<Map<String, Object>> analyzeSentencingGuidelines(Long caseId);
    CompletableFuture<String> generateSentencingMemo(Long caseId, Map<String, Object> mitigatingFactors);
    CompletableFuture<List<String>> suggestMitigatingFactors(Long caseId);
    
    // Discovery Management
    CompletableFuture<String> generateDiscoveryRequest(Long caseId, List<String> requestedItems);
    CompletableFuture<List<String>> analyzeDiscoveryMaterials(Long caseId, String evidenceType);
    CompletableFuture<String> generateBradyMotion(Long caseId, Map<String, Object> exculpatoryEvidence);
    
    // Plea Negotiations
    CompletableFuture<Map<String, Object>> analyzePleaOffer(Long caseId, Map<String, Object> pleaTerms);
    CompletableFuture<String> generatePleaAdvice(Long caseId, Map<String, Object> caseFactors);
    CompletableFuture<List<String>> calculatePleaBenefits(Map<String, Object> originalCharges, Map<String, Object> pleaOffer);
    
    // Trial Preparation
    CompletableFuture<String> generateWitnessExamination(Long caseId, String witnessType, Map<String, Object> witnessInfo);
    CompletableFuture<String> generateOpeningStatement(Long caseId, Map<String, Object> defenseTheory);
    CompletableFuture<String> generateClosingArgument(Long caseId, Map<String, Object> evidenceSummary);
    
    // Massachusetts Criminal Law
    CompletableFuture<List<String>> getMAStatuteReferences(String chargeType);
    CompletableFuture<String> generateMAMotionFormat(MotionType motionType, Long caseId);
    CompletableFuture<Map<String, Object>> analyzeMADefenses(String chargeType);
    
    // Simple methods for controller
    String generateMotion(Map<String, Object> request);
    Map<String, Object> calculateSentence(Map<String, Object> request);
    Map<String, Object> analyzeCase(Map<String, Object> request);
    Map<String, Object> analyzePleaAgreement(Map<String, Object> request);
}