package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.service.AIImmigrationService;
import com.bostoneo.bostoneosolutions.service.ai.ClaudeSonnet4Service;
import com.bostoneo.bostoneosolutions.model.AIImmigrationCase;
import com.bostoneo.bostoneosolutions.model.AIImmigrationDocument;
import com.bostoneo.bostoneosolutions.enumeration.ImmigrationCaseType;
import com.bostoneo.bostoneosolutions.enumeration.ImmigrationStatus;
import com.bostoneo.bostoneosolutions.repository.AIImmigrationCaseRepository;
import com.bostoneo.bostoneosolutions.repository.AIImmigrationDocumentRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.CompletableFuture;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class AIImmigrationServiceImpl implements AIImmigrationService {

    private final AIImmigrationCaseRepository caseRepository;
    private final AIImmigrationDocumentRepository documentRepository;
    private final ClaudeSonnet4Service claudeService;
    private final ObjectMapper objectMapper;

    @Override
    public AIImmigrationCase createImmigrationCase(AIImmigrationCase immigrationCase) {
        log.info("Creating immigration case for case: {}", immigrationCase.getCaseId());
        immigrationCase.setCreatedAt(LocalDateTime.now());
        immigrationCase.setUpdatedAt(LocalDateTime.now());
        return caseRepository.save(immigrationCase);
    }

    @Override
    public AIImmigrationCase updateImmigrationCase(Long id, AIImmigrationCase immigrationCase) {
        log.info("Updating immigration case with ID: {}", id);
        AIImmigrationCase existing = getImmigrationCaseById(id);
        
        existing.setFormType(immigrationCase.getFormType());
        existing.setStatus(immigrationCase.getStatus());
        existing.setBeneficiaryName(immigrationCase.getBeneficiaryName());
        existing.setPriorityDate(immigrationCase.getPriorityDate());
        existing.setNextActionDate(immigrationCase.getNextActionDate());
        existing.setUpdatedAt(LocalDateTime.now());
        
        return caseRepository.save(existing);
    }

    @Override
    public AIImmigrationCase getImmigrationCaseById(Long id) {
        return caseRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Immigration case not found with ID: " + id));
    }

    @Override
    public Page<AIImmigrationCase> getImmigrationCasesByType(ImmigrationCaseType caseType, Pageable pageable) {
        return caseRepository.findByCaseType(caseType, pageable);
    }

    @Override
    public Page<AIImmigrationCase> getImmigrationCasesByStatus(ImmigrationStatus status, Pageable pageable) {
        return caseRepository.findByStatus(status, pageable);
    }

    @Override
    public void deleteImmigrationCase(Long id) {
        log.info("Deleting immigration case with ID: {}", id);
        caseRepository.deleteById(id);
    }

    @Override
    public CompletableFuture<String> generateImmigrationForm(Long caseId, String formType, Map<String, Object> data) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                log.info("Generating immigration form {} for case: {}", formType, caseId);
                
                AIImmigrationCase immigrationCase = getImmigrationCaseById(caseId);
                
                String prompt = String.format("""
                    Generate a completed USCIS form %s for this immigration case:
                    
                    Case Type: %s
                    Country of Origin: %s
                    Current Stage: %s
                    
                    Personal Data: %s
                    
                    Instructions:
                    1. Use official USCIS form format
                    2. Fill all required fields based on provided data
                    3. Include proper formatting and sections
                    4. Add validation notes if data is missing
                    """, formType, immigrationCase.getFormType(), 
                    immigrationCase.getBeneficiaryName(), immigrationCase.getStatus(),
                    data.toString());
                
                return claudeService.generateCompletion(prompt, false).join();
                
            } catch (Exception e) {
                log.error("Error generating immigration form {}: {}", formType, e.getMessage(), e);
                throw new RuntimeException("Form generation failed: " + e.getMessage(), e);
            }
        });
    }

    @Override
    public CompletableFuture<String> fillUSCISForm(Long caseId, String formNumber, Map<String, Object> personalData) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AIImmigrationCase immigrationCase = getImmigrationCaseById(caseId);
                
                String prompt = String.format("""
                    Fill out USCIS Form %s with the following information:
                    
                    Case Details:
                    - Case Type: %s
                    - Country of Origin: %s
                    - Priority Level: %s
                    
                    Personal Information: %s
                    
                    Please provide:
                    1. Completed form with all applicable fields
                    2. Supporting document checklist
                    3. Filing instructions
                    4. Fee calculation
                    """, formNumber, immigrationCase.getFormType(), 
                    immigrationCase.getBeneficiaryName(), immigrationCase.getPriorityDate(),
                    personalData.toString());
                
                return claudeService.generateCompletion(prompt, false).join();
                
            } catch (Exception e) {
                log.error("Error filling USCIS form {}: {}", formNumber, e.getMessage());
                throw new RuntimeException("USCIS form filling failed: " + e.getMessage(), e);
            }
        });
    }

    @Override
    public CompletableFuture<List<String>> batchProcessForms(Long caseId, List<String> formNumbers) {
        return CompletableFuture.supplyAsync(() -> {
            log.info("Batch processing {} forms for case: {}", formNumbers.size(), caseId);
            
            return formNumbers.parallelStream()
                    .map(formNumber -> {
                        try {
                            return fillUSCISForm(caseId, formNumber, new HashMap<>()).join();
                        } catch (Exception e) {
                            log.error("Failed to process form {}: {}", formNumber, e.getMessage());
                            return "ERROR: Failed to process form " + formNumber;
                        }
                    })
                    .collect(ArrayList::new, ArrayList::add, ArrayList::addAll);
        });
    }

    @Override
    public CompletableFuture<List<Map<String, Object>>> calculateImmigrationDeadlines(Long caseId) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AIImmigrationCase immigrationCase = getImmigrationCaseById(caseId);
                
                String prompt = String.format("""
                    Calculate all relevant deadlines for this immigration case:
                    
                    Case Type: %s
                    Current Stage: %s
                    Filing Date: %s
                    Priority Date: %s
                    
                    Please provide:
                    1. Response deadlines for any pending requests
                    2. Medical examination deadlines
                    3. Interview scheduling deadlines
                    4. Document renewal deadlines
                    5. Appeal deadlines if applicable
                    
                    Return as structured list with deadline type, date, and importance level.
                    """, immigrationCase.getFormType(), immigrationCase.getStatus(),
                    immigrationCase.getCreatedAt(), immigrationCase.getNextActionDate());
                
                String response = claudeService.generateCompletion(prompt, false).join();
                
                // Parse response into structured format
                List<Map<String, Object>> deadlines = new ArrayList<>();
                String[] lines = response.split("\\n");
                for (String line : lines) {
                    if (line.contains(":") && (line.contains("deadline") || line.contains("due"))) {
                        Map<String, Object> deadline = new HashMap<>();
                        deadline.put("description", line.trim());
                        deadline.put("caseId", caseId);
                        deadline.put("category", "immigration");
                        deadlines.add(deadline);
                    }
                }
                
                return deadlines;
                
            } catch (Exception e) {
                log.error("Error calculating immigration deadlines: {}", e.getMessage());
                return List.of();
            }
        });
    }

    @Override
    public CompletableFuture<String> generateDeadlineReport(Long caseId) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                List<Map<String, Object>> deadlines = calculateImmigrationDeadlines(caseId).join();
                AIImmigrationCase immigrationCase = getImmigrationCaseById(caseId);
                
                StringBuilder report = new StringBuilder();
                report.append("IMMIGRATION CASE DEADLINE REPORT\n");
                report.append("=====================================\n\n");
                report.append("Case ID: ").append(caseId).append("\n");
                report.append("Case Type: ").append(immigrationCase.getFormType()).append("\n");
                report.append("Current Status: ").append(immigrationCase.getStatus()).append("\n\n");
                report.append("UPCOMING DEADLINES:\n");
                
                for (Map<String, Object> deadline : deadlines) {
                    report.append("• ").append(deadline.get("description")).append("\n");
                }
                
                return report.toString();
                
            } catch (Exception e) {
                log.error("Error generating deadline report: {}", e.getMessage());
                return "Error generating deadline report: " + e.getMessage();
            }
        });
    }

    @Override
    public List<Map<String, Object>> getUpcomingDeadlines(Long userId, int daysAhead) {
        LocalDate endDate = LocalDate.now().plusDays(daysAhead);
        List<AIImmigrationCase> cases = caseRepository.findCasesWithDeadlinesBetween(LocalDate.now(), endDate);
        
        List<Map<String, Object>> upcomingDeadlines = new ArrayList<>();
        for (AIImmigrationCase immigrationCase : cases) {
            Map<String, Object> deadline = new HashMap<>();
            deadline.put("caseId", immigrationCase.getId());
            deadline.put("caseType", immigrationCase.getFormType());
            deadline.put("deadline", immigrationCase.getNextActionDate());
            deadline.put("priorityLevel", immigrationCase.getPriorityDate());
            deadline.put("daysUntilDeadline", LocalDate.now().until(immigrationCase.getNextActionDate()).getDays());
            upcomingDeadlines.add(deadline);
        }
        
        return upcomingDeadlines;
    }

    @Override
    public CompletableFuture<Map<String, Object>> analyzeEvidenceRequirements(ImmigrationCaseType caseType) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                String prompt = String.format("""
                    Analyze evidence requirements for immigration case type: %s
                    
                    Please provide:
                    1. Required documents list
                    2. Supporting evidence categories
                    3. Timeline requirements
                    4. Common missing documents
                    5. Quality standards for evidence
                    6. Alternative evidence options
                    
                    Format as structured analysis.
                    """, caseType);
                
                String analysis = claudeService.generateCompletion(prompt, false).join();
                
                Map<String, Object> result = new HashMap<>();
                result.put("caseType", caseType);
                result.put("analysis", analysis);
                result.put("generatedAt", LocalDateTime.now());
                
                return result;
                
            } catch (Exception e) {
                log.error("Error analyzing evidence requirements: {}", e.getMessage());
                throw new RuntimeException("Evidence analysis failed: " + e.getMessage(), e);
            }
        });
    }

    @Override
    public CompletableFuture<List<String>> suggestMissingEvidence(Long caseId) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AIImmigrationCase immigrationCase = getImmigrationCaseById(caseId);
                List<AIImmigrationDocument> existingDocs = documentRepository.findByCaseIdOrderByCreatedAtDesc(caseId);
                
                String existingDocsStr = existingDocs.stream()
                        .map(doc -> doc.getDocumentType() + ": " + doc.getStatus())
                        .reduce("", (a, b) -> a + "\n" + b);
                
                String prompt = String.format("""
                    Review this immigration case and suggest missing evidence:
                    
                    Case Type: %s
                    Current Stage: %s
                    Country of Origin: %s
                    
                    Existing Documents:
                    %s
                    
                    Please identify:
                    1. Critical missing documents
                    2. Supporting evidence gaps
                    3. Document quality issues
                    4. Timeline concerns
                    
                    Return as prioritized list.
                    """, immigrationCase.getFormType(), immigrationCase.getStatus(),
                    immigrationCase.getBeneficiaryName(), existingDocsStr);
                
                String response = claudeService.generateCompletion(prompt, false).join();
                return Arrays.asList(response.split("\\n"))
                        .stream()
                        .filter(line -> line.trim().matches("^\\d+\\..*") || line.contains("missing") || line.contains("required"))
                        .collect(ArrayList::new, ArrayList::add, ArrayList::addAll);
                
            } catch (Exception e) {
                log.error("Error suggesting missing evidence: {}", e.getMessage());
                return List.of("Error analyzing case for missing evidence");
            }
        });
    }

    @Override
    public CompletableFuture<String> generateEvidenceChecklist(Long caseId) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AIImmigrationCase immigrationCase = getImmigrationCaseById(caseId);
                // Default to FAMILY_BASED_PETITION for form type analysis
                Map<String, Object> requirements = analyzeEvidenceRequirements(ImmigrationCaseType.FAMILY_BASED_PETITION).join();
                
                String prompt = String.format("""
                    Generate a comprehensive evidence checklist for:
                    
                    Case Type: %s
                    Current Stage: %s
                    
                    Requirements Analysis: %s
                    
                    Create checklist with:
                    1. Required documents (with checkboxes)
                    2. Supporting evidence options
                    3. Submission deadlines
                    4. Quality requirements
                    5. Common pitfalls to avoid
                    """, immigrationCase.getFormType(), immigrationCase.getStatus(),
                    requirements.get("analysis"));
                
                return claudeService.generateCompletion(prompt, false).join();
                
            } catch (Exception e) {
                log.error("Error generating evidence checklist: {}", e.getMessage());
                return "Error generating evidence checklist: " + e.getMessage();
            }
        });
    }

    @Override
    public AIImmigrationDocument saveImmigrationDocument(AIImmigrationDocument document) {
        document.setCreatedAt(LocalDateTime.now());
        document.setUpdatedAt(LocalDateTime.now());
        return documentRepository.save(document);
    }

    @Override
    public List<AIImmigrationDocument> getDocumentsByCaseId(Long caseId) {
        return documentRepository.findByCaseIdOrderByCreatedAtDesc(caseId);
    }

    @Override
    public Page<AIImmigrationDocument> getDocumentsByType(String documentType, Pageable pageable) {
        return documentRepository.findByDocumentType(documentType, pageable);
    }

    @Override
    public CompletableFuture<Map<String, Object>> validateFormData(String formNumber, Map<String, Object> formData) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                String prompt = String.format("""
                    Validate the data for USCIS Form %s:
                    
                    Provided Data: %s
                    
                    Check for:
                    1. Required field completeness
                    2. Data format correctness
                    3. Consistency across fields
                    4. Common errors
                    5. Missing supporting evidence
                    
                    Return validation results with errors and warnings.
                    """, formNumber, formData.toString());
                
                String validation = claudeService.generateCompletion(prompt, false).join();
                
                Map<String, Object> result = new HashMap<>();
                result.put("formNumber", formNumber);
                result.put("isValid", !validation.toLowerCase().contains("error") && !validation.toLowerCase().contains("missing"));
                result.put("validationReport", validation);
                result.put("validatedAt", LocalDateTime.now());
                
                return result;
                
            } catch (Exception e) {
                log.error("Error validating form data: {}", e.getMessage());
                throw new RuntimeException("Form validation failed: " + e.getMessage(), e);
            }
        });
    }

    @Override
    public CompletableFuture<String> generateFilingInstructions(Long caseId, String formNumber) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AIImmigrationCase immigrationCase = getImmigrationCaseById(caseId);
                
                String prompt = String.format("""
                    Generate detailed filing instructions for USCIS Form %s:
                    
                    Case Details:
                    - Case Type: %s
                    - Current Stage: %s
                    - Priority Level: %s
                    
                    Include:
                    1. Step-by-step filing process
                    2. Required supporting documents
                    3. Filing fees and payment methods
                    4. Where to file (address/online)
                    5. Expected processing times
                    6. What to expect after filing
                    7. Common mistakes to avoid
                    """, formNumber, immigrationCase.getFormType(),
                    immigrationCase.getStatus(), immigrationCase.getPriorityDate());
                
                return claudeService.generateCompletion(prompt, false).join();
                
            } catch (Exception e) {
                log.error("Error generating filing instructions: {}", e.getMessage());
                return "Error generating filing instructions: " + e.getMessage();
            }
        });
    }

    @Override
    public CompletableFuture<List<String>> getRequiredSupportingDocs(String formNumber) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                String prompt = String.format("""
                    List all required supporting documents for USCIS Form %s:
                    
                    Please provide:
                    1. Mandatory documents (always required)
                    2. Conditional documents (required in specific situations)
                    3. Optional supporting evidence
                    4. Document format requirements
                    5. Translation requirements
                    
                    Return as organized list.
                    """, formNumber);
                
                String response = claudeService.generateCompletion(prompt, false).join();
                return Arrays.asList(response.split("\\n"))
                        .stream()
                        .filter(line -> !line.trim().isEmpty())
                        .collect(ArrayList::new, ArrayList::add, ArrayList::addAll);
                
            } catch (Exception e) {
                log.error("Error getting required supporting docs: {}", e.getMessage());
                return List.of("Error retrieving supporting document requirements");
            }
        });
    }
}