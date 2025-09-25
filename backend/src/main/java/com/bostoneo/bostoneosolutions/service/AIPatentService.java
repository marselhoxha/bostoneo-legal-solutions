package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.model.AIPatentApplication;
import com.bostoneo.bostoneosolutions.model.AIPatentPriorArt;
import com.bostoneo.bostoneosolutions.enumeration.PatentType;
import com.bostoneo.bostoneosolutions.enumeration.PatentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

public interface AIPatentService {
    
    // Patent Application Management
    AIPatentApplication createPatentApplication(AIPatentApplication application);
    AIPatentApplication updatePatentApplication(Long id, AIPatentApplication application);
    AIPatentApplication getPatentApplicationById(Long id);
    Page<AIPatentApplication> getApplicationsByType(PatentType patentType, Pageable pageable);
    Page<AIPatentApplication> getApplicationsByStatus(PatentStatus status, Pageable pageable);
    void deletePatentApplication(Long id);
    
    // Patent Drafting
    CompletableFuture<String> generatePatentClaims(Long applicationId, Map<String, Object> inventionDetails);
    CompletableFuture<String> generatePatentSpecification(Long applicationId);
    CompletableFuture<String> generatePatentAbstract(Long applicationId, String specificationText);
    CompletableFuture<String> generatePatentSummary(Long applicationId);
    
    // Prior Art Analysis
    CompletableFuture<List<String>> conductPriorArtSearch(Long applicationId, String searchQuery);
    CompletableFuture<Map<String, Object>> analyzePriorArt(Long applicationId, List<String> priorArtReferences);
    AIPatentPriorArt savePriorArtReference(AIPatentPriorArt priorArt);
    List<AIPatentPriorArt> getPriorArtByApplicationId(Long applicationId);
    
    // Patentability Analysis
    CompletableFuture<Map<String, Object>> analyzePatentability(Long applicationId);
    CompletableFuture<String> generatePatentabilityReport(Long applicationId);
    CompletableFuture<List<String>> identifyNoveltyElements(Long applicationId);
    CompletableFuture<List<String>> analyzeObviousnessRejections(Long applicationId);
    
    // USPTO Forms & Filings
    CompletableFuture<String> generateUSPTOForm(Long applicationId, String formType);
    CompletableFuture<String> generateApplicationDataSheet(Long applicationId);
    CompletableFuture<String> generateDeclarationForm(Long applicationId, Map<String, Object> inventorInfo);
    
    // Prosecution Support
    CompletableFuture<String> generateOfficeActionResponse(Long applicationId, String officeActionText);
    CompletableFuture<String> generateAmendmentText(Long applicationId, Map<String, Object> amendmentDetails);
    CompletableFuture<List<String>> suggestClaimAmendments(Long applicationId, String rejectionText);
    
    // Portfolio Management
    CompletableFuture<Map<String, Object>> analyzePatenPortfolio(Long clientId);
    CompletableFuture<String> generatePortfolioReport(Long clientId);
    CompletableFuture<List<String>> identifyFreedomToOperate(String technologyArea);
    
    // International Filing
    CompletableFuture<String> generatePCTApplication(Long applicationId);
    CompletableFuture<List<String>> analyzeInternationalRequirements(List<String> targetCountries);
    CompletableFuture<Map<String, Object>> calculateInternationalFees(List<String> targetCountries);
    
    // Maintenance & Renewals
    CompletableFuture<List<Map<String, Object>>> calculateMaintenanceFees(Long applicationId);
    CompletableFuture<String> generateMaintenanceReport(Long clientId);
    List<Map<String, Object>> getUpcomingMaintenanceDeadlines(Long clientId);
}