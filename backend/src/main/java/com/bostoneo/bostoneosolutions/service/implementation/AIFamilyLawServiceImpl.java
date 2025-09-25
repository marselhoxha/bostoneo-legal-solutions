package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.service.AIFamilyLawService;
import com.bostoneo.bostoneosolutions.service.ai.ClaudeSonnet4Service;
import com.bostoneo.bostoneosolutions.model.AIFamilyLawCase;
import com.bostoneo.bostoneosolutions.model.AIFamilyLawCalculation;
import com.bostoneo.bostoneosolutions.enumeration.FamilyLawCaseType;
import com.bostoneo.bostoneosolutions.enumeration.FamilyLawStatus;
import com.bostoneo.bostoneosolutions.enumeration.CalculationType;
import com.bostoneo.bostoneosolutions.repository.AIFamilyLawCaseRepository;
import com.bostoneo.bostoneosolutions.repository.AIFamilyLawCalculationRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
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
public class AIFamilyLawServiceImpl implements AIFamilyLawService {

    private final AIFamilyLawCaseRepository caseRepository;
    private final AIFamilyLawCalculationRepository calculationRepository;
    private final ClaudeSonnet4Service claudeService;
    private final ObjectMapper objectMapper;

    @Override
    public AIFamilyLawCase createFamilyLawCase(AIFamilyLawCase familyCase) {
        log.info("Creating family law case for client: {}", familyCase.getClientId());
        familyCase.setCreatedAt(LocalDateTime.now());
        familyCase.setUpdatedAt(LocalDateTime.now());
        return caseRepository.save(familyCase);
    }

    @Override
    public AIFamilyLawCase updateFamilyLawCase(Long id, AIFamilyLawCase familyCase) {
        log.info("Updating family law case with ID: {}", id);
        AIFamilyLawCase existing = getFamilyLawCaseById(id);
        
        existing.setCaseType(familyCase.getCaseType());
        existing.setStatus(familyCase.getStatus());
        existing.setHasMinorChildren(familyCase.getHasMinorChildren());
        existing.setMarriageDate(familyCase.getMarriageDate());
        existing.setSeparationDate(familyCase.getSeparationDate());
        existing.setTotalMaritalAssets(familyCase.getTotalMaritalAssets());
        existing.setNextHearingDate(familyCase.getNextHearingDate());
        existing.setUpdatedAt(LocalDateTime.now());
        
        return caseRepository.save(existing);
    }

    @Override
    public AIFamilyLawCase getFamilyLawCaseById(Long id) {
        return caseRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Family law case not found with ID: " + id));
    }

    @Override
    public Page<AIFamilyLawCase> getFamilyLawCasesByType(FamilyLawCaseType caseType, Pageable pageable) {
        return caseRepository.findByCaseType(caseType, pageable);
    }

    @Override
    public Page<AIFamilyLawCase> getFamilyLawCasesByStatus(FamilyLawStatus status, Pageable pageable) {
        return caseRepository.findByStatus(status, pageable);
    }

    @Override
    public void deleteFamilyLawCase(Long id) {
        log.info("Deleting family law case with ID: {}", id);
        caseRepository.deleteById(id);
    }

    @Override
    public CompletableFuture<Map<String, Object>> calculateChildSupport(Long caseId, Map<String, Object> incomeData) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                log.info("Calculating child support for case: {}", caseId);
                
                AIFamilyLawCase familyCase = getFamilyLawCaseById(caseId);
                
                String prompt = String.format("""
                    Calculate child support using Massachusetts Child Support Guidelines:
                    
                    Case Details:
                    - Case Type: %s
                    - Number of Children: %s
                    - Marriage Date: %s
                    - Separation Date: %s
                    
                    Income Data: %s
                    
                    Please calculate:
                    1. Basic child support obligation
                    2. Health insurance contribution
                    3. Childcare expenses
                    4. Extraordinary expenses
                    5. Total monthly support amount
                    6. Deviation factors if applicable
                    
                    Use current MA guidelines and provide detailed worksheet.
                    """, familyCase.getCaseType(), 
                    incomeData.getOrDefault("numberOfChildren", "unknown"),
                    familyCase.getMarriageDate(), familyCase.getSeparationDate(),
                    incomeData.toString());
                
