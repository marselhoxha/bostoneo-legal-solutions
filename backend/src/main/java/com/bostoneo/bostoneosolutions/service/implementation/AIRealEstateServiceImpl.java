package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.service.AIRealEstateService;
import com.bostoneo.bostoneosolutions.service.ai.ClaudeSonnet4Service;
import com.bostoneo.bostoneosolutions.model.AIRealEstateTransaction;
import com.bostoneo.bostoneosolutions.model.AIRealEstateDocument;
import com.bostoneo.bostoneosolutions.enumeration.RealEstateTransactionType;
import com.bostoneo.bostoneosolutions.enumeration.PropertyType;
import com.bostoneo.bostoneosolutions.enumeration.TransactionType;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.AIRealEstateTransactionRepository;
import com.bostoneo.bostoneosolutions.repository.AIRealEstateDocumentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.CompletableFuture;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class AIRealEstateServiceImpl implements AIRealEstateService {

    private final AIRealEstateTransactionRepository transactionRepository;
    private final AIRealEstateDocumentRepository documentRepository;
    private final ClaudeSonnet4Service claudeService;
    private final TenantService tenantService;

    @Override
    public AIRealEstateTransaction createTransaction(AIRealEstateTransaction transaction) {
        log.info("Creating real estate transaction for case: {}", transaction.getCaseId());
        // SECURITY: Set organization ID from current tenant context
        transaction.setOrganizationId(tenantService.requireCurrentOrganizationId());
        transaction.setCreatedAt(LocalDateTime.now());
        transaction.setUpdatedAt(LocalDateTime.now());
        return transactionRepository.save(transaction);
    }

    @Override
    public AIRealEstateTransaction updateTransaction(Long id, AIRealEstateTransaction transaction) {
        log.info("Updating real estate transaction with ID: {}", id);
        AIRealEstateTransaction existing = getTransactionById(id);

        existing.setTransactionType(transaction.getTransactionType());
        existing.setPropertyType(transaction.getPropertyType());
        existing.setPropertyAddress(transaction.getPropertyAddress());
        existing.setPurchasePrice(transaction.getPurchasePrice());
        existing.setClosingDate(transaction.getClosingDate());
        existing.setTransactionType(transaction.getTransactionType());
        existing.setUpdatedAt(LocalDateTime.now());

        return transactionRepository.save(existing);
    }

    @Override
    public AIRealEstateTransaction getTransactionById(Long id) {
        // SECURITY: Use tenant-filtered lookup to prevent cross-tenant access
        Long orgId = tenantService.requireCurrentOrganizationId();
        return transactionRepository.findByIdAndOrganizationId(id, orgId)
                .orElseThrow(() -> new RuntimeException("Real estate transaction not found with ID: " + id));
    }

    @Override
    public Page<AIRealEstateTransaction> getTransactionsByType(RealEstateTransactionType type, Pageable pageable) {
        // SECURITY: Filter by organization
        Long orgId = tenantService.requireCurrentOrganizationId();
        return transactionRepository.findByTransactionTypeAndOrganizationId(TransactionType.valueOf(type.name()), orgId, pageable);
    }

    @Override
    public Page<AIRealEstateTransaction> getTransactionsByPropertyType(PropertyType propertyType, Pageable pageable) {
        // SECURITY: Filter by organization
        Long orgId = tenantService.requireCurrentOrganizationId();
        return transactionRepository.findByPropertyTypeAndOrganizationId(propertyType, orgId, pageable);
    }

    @Override
    public void deleteTransaction(Long id) {
        log.info("Deleting real estate transaction with ID: {}", id);
        // SECURITY: Verify transaction belongs to current tenant before deleting
        Long orgId = tenantService.requireCurrentOrganizationId();
        AIRealEstateTransaction existing = transactionRepository.findByIdAndOrganizationId(id, orgId)
            .orElseThrow(() -> new RuntimeException("Real estate transaction not found with ID: " + id));
        transactionRepository.delete(existing);
    }

    @Override
    public CompletableFuture<String> generatePurchaseAndSaleAgreement(Long transactionId, Map<String, Object> terms) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                log.info("Generating purchase and sale agreement for transaction: {}", transactionId);
                
                AIRealEstateTransaction transaction = getTransactionById(transactionId);
                
                String prompt = String.format("""
                    Generate a Massachusetts Purchase and Sale Agreement for:
                    
                    Property Address: %s
                    Purchase Price: %s
                    Property Type: %s
                    Closing Date: %s
                    
                    Terms: %s
                    
                    Include all standard MA provisions:
                    1. Property description and legal description
                    2. Purchase price and deposit terms
                    3. Financing contingencies
                    4. Inspection contingencies
                    5. Title requirements
                    6. Property disclosure requirements
                    7. Closing cost allocations
                    8. Default and remedies
                    9. Signatures and execution
                    10. Required MA disclosures
                    """, transaction.getPropertyAddress(), transaction.getPurchasePrice(),
                    transaction.getPropertyType(), transaction.getClosingDate(),
                    terms.toString());
                
                return claudeService.generateCompletion(prompt, false).join();
                
            } catch (Exception e) {
                log.error("Error generating purchase and sale agreement: {}", e.getMessage(), e);
                throw new RuntimeException("P&S agreement generation failed: " + e.getMessage(), e);
            }
        });
    }

    @Override
    public CompletableFuture<String> generateMAStandardForm(Long transactionId, String formType) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AIRealEstateTransaction transaction = getTransactionById(transactionId);
                
                String prompt = String.format("""
                    Generate Massachusetts standard form %s for:
                    
                    Property: %s
                    Transaction Type: %s
                    Purchase Price: %s
                    
                    Use current Massachusetts Real Estate Board standard forms.
                    Include all required fields and disclosures.
                    Format according to current MA real estate practice.
                    """, formType, transaction.getPropertyAddress(),
                    transaction.getTransactionType(), transaction.getPurchasePrice());
                
                return claudeService.generateCompletion(prompt, false).join();
                
            } catch (Exception e) {
                log.error("Error generating MA standard form: {}", e.getMessage());
                throw new RuntimeException("MA form generation failed: " + e.getMessage(), e);
            }
        });
    }

    @Override
    public CompletableFuture<String> generateClosingStatement(Long transactionId) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AIRealEstateTransaction transaction = getTransactionById(transactionId);
                
                String prompt = String.format("""
                    Generate Massachusetts closing statement (HUD-1/CD) for:
                    
                    Property: %s
                    Purchase Price: %s
                    Closing Date: %s
                    Is Commercial: %s
                    
                    Calculate typical MA closing costs:
                    1. Title insurance
                    2. Attorney fees
                    3. Recording fees
                    4. Transfer taxes
                    5. Property taxes (prorations)
                    6. Utility adjustments
                    7. Loan costs (if applicable)
                    8. Broker commissions
                    9. Home inspection fees
                    10. Municipal lien certificates
                    """, transaction.getPropertyAddress(), transaction.getPurchasePrice(),
                    transaction.getClosingDate(), "Commercial/Residential");
                
                return claudeService.generateCompletion(prompt, false).join();
                
            } catch (Exception e) {
                log.error("Error generating closing statement: {}", e.getMessage());
                return "Error generating closing statement: " + e.getMessage();
            }
        });
    }

    @Override
    public CompletableFuture<String> generateDeed(Long transactionId, String deedType, Map<String, Object> grantorGrantee) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AIRealEstateTransaction transaction = getTransactionById(transactionId);
                
                String prompt = String.format("""
                    Generate Massachusetts %s deed for:
                    
                    Property: %s
                    Grantor/Grantee: %s
                    Consideration: %s
                    
                    Include proper MA deed requirements:
                    1. Proper grantor/grantee identification
                    2. Legal property description
                    3. Consideration statement
                    4. Habendum clause
                    5. Covenants (if warranty deed)
                    6. Signature requirements
                    7. Acknowledgment block
                    8. Recording information
                    9. Tax stamps calculation
                    10. Proper formatting for MA Registry
                    """, deedType, transaction.getPropertyAddress(),
                    grantorGrantee.toString(), transaction.getPurchasePrice());
                
                return claudeService.generateCompletion(prompt, false).join();
                
            } catch (Exception e) {
                log.error("Error generating deed: {}", e.getMessage());
                throw new RuntimeException("Deed generation failed: " + e.getMessage(), e);
            }
        });
    }

    @Override
    public CompletableFuture<List<String>> analyzeTitleIssues(Long transactionId, String titleReport) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                String prompt = String.format("""
                    Analyze title issues in this Massachusetts title report:
                    
                    Transaction ID: %s
                    Title Report: %s
                    
                    Identify and categorize:
                    1. Liens and encumbrances
                    2. Easements and restrictions
                    3. Boundary issues
                    4. Title defects
                    5. Missing documentation
                    6. Survey discrepancies
                    7. Zoning violations
                    8. Environmental concerns
                    9. Required cures before closing
                    10. Potential deal-breakers
                    
                    Provide prioritized action items.
                    """, transactionId, titleReport);
                
                String response = claudeService.generateCompletion(prompt, false).join();
                return Arrays.asList(response.split("\\n"))
                        .stream()
                        .filter(line -> !line.trim().isEmpty())
                        .collect(ArrayList::new, ArrayList::add, ArrayList::addAll);
                
            } catch (Exception e) {
                log.error("Error analyzing title issues: {}", e.getMessage());
                return List.of("Error analyzing title issues");
            }
        });
    }

    @Override
    public CompletableFuture<String> generateTitleExamination(Long transactionId) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AIRealEstateTransaction transaction = getTransactionById(transactionId);
                
                String prompt = String.format("""
                    Generate title examination report for Massachusetts property:
                    
                    Property: %s
                    Transaction Type: %s
                    
                    Include examination of:
                    1. Chain of title (40+ years)
                    2. Current deed analysis
                    3. Mortgage and lien search
                    4. Judgment and attachment search
                    5. Tax lien search
                    6. Probate court search
                    7. Federal tax lien search
                    8. UCC search (if applicable)
                    9. Survey review
                    10. Zoning compliance check
                    
                    Provide clear title opinion and requirements.
                    """, transaction.getPropertyAddress(), transaction.getTransactionType());
                
                return claudeService.generateCompletion(prompt, false).join();
                
            } catch (Exception e) {
                log.error("Error generating title examination: {}", e.getMessage());
                return "Error generating title examination: " + e.getMessage();
            }
        });
    }

    @Override
    public CompletableFuture<String> generateLeaseAgreement(Long transactionId, Map<String, Object> leaseTerms) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AIRealEstateTransaction transaction = getTransactionById(transactionId);
                
                String prompt = String.format("""
                    Generate Massachusetts lease agreement for:
                    
                    Property: %s
                    Property Type: %s
                    Lease Terms: %s
                    
                    Include all MA residential lease requirements:
                    1. Parties identification
                    2. Property description
                    3. Lease term and rent amount
                    4. Security deposit (max 1 month + last month)
                    5. Lead paint disclosure
                    6. Smoke detector compliance
                    7. Tenant rights under MA law
                    8. Landlord obligations
                    9. Maintenance responsibilities
                    10. Termination procedures
                    11. Required state disclosures
                    """, transaction.getPropertyAddress(), transaction.getPropertyType(),
                    leaseTerms.toString());
                
                return claudeService.generateCompletion(prompt, false).join();
                
            } catch (Exception e) {
                log.error("Error generating lease agreement: {}", e.getMessage());
                throw new RuntimeException("Lease agreement generation failed: " + e.getMessage(), e);
            }
        });
    }

    @Override
    public CompletableFuture<String> generateMAResidentialLease(Map<String, Object> leaseData) {
        return CompletableFuture.supplyAsync(() -> {
            String prompt = String.format("""
                Generate Massachusetts residential lease agreement with:
                
                Lease Data: %s
                
                Must comply with MA General Laws Chapter 186:
                1. Security deposit limitations (1st month + last month + security deposit + key deposit max)
                2. Lead paint disclosure requirements
                3. Smoke and carbon monoxide detector requirements
                4. Tenant rights and remedies
                5. Landlord access provisions
                6. Heating requirements
                7. Warranty of habitability
                8. Discrimination prohibitions
                9. Eviction procedures
                10. Required state and local disclosures
                """, leaseData.toString());
            
            return claudeService.generateCompletion(prompt, false).join();
        });
    }

    @Override
    public CompletableFuture<String> generateCommercialLease(Map<String, Object> commercialTerms) {
        return CompletableFuture.supplyAsync(() -> {
            String prompt = String.format("""
                Generate Massachusetts commercial lease agreement with:
                
                Commercial Terms: %s
                
                Include commercial lease provisions:
                1. Use restrictions and permitted uses
                2. CAM charges and operating expenses
                3. Assignment and subletting rights
                4. Compliance with ADA and building codes
                5. Insurance requirements
                6. Indemnification provisions
                7. Default and remedies
                8. Option to renew/expand
                9. Signage rights
                10. Environmental compliance
                """, commercialTerms.toString());
            
            return claudeService.generateCompletion(prompt, false).join();
        });
    }

    @Override
    public CompletableFuture<List<String>> checkMADisclosureRequirements(PropertyType propertyType) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                String prompt = String.format("""
                    List Massachusetts disclosure requirements for %s property:
                    
                    Include state-required disclosures:
                    1. Lead paint disclosure (pre-1978 properties)
                    2. Property condition disclosure
                    3. Septic system disclosure
                    4. Well water disclosure
                    5. Flood zone disclosure
                    6. Environmental hazards
                    7. Property tax disclosure
                    8. Homeowner association disclosure
                    9. Condominium documents
                    10. Local ordinance compliance
                    
                    Specify timing and format requirements.
                    """, propertyType);
                
                String response = claudeService.generateCompletion(prompt, false).join();
                return Arrays.asList(response.split("\\n"))
                        .stream()
                        .filter(line -> !line.trim().isEmpty())
                        .collect(ArrayList::new, ArrayList::add, ArrayList::addAll);
                
            } catch (Exception e) {
                log.error("Error checking MA disclosure requirements: {}", e.getMessage());
                return List.of("Error retrieving disclosure requirements");
            }
        });
    }

    @Override
    public CompletableFuture<String> generatePropertyDisclosure(Long transactionId) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AIRealEstateTransaction transaction = getTransactionById(transactionId);
                
                String prompt = String.format("""
                    Generate Massachusetts property disclosure statement for:
                    
                    Property: %s
                    Property Type: %s
                    Year Built: %s
                    
                    Include disclosure of:
                    1. Structural conditions
                    2. Mechanical systems
                    3. Environmental conditions
                    4. Legal issues affecting property
                    5. Neighborhood conditions
                    6. Past repairs and improvements
                    7. Insurance claims history
                    8. Flooding or water damage
                    9. Pest issues
                    10. Other material defects
                    
                    Use standard MA disclosure form format.
                    """, transaction.getPropertyAddress(), transaction.getPropertyType(),
                    "Property details");
                
                return claudeService.generateCompletion(prompt, false).join();
                
            } catch (Exception e) {
                log.error("Error generating property disclosure: {}", e.getMessage());
                return "Error generating property disclosure: " + e.getMessage();
            }
        });
    }

    @Override
    public CompletableFuture<Map<String, Object>> validateClosingCompliance(Long transactionId) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AIRealEstateTransaction transaction = getTransactionById(transactionId);
                
                String prompt = String.format("""
                    Validate closing compliance for Massachusetts transaction:
                    
                    Property: %s
                    Transaction Type: %s
                    Closing Date: %s
                    
                    Check compliance with:
                    1. RESPA requirements
                    2. Truth in Lending Act
                    3. MA transfer tax obligations
                    4. Recording requirements
                    5. Title insurance requirements
                    6. Lender closing conditions
                    7. Municipal requirements
                    8. Environmental compliance
                    9. Zoning compliance
                    10. Building code compliance
                    
                    Return compliance checklist with status.
                    """, transaction.getPropertyAddress(), transaction.getTransactionType(),
                    transaction.getClosingDate());
                
                String compliance = claudeService.generateCompletion(prompt, false).join();
                
                Map<String, Object> result = new HashMap<>();
                result.put("transactionId", transactionId);
                result.put("complianceReport", compliance);
                result.put("isCompliant", !compliance.toLowerCase().contains("violation") && !compliance.toLowerCase().contains("missing"));
                result.put("validatedAt", LocalDateTime.now());
                
                return result;
                
            } catch (Exception e) {
                log.error("Error validating closing compliance: {}", e.getMessage());
                throw new RuntimeException("Closing compliance validation failed: " + e.getMessage(), e);
            }
        });
    }

    @Override
    public CompletableFuture<Map<String, Object>> calculateClosingCosts(Long transactionId) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AIRealEstateTransaction transaction = getTransactionById(transactionId);
                
                String prompt = String.format("""
                    Calculate Massachusetts closing costs for:
                    
                    Purchase Price: %s
                    Property Type: %s
                    Financing: %s
                    
                    Calculate standard MA costs:
                    1. Attorney fees (buyer/seller)
                    2. Title insurance
                    3. Recording fees
                    4. Transfer tax (deed stamps)
                    5. Property tax prorations
                    6. Municipal lien certificate
                    7. Home inspection
                    8. Mortgage costs (if applicable)
                    9. Survey costs
                    10. Homeowner's insurance
                    
                    Provide itemized breakdown with totals.
                    """, transaction.getPurchasePrice(), transaction.getPropertyType(),
                    transaction.getLoanAmount() != null ? "Yes" : "No");
                
                String calculation = claudeService.generateCompletion(prompt, false).join();
                
                Map<String, Object> result = new HashMap<>();
                result.put("transactionId", transactionId);
                result.put("costBreakdown", calculation);
                result.put("purchasePrice", transaction.getPurchasePrice());
                result.put("calculatedAt", LocalDateTime.now());
                
                return result;
                
            } catch (Exception e) {
                log.error("Error calculating closing costs: {}", e.getMessage());
                throw new RuntimeException("Closing cost calculation failed: " + e.getMessage(), e);
            }
        });
    }

    @Override
    public CompletableFuture<String> generateHUD1Settlement(Long transactionId) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AIRealEstateTransaction transaction = getTransactionById(transactionId);
                
                String prompt = String.format("""
                    Generate HUD-1 Settlement Statement for Massachusetts transaction:
                    
                    Property: %s
                    Purchase Price: %s
                    Closing Date: %s
                    
                    Format as official HUD-1 with:
                    1. Borrower and seller information
                    2. Property location and description
                    3. Settlement agent details
                    4. Summary of borrower's transaction
                    5. Summary of seller's transaction
                    6. Itemized settlement charges
                    7. Loan terms and disclosures
                    8. Comparison of good faith estimate
                    9. Required signatures
                    10. Proper HUD-1 formatting
                    """, transaction.getPropertyAddress(), transaction.getPurchasePrice(),
                    transaction.getClosingDate());
                
                return claudeService.generateCompletion(prompt, false).join();
                
            } catch (Exception e) {
                log.error("Error generating HUD-1 settlement: {}", e.getMessage());
                return "Error generating HUD-1 settlement: " + e.getMessage();
            }
        });
    }

    @Override
    public CompletableFuture<Map<String, Object>> analyzeTaxImplications(Long transactionId) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AIRealEstateTransaction transaction = getTransactionById(transactionId);
                
                String prompt = String.format("""
                    Analyze tax implications for Massachusetts real estate transaction:
                    
                    Property: %s
                    Purchase Price: %s
                    Transaction Type: %s
                    
                    Analyze:
                    1. Capital gains implications
                    2. Depreciation recapture
                    3. 1031 exchange opportunities
                    4. Primary residence exclusion
                    5. MA state tax considerations
                    6. Transfer tax obligations
                    7. Property tax reassessment
                    8. Deductible closing costs
                    9. Basis calculations
                    10. Estimated tax liability
                    
                    Provide tax planning recommendations.
                    """, transaction.getPropertyAddress(), transaction.getPurchasePrice(),
                    transaction.getTransactionType());
                
                String analysis = claudeService.generateCompletion(prompt, false).join();
                
                Map<String, Object> result = new HashMap<>();
                result.put("transactionId", transactionId);
                result.put("taxAnalysis", analysis);
                result.put("purchasePrice", transaction.getPurchasePrice());
                result.put("analyzedAt", LocalDateTime.now());
                
                return result;
                
            } catch (Exception e) {
                log.error("Error analyzing tax implications: {}", e.getMessage());
                throw new RuntimeException("Tax analysis failed: " + e.getMessage(), e);
            }
        });
    }

    @Override
    public AIRealEstateDocument saveDocument(AIRealEstateDocument document) {
        document.setCreatedAt(LocalDateTime.now());
        document.setUpdatedAt(LocalDateTime.now());
        return documentRepository.save(document);
    }

    @Override
    public List<AIRealEstateDocument> getDocumentsByTransactionId(Long transactionId) {
        return documentRepository.findByTransactionIdOrderByCreatedAtDesc(transactionId);
    }

    @Override
    public Page<AIRealEstateDocument> getDocumentsByType(String documentType, Pageable pageable) {
        return documentRepository.findByDocumentType(documentType, pageable);
    }

    @Override
    public CompletableFuture<String> generateDueDiligenceChecklist(Long transactionId) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AIRealEstateTransaction transaction = getTransactionById(transactionId);
                
                String prompt = String.format("""
                    Generate due diligence checklist for Massachusetts property:
                    
                    Property: %s
                    Transaction Type: %s
                    Property Type: %s
                    
                    Create comprehensive checklist:
                    1. Title examination items
                    2. Survey requirements
                    3. Environmental assessments
                    4. Zoning compliance
                    5. Building permit verification
                    6. Property tax verification
                    7. Utility service confirmations
                    8. Insurance requirements
                    9. Financing contingencies
                    10. Inspection items
                    
                    Format as actionable checklist with deadlines.
                    """, transaction.getPropertyAddress(), transaction.getTransactionType(),
                    transaction.getPropertyType());
                
                return claudeService.generateCompletion(prompt, false).join();
                
            } catch (Exception e) {
                log.error("Error generating due diligence checklist: {}", e.getMessage());
                return "Error generating due diligence checklist: " + e.getMessage();
            }
        });
    }

    @Override
    public CompletableFuture<List<String>> analyzeSurveyIssues(Long transactionId, String surveyData) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                String prompt = String.format("""
                    Analyze survey issues for Massachusetts property transaction:
                    
                    Transaction ID: %s
                    Survey Data: %s
                    
                    Identify potential issues:
                    1. Boundary discrepancies
                    2. Encroachments (structures, utilities)
                    3. Easement conflicts
                    4. Right-of-way issues
                    5. Setback violations
                    6. Access problems
                    7. Flood zone considerations
                    8. Topographical concerns
                    9. Environmental features
                    10. Title policy exceptions
                    
                    Prioritize by severity and required action.
                    """, transactionId, surveyData);
                
                String response = claudeService.generateCompletion(prompt, false).join();
                return Arrays.asList(response.split("\\n"))
                        .stream()
                        .filter(line -> !line.trim().isEmpty() && (line.contains("issue") || line.contains("concern") || line.contains("•")))
                        .collect(ArrayList::new, ArrayList::add, ArrayList::addAll);
                
            } catch (Exception e) {
                log.error("Error analyzing survey issues: {}", e.getMessage());
                return List.of("Error analyzing survey issues");
            }
        });
    }

    @Override
    public CompletableFuture<String> generateZoningAnalysis(Long transactionId, String propertyAddress) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                String prompt = String.format("""
                    Generate zoning analysis for Massachusetts property:
                    
                    Property Address: %s
                    Transaction ID: %s
                    
                    Analyze:
                    1. Current zoning classification
                    2. Permitted uses
                    3. Dimensional requirements
                    4. Parking requirements
                    5. Signage restrictions
                    6. Special permit requirements
                    7. Nonconforming use status
                    8. Variance history
                    9. Pending zoning changes
                    10. Compliance issues
                    
                    Include recommendations for compliance.
                    """, propertyAddress, transactionId);
                
                return claudeService.generateCompletion(prompt, false).join();
                
            } catch (Exception e) {
                log.error("Error generating zoning analysis: {}", e.getMessage());
                return "Error generating zoning analysis: " + e.getMessage();
            }
        });
    }

    @Override
    public CompletableFuture<String> generateMAPropertyTaxInfo(String propertyAddress) {
        return CompletableFuture.supplyAsync(() -> {
            String prompt = String.format("""
                Provide Massachusetts property tax information for:
                
                Property Address: %s
                
                Include:
                1. Current assessed value
                2. Annual property tax amount
                3. Tax rate and mill rate
                4. Exemptions available
                5. Payment schedule
                6. Assessment appeals process
                7. Abatement procedures
                8. Senior/veteran exemptions
                9. Tax lien information
                10. Municipal services funded
                
                Explain MA property tax calculation method.
                """, propertyAddress);
            
            return claudeService.generateCompletion(prompt, false).join();
        });
    }

    @Override
    public CompletableFuture<List<String>> checkMAEnvironmentalRequirements(PropertyType propertyType) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                String prompt = String.format("""
                    List Massachusetts environmental requirements for %s property:
                    
                    Include requirements for:
                    1. Phase I Environmental Assessment
                    2. Soil contamination testing
                    3. Groundwater testing
                    4. Asbestos inspection
                    5. Lead paint assessment
                    6. Radon testing
                    7. Wetlands delineation
                    8. Septic system compliance
                    9. Underground storage tanks
                    10. Hazardous materials disclosure
                    
                    Specify when each is required.
                    """, propertyType);
                
                String response = claudeService.generateCompletion(prompt, false).join();
                return Arrays.asList(response.split("\\n"))
                        .stream()
                        .filter(line -> !line.trim().isEmpty())
                        .collect(ArrayList::new, ArrayList::add, ArrayList::addAll);
                
            } catch (Exception e) {
                log.error("Error checking MA environmental requirements: {}", e.getMessage());
                return List.of("Error retrieving environmental requirements");
            }
        });
    }

    @Override
    public CompletableFuture<String> generateMAClosingDocuments(Long transactionId) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AIRealEstateTransaction transaction = getTransactionById(transactionId);
                
                String prompt = String.format("""
                    Generate complete Massachusetts closing document package:
                    
                    Property: %s
                    Transaction Type: %s
                    Purchase Price: %s
                    
                    Include all required documents:
                    1. Purchase and Sale Agreement
                    2. Deed (appropriate type)
                    3. Closing statement (HUD-1/CD)
                    4. Title insurance policy
                    5. Mortgage documents (if applicable)
                    6. Property disclosure forms
                    7. Municipal lien certificate
                    8. Property tax certificates
                    9. Utility transfer forms
                    10. Recording documents
                    
                    Format for Massachusetts Registry of Deeds.
                    """, transaction.getPropertyAddress(), transaction.getTransactionType(),
                    transaction.getPurchasePrice());
                
                return claudeService.generateCompletion(prompt, false).join();
                
            } catch (Exception e) {
                log.error("Error generating MA closing documents: {}", e.getMessage());
                return "Error generating MA closing documents: " + e.getMessage();
            }
        });
    }
}