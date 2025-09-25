package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.model.AIRealEstateTransaction;
import com.bostoneo.bostoneosolutions.model.AIRealEstateDocument;
import com.bostoneo.bostoneosolutions.enumeration.RealEstateTransactionType;
import com.bostoneo.bostoneosolutions.enumeration.PropertyType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

public interface AIRealEstateService {
    
    // Transaction Management
    AIRealEstateTransaction createTransaction(AIRealEstateTransaction transaction);
    AIRealEstateTransaction updateTransaction(Long id, AIRealEstateTransaction transaction);
    AIRealEstateTransaction getTransactionById(Long id);
    Page<AIRealEstateTransaction> getTransactionsByType(RealEstateTransactionType type, Pageable pageable);
    Page<AIRealEstateTransaction> getTransactionsByPropertyType(PropertyType propertyType, Pageable pageable);
    void deleteTransaction(Long id);
    
    // Purchase & Sale Documents
    CompletableFuture<String> generatePurchaseAndSaleAgreement(Long transactionId, Map<String, Object> terms);
    CompletableFuture<String> generateMAStandardForm(Long transactionId, String formType);
    CompletableFuture<String> generateClosingStatement(Long transactionId);
    
    // Title & Deed Services
    CompletableFuture<String> generateDeed(Long transactionId, String deedType, Map<String, Object> grantorGrantee);
    CompletableFuture<List<String>> analyzeTitleIssues(Long transactionId, String titleReport);
    CompletableFuture<String> generateTitleExamination(Long transactionId);
    
    // Lease Documents
    CompletableFuture<String> generateLeaseAgreement(Long transactionId, Map<String, Object> leaseTerms);
    CompletableFuture<String> generateMAResidentialLease(Map<String, Object> leaseData);
    CompletableFuture<String> generateCommercialLease(Map<String, Object> commercialTerms);
    
    // Regulatory Compliance
    CompletableFuture<List<String>> checkMADisclosureRequirements(PropertyType propertyType);
    CompletableFuture<String> generatePropertyDisclosure(Long transactionId);
    CompletableFuture<Map<String, Object>> validateClosingCompliance(Long transactionId);
    
    // Financial Analysis
    CompletableFuture<Map<String, Object>> calculateClosingCosts(Long transactionId);
    CompletableFuture<String> generateHUD1Settlement(Long transactionId);
    CompletableFuture<Map<String, Object>> analyzeTaxImplications(Long transactionId);
    
    // Document Management
    AIRealEstateDocument saveDocument(AIRealEstateDocument document);
    List<AIRealEstateDocument> getDocumentsByTransactionId(Long transactionId);
    Page<AIRealEstateDocument> getDocumentsByType(String documentType, Pageable pageable);
    
    // Due Diligence
    CompletableFuture<String> generateDueDiligenceChecklist(Long transactionId);
    CompletableFuture<List<String>> analyzeSurveyIssues(Long transactionId, String surveyData);
    CompletableFuture<String> generateZoningAnalysis(Long transactionId, String propertyAddress);
    
    // Massachusetts Specific
    CompletableFuture<String> generateMAPropertyTaxInfo(String propertyAddress);
    CompletableFuture<List<String>> checkMAEnvironmentalRequirements(PropertyType propertyType);
    CompletableFuture<String> generateMAClosingDocuments(Long transactionId);
}