                String calculation = claudeService.generateCompletion(prompt, false).join();
                
                // Save calculation to database
                AIFamilyLawCalculation calcRecord = AIFamilyLawCalculation.builder()
                        .caseId(caseId)
                        .calculationType(CalculationType.CHILD_SUPPORT)
                        .inputParameters(objectMapper.writeValueAsString(incomeData))
                        .calculationResult(calculation)
                        .createdAt(LocalDateTime.now())
                        .build();
                
                calculationRepository.save(calcRecord);
                
                Map<String, Object> result = new HashMap<>();
                result.put("calculationId", calcRecord.getId());
                result.put("caseId", caseId);
                result.put("type", "CHILD_SUPPORT");
                result.put("calculation", calculation);
                result.put("calculatedAt", LocalDateTime.now());
                
                return result;
                
            } catch (Exception e) {
                log.error("Error calculating child support: {}", e.getMessage(), e);
                throw new RuntimeException("Child support calculation failed: " + e.getMessage(), e);
            }
        });
    }

    @Override
    public CompletableFuture<String> generateChildSupportWorksheet(Long caseId) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AIFamilyLawCase familyCase = getFamilyLawCaseById(caseId);
                
                String prompt = String.format("""
                    Generate a Massachusetts Child Support Guidelines Worksheet for:
                    
                    Case Details:
                    - Case ID: %s
                    - Case Type: %s
                    - Has Minor Children: %s
                    
                    Create official MA worksheet format with:
                    1. Parent income calculations
                    2. Combined available income
                    3. Basic support obligation
                    4. Health insurance adjustments
                    5. Childcare cost allocation
                    6. Final support order amount
                    7. Worksheet signatures and date
                    """, caseId, familyCase.getCaseType(), familyCase.getHasMinorChildren());
                
                return claudeService.generateCompletion(prompt, false).join();
                
            } catch (Exception e) {
                log.error("Error generating child support worksheet: {}", e.getMessage());
                return "Error generating child support worksheet: " + e.getMessage();
            }
        });
    }

    @Override
    public AIFamilyLawCalculation saveCalculation(AIFamilyLawCalculation calculation) {
        calculation.setCreatedAt(LocalDateTime.now());
        return calculationRepository.save(calculation);
    }

    @Override
    public List<AIFamilyLawCalculation> getCalculationsByCaseId(Long caseId) {
        return calculationRepository.findByCaseIdOrderByCreatedAtDesc(caseId);
    }

    @Override
    public CompletableFuture<Map<String, Object>> calculateAlimony(Long caseId, Map<String, Object> financialData) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AIFamilyLawCase familyCase = getFamilyLawCaseById(caseId);
                
                String prompt = String.format("""
                    Calculate alimony using Massachusetts Alimony Reform Act guidelines:
                    
                    Marriage Details:
                    - Marriage Date: %s
                    - Separation Date: %s
                    - Length of Marriage: Calculate from dates
                    - Total Marital Assets: %s
                    
                    Financial Data: %s
                    
                    Calculate:
                    1. General term alimony amount (30-35%% formula)
                    2. Duration based on marriage length
                    3. Rehabilitative alimony considerations
                    4. Reimbursement alimony if applicable
                    5. Tax implications
                    6. Modification factors
                    
                    Use current MA statutory guidelines.
                    """, familyCase.getMarriageDate(), familyCase.getSeparationDate(),
                    familyCase.getTotalMaritalAssets(), financialData.toString());
                
                String calculation = claudeService.generateCompletion(prompt, false).join();
                
                AIFamilyLawCalculation calcRecord = AIFamilyLawCalculation.builder()
                        .caseId(caseId)
                        .calculationType(CalculationType.ALIMONY)
                        .inputParameters(objectMapper.writeValueAsString(financialData))
                        .calculationResult(calculation)
                        .createdAt(LocalDateTime.now())
                        .build();
                
                calculationRepository.save(calcRecord);
                
                Map<String, Object> result = new HashMap<>();
                result.put("calculationId", calcRecord.getId());
                result.put("type", "ALIMONY");
                result.put("calculation", calculation);
                
                return result;
                
            } catch (Exception e) {
                log.error("Error calculating alimony: {}", e.getMessage());
                throw new RuntimeException("Alimony calculation failed: " + e.getMessage(), e);
            }
        });
    }

    @Override
    public CompletableFuture<String> generateAlimonyGuidelines(Long caseId) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AIFamilyLawCase familyCase = getFamilyLawCaseById(caseId);
                
                String prompt = String.format("""
                    Generate Massachusetts Alimony Guidelines analysis for:
                    
                    Case: %s
                    Marriage Duration: %s to %s
                    
                    Provide detailed analysis of:
                    1. Applicable alimony type (General Term, Rehabilitative, Reimbursement)
                    2. Amount calculation methodology
                    3. Duration limits under MA law
                    4. Modification circumstances
                    5. Termination events
                    6. Tax considerations
                    7. Deviation factors
                    """, caseId, familyCase.getMarriageDate(), familyCase.getSeparationDate());
                
                return claudeService.generateCompletion(prompt, false).join();
                
            } catch (Exception e) {
                log.error("Error generating alimony guidelines: {}", e.getMessage());
                return "Error generating alimony guidelines: " + e.getMessage();
            }
        });
    }

    @Override
    public CompletableFuture<List<String>> analyzeAlimonyFactors(Long caseId) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AIFamilyLawCase familyCase = getFamilyLawCaseById(caseId);
                
                String prompt = String.format("""
                    Analyze alimony factors under Massachusetts law for:
                    
                    Case Type: %s
                    Marriage Duration: %s to %s
                    Has Minor Children: %s
                    Total Assets: %s
                    
                    Analyze statutory factors:
                    1. Length of marriage
                    2. Conduct of parties during marriage
                    3. Age, health, station, occupation of each party
                    4. Vocational skills and employability
                    5. Estate and sources of income
                    6. Opportunity for future income
                    7. Contribution to acquisition of marital estate
                    8. Contribution as homemaker
                    
                    Return prioritized list of relevant factors.
                    """, familyCase.getCaseType(), familyCase.getMarriageDate(),
                    familyCase.getSeparationDate(), familyCase.getHasMinorChildren(),
                    familyCase.getTotalMaritalAssets());
                
                String response = claudeService.generateCompletion(prompt, false).join();
                return Arrays.asList(response.split("\\n"))
                        .stream()
                        .filter(line -> !line.trim().isEmpty())
                        .collect(ArrayList::new, ArrayList::add, ArrayList::addAll);
                
            } catch (Exception e) {
                log.error("Error analyzing alimony factors: {}", e.getMessage());
                return List.of("Error analyzing alimony factors");
            }
        });
    }

    @Override
    public CompletableFuture<Map<String, Object>> divideMaritalAssets(Long caseId, Map<String, Object> assetData) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AIFamilyLawCase familyCase = getFamilyLawCaseById(caseId);
                
                String prompt = String.format("""
                    Divide marital assets under Massachusetts equitable distribution law:
                    
                    Marriage: %s to %s
                    Total Marital Assets: %s
                    Asset Details: %s
                    
                    Apply MA equitable distribution factors:
                    1. Length of marriage
                    2. Conduct during marriage
                    3. Age, health, station, occupation
                    4. Vocational skills of each party
                    5. Estate and sources of income
                    6. Needs of each party
                    7. Opportunity for future acquisition
                    8. Contribution to acquisition/preservation
                    
                    Provide detailed asset division plan with rationale.
                    """, familyCase.getMarriageDate(), familyCase.getSeparationDate(),
                    familyCase.getTotalMaritalAssets(), assetData.toString());
                
                String division = claudeService.generateCompletion(prompt, false).join();
                
                Map<String, Object> result = new HashMap<>();
                result.put("caseId", caseId);
                result.put("assetDivision", division);
                result.put("totalAssets", familyCase.getTotalMaritalAssets());
                result.put("dividedAt", LocalDateTime.now());
                
                return result;
                
            } catch (Exception e) {
                log.error("Error dividing marital assets: {}", e.getMessage());
                throw new RuntimeException("Asset division failed: " + e.getMessage(), e);
            }
        });
    }

    @Override
    public CompletableFuture<String> generatePropertyDivisionReport(Long caseId) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AIFamilyLawCase familyCase = getFamilyLawCaseById(caseId);
                
                String prompt = String.format("""
                    Generate comprehensive property division report for MA divorce:
                    
                    Case Details:
                    - Marriage Duration: %s to %s
                    - Total Assets: %s
                    - Has Children: %s
                    
                    Report should include:
                    1. Asset inventory and valuation
                    2. Marital vs. separate property classification
                    3. Equitable distribution analysis
                    4. Proposed division plan
                    5. Tax implications
                    6. Implementation timeline
                    7. Required documentation
                    """, familyCase.getMarriageDate(), familyCase.getSeparationDate(),
                    familyCase.getTotalMaritalAssets(), familyCase.getHasMinorChildren());
                
                return claudeService.generateCompletion(prompt, false).join();
                
            } catch (Exception e) {
                log.error("Error generating property division report: {}", e.getMessage());
                return "Error generating property division report: " + e.getMessage();
            }
        });
    }

    @Override
    public CompletableFuture<List<String>> identifyMaritalVsSeparateProperty(Map<String, Object> assetList) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                String prompt = String.format("""
                    Classify assets as marital or separate property under Massachusetts law:
                    
                    Asset List: %s
                    
                    Apply MA legal standards:
                    1. Property acquired during marriage = marital (presumption)
                    2. Property acquired before marriage = separate
                    3. Gifts/inheritance to one spouse = separate
                    4. Property acquired by exchange for separate property = separate
                    5. Increase in value of separate property = analyze
                    6. Commingled property = analyze tracing
                    
                    Return categorized list with legal reasoning.
                    """, assetList.toString());
                
                String response = claudeService.generateCompletion(prompt, false).join();
                return Arrays.asList(response.split("\\n"))
                        .stream()
                        .filter(line -> !line.trim().isEmpty())
                        .collect(ArrayList::new, ArrayList::add, ArrayList::addAll);
                
            } catch (Exception e) {
                log.error("Error identifying marital vs separate property: {}", e.getMessage());
                return List.of("Error analyzing property classification");
            }
        });
    }

    @Override
    public CompletableFuture<String> generateParentingPlan(Long caseId, Map<String, Object> custodyPreferences) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AIFamilyLawCase familyCase = getFamilyLawCaseById(caseId);
                
                String prompt = String.format("""
                    Generate comprehensive parenting plan for Massachusetts family court:
                    
                    Case: %s
                    Has Minor Children: %s
                    Custody Preferences: %s
                    
                    Include all required MA elements:
                    1. Legal custody arrangements
                    2. Physical custody schedule
                    3. Holiday and vacation schedule
                    4. Decision-making authority
                    5. Communication protocols
                    6. Transportation arrangements
                    7. Dispute resolution procedures
                    8. Modification procedures
                    9. Child support integration
                    10. Special circumstances provisions
                    """, caseId, familyCase.getHasMinorChildren(), custodyPreferences.toString());
                
                return claudeService.generateCompletion(prompt, false).join();
                
            } catch (Exception e) {
                log.error("Error generating parenting plan: {}", e.getMessage());
                return "Error generating parenting plan: " + e.getMessage();
            }
        });
    }

    @Override
    public CompletableFuture<Map<String, Object>> analyzeCustodyFactors(Long caseId) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AIFamilyLawCase familyCase = getFamilyLawCaseById(caseId);
                
                String prompt = String.format("""
                    Analyze child custody factors under Massachusetts "best interests" standard:
                    
                    Case Type: %s
                    Has Minor Children: %s
                    
                    Analyze statutory factors:
                    1. Physical, mental, emotional health of child and parents
                    2. Cultural and religious background
                    3. Existing relationship and bonds
                    4. Ability to provide stability
                    5. Ability to meet child's needs
                    6. Geographic proximity considerations
                    7. Domestic violence history
                    8. Child's preferences (if age appropriate)
                    9. Cooperation between parents
                    10. Other relevant factors
                    
                    Provide structured analysis with recommendations.
                    """, familyCase.getCaseType(), familyCase.getHasMinorChildren());
                
                String analysis = claudeService.generateCompletion(prompt, false).join();
                
                Map<String, Object> result = new HashMap<>();
                result.put("caseId", caseId);
                result.put("custodyAnalysis", analysis);
                result.put("analyzedAt", LocalDateTime.now());
                
                return result;
                
            } catch (Exception e) {
                log.error("Error analyzing custody factors: {}", e.getMessage());
                throw new RuntimeException("Custody analysis failed: " + e.getMessage(), e);
            }
        });
    }

    @Override
    public CompletableFuture<List<String>> suggestVisitationSchedule(Map<String, Object> parentSchedules) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                String prompt = String.format("""
                    Suggest practical visitation schedule considering:
                    
                    Parent Schedules: %s
                    
                    Create schedule addressing:
                    1. Weekday/weekend distribution
                    2. School schedule considerations
                    3. Work schedule compatibility
                    4. Transportation logistics
                    5. Holiday rotation
                    6. Summer vacation time
                    7. Special events accommodation
                    8. Age-appropriate transitions
                    
                    Provide multiple schedule options.
                    """, parentSchedules.toString());
                
                String response = claudeService.generateCompletion(prompt, false).join();
                return Arrays.asList(response.split("\\n"))
                        .stream()
                        .filter(line -> !line.trim().isEmpty())
                        .collect(ArrayList::new, ArrayList::add, ArrayList::addAll);
                
            } catch (Exception e) {
                log.error("Error suggesting visitation schedule: {}", e.getMessage());
                return List.of("Error generating visitation schedule suggestions");
            }
        });
    }

    @Override
    public CompletableFuture<String> generateDivorceAgreement(Long caseId) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AIFamilyLawCase familyCase = getFamilyLawCaseById(caseId);
                
                String prompt = String.format("""
                    Generate comprehensive Massachusetts divorce agreement for:
                    
                    Case: %s
                    Marriage: %s to %s
                    Has Children: %s
                    Total Assets: %s
                    
                    Include all required provisions:
                    1. Identification of parties
                    2. Jurisdiction and grounds
                    3. Property division
                    4. Alimony arrangements
                    5. Child custody and support (if applicable)
                    6. Debt allocation
                    7. Insurance provisions
                    8. Tax considerations
                    9. Name change provisions
                    10. Enforcement mechanisms
                    11. Modification procedures
                    12. Signatures and notarization
                    """, caseId, familyCase.getMarriageDate(), familyCase.getSeparationDate(),
                    familyCase.getHasMinorChildren(), familyCase.getTotalMaritalAssets());
                
                return claudeService.generateCompletion(prompt, false).join();
                
            } catch (Exception e) {
                log.error("Error generating divorce agreement: {}", e.getMessage());
                return "Error generating divorce agreement: " + e.getMessage();
            }
        });
    }

    @Override
    public CompletableFuture<String> generateCustodyOrder(Long caseId) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AIFamilyLawCase familyCase = getFamilyLawCaseById(caseId);
                
                String prompt = String.format("""
                    Generate Massachusetts custody order for:
                    
                    Case: %s
                    Has Minor Children: %s
                    
                    Format as official court order with:
                    1. Court header and case information
                    2. Findings regarding best interests
                    3. Legal custody determination
                    4. Physical custody schedule
                    5. Parenting time provisions
                    6. Decision-making authority
                    7. Support integration
                    8. Enforcement provisions
                    9. Modification standards
                    10. Court signature block
                    """, caseId, familyCase.getHasMinorChildren());
                
                return claudeService.generateCompletion(prompt, false).join();
                
            } catch (Exception e) {
                log.error("Error generating custody order: {}", e.getMessage());
                return "Error generating custody order: " + e.getMessage();
            }
        });
    }

    @Override
    public CompletableFuture<String> generateSupportOrder(Long caseId) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AIFamilyLawCase familyCase = getFamilyLawCaseById(caseId);
                
                String prompt = String.format("""
                    Generate Massachusetts support order for:
                    
                    Case: %s
                    Has Children: %s
                    
                    Include in formal order:
                    1. Court identification and case number
                    2. Income findings for both parties
                    3. Child support calculation (if applicable)
                    4. Alimony determination (if applicable)
                    5. Payment schedule and method
                    6. Health insurance obligations
                    7. Modification circumstances
                    8. Enforcement mechanisms
                    9. Income withholding authorization
                    10. Effective date and duration
                    """, caseId, familyCase.getHasMinorChildren());
                
                return claudeService.generateCompletion(prompt, false).join();
                
            } catch (Exception e) {
                log.error("Error generating support order: {}", e.getMessage());
                return "Error generating support order: " + e.getMessage();
            }
        });
    }

    @Override
    public CompletableFuture<String> generateMAChildSupportGuidelines(Map<String, Object> incomeData) {
        return CompletableFuture.supplyAsync(() -> {
            String prompt = String.format("""
                Apply current Massachusetts Child Support Guidelines to:
                
                Income Data: %s
                
                Generate official worksheet showing:
                1. Gross weekly income calculations
                2. Available income after taxes/deductions
                3. Combined available income
                4. Basic support obligation from guidelines
                5. Health insurance adjustments
                6. Childcare cost allocation
                7. Extraordinary expense calculations
                8. Final support order amount
                9. Deviation analysis if applicable
                """, incomeData.toString());
            
            return claudeService.generateCompletion(prompt, false).join();
        });
    }

    @Override
    public CompletableFuture<String> generateMAAlimonyGuidelines(Map<String, Object> marriageData) {
        return CompletableFuture.supplyAsync(() -> {
            String prompt = String.format("""
                Apply Massachusetts Alimony Reform Act to:
                
                Marriage Data: %s
                
                Analyze under current statutory framework:
                1. Marriage length classification
                2. General term alimony calculation (30-35%% of income difference)
                3. Duration limits based on marriage length
                4. Rehabilitative alimony considerations
                5. Reimbursement alimony applicability
                6. Deviation factors
                7. Modification and termination events
                8. Tax implications under current law
                """, marriageData.toString());
            
            return claudeService.generateCompletion(prompt, false).join();
        });
    }

    @Override
    public CompletableFuture<List<String>> getMAFamilyCourtRequirements(FamilyLawCaseType caseType) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                String prompt = String.format("""
                    List Massachusetts Family Court requirements for %s cases:
                    
                    Include:
                    1. Required filing documents
                    2. Mandatory financial disclosures
                    3. Court filing fees
                    4. Service requirements
                    5. Waiting periods
                    6. Mandatory mediation requirements
                    7. Parenting education (if children involved)
                    8. Financial statement requirements
                    9. Local court rules
                    10. Timeline expectations
                    """, caseType);
                
                String response = claudeService.generateCompletion(prompt, false).join();
                return Arrays.asList(response.split("\\n"))
                        .stream()
                        .filter(line -> !line.trim().isEmpty())
                        .collect(ArrayList::new, ArrayList::add, ArrayList::addAll);
                
            } catch (Exception e) {
                log.error("Error getting MA family court requirements: {}", e.getMessage());
                return List.of("Error retrieving court requirements");
            }
        });
    }
}