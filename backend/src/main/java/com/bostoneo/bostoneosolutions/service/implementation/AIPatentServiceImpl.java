package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.service.AIPatentService;
import com.bostoneo.bostoneosolutions.service.ai.ClaudeSonnet4Service;
import com.bostoneo.bostoneosolutions.model.AIPatentApplication;
import com.bostoneo.bostoneosolutions.model.AIPatentPriorArt;
import com.bostoneo.bostoneosolutions.enumeration.PatentType;
import com.bostoneo.bostoneosolutions.enumeration.PatentStatus;
import com.bostoneo.bostoneosolutions.repository.AIPatentApplicationRepository;
import com.bostoneo.bostoneosolutions.repository.AIPatentPriorArtRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.CompletableFuture;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class AIPatentServiceImpl implements AIPatentService {

    private final AIPatentApplicationRepository applicationRepository;
    private final AIPatentPriorArtRepository priorArtRepository;
    private final ClaudeSonnet4Service claudeService;

    @Override
    public AIPatentApplication createPatentApplication(AIPatentApplication application) {
        log.info("Creating patent application for client: {}", application.getClientId());
        application.setCreatedAt(LocalDateTime.now());
        application.setUpdatedAt(LocalDateTime.now());
        return applicationRepository.save(application);
    }

    @Override
    public AIPatentApplication updatePatentApplication(Long id, AIPatentApplication application) {
        log.info("Updating patent application with ID: {}", id);
        AIPatentApplication existing = getPatentApplicationById(id);
        
        existing.setPatentType(application.getPatentType());
        existing.setStatus(application.getStatus());
        existing.setTitle(application.getTitle());
        existing.setTechnologyArea(application.getTechnologyArea());
        existing.setExaminationDate(application.getExaminationDate());
        existing.setUpdatedAt(LocalDateTime.now());
        
        return applicationRepository.save(existing);
    }

    @Override
    public AIPatentApplication getPatentApplicationById(Long id) {
        return applicationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Patent application not found with ID: " + id));
    }

    @Override
    public Page<AIPatentApplication> getApplicationsByType(PatentType patentType, Pageable pageable) {
        return applicationRepository.findByPatentType(patentType, pageable);
    }

    @Override
    public Page<AIPatentApplication> getApplicationsByStatus(PatentStatus status, Pageable pageable) {
        return applicationRepository.findByStatus(status, pageable);
    }

    @Override
    public void deletePatentApplication(Long id) {
        log.info("Deleting patent application with ID: {}", id);
        applicationRepository.deleteById(id);
    }

    @Override
    public CompletableFuture<String> generatePatentClaims(Long applicationId, Map<String, Object> inventionDetails) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                log.info("Generating patent claims for application: {}", applicationId);
                
                AIPatentApplication application = getPatentApplicationById(applicationId);
                
                String prompt = String.format("""
                    Generate patent claims for invention:
                    
                    Title: %s
                    Technology Area: %s
                    Invention Details: %s
                    
                    Create comprehensive claim set:
                    1. Independent claims (method, system, apparatus)
                    2. Dependent claims adding specific limitations
                    3. Multiple independent claims for different aspects
                    4. Claims of varying scope (broad to narrow)
                    5. Proper claim language and formatting
                    6. Clear antecedent basis
                    7. Definite claim elements
                    8. Avoid indefinite terms
                    9. USPTO compliance formatting
                    10. Strategic claim coverage
                    
                    Format according to USPTO standards.
                    """, application.getTitle(), application.getTechnologyArea(),
                    inventionDetails.toString());
                
                return claudeService.generateCompletion(prompt, false).join();
                
            } catch (Exception e) {
                log.error("Error generating patent claims: {}", e.getMessage(), e);
                throw new RuntimeException("Patent claims generation failed: " + e.getMessage(), e);
            }
        });
    }

    @Override
    public CompletableFuture<String> generatePatentSpecification(Long applicationId) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AIPatentApplication application = getPatentApplicationById(applicationId);
                
                String prompt = String.format("""
                    Generate patent specification for:
                    
                    Title: %s
                    Technology Area: %s
                    Abstract: %s
                    Claims: %s
                    
                    Include complete specification sections:
                    1. Title of the Invention
                    2. Cross-Reference to Related Applications
                    3. Statement of Federally Sponsored Research
                    4. Background of the Invention
                    5. Brief Summary of the Invention
                    6. Brief Description of the Drawings
                    7. Detailed Description of the Invention
                    8. Claims
                    9. Abstract
                    10. Drawings (descriptions)
                    
                    Follow USPTO MPEP guidelines for formatting.
                    """, application.getTitle(), application.getTechnologyArea(),
                    application.getAbstractText(), application.getClaims());
                
                return claudeService.generateCompletion(prompt, false).join();
                
            } catch (Exception e) {
                log.error("Error generating patent specification: {}", e.getMessage());
                throw new RuntimeException("Patent specification generation failed: " + e.getMessage(), e);
            }
        });
    }

    @Override
    public CompletableFuture<String> generatePatentAbstract(Long applicationId, String specificationText) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AIPatentApplication application = getPatentApplicationById(applicationId);
                
                String prompt = String.format("""
                    Generate patent abstract for:
                    
                    Title: %s
                    Technology Area: %s
                    Specification: %s
                    
                    Create concise abstract (150 words max) that:
                    1. Summarizes the technical disclosure
                    2. Describes the nature and substance of invention
                    3. Explains the object and advantages
                    4. Describes the manner of making/using
                    5. Avoids specific claim language
                    6. Uses clear, concise language
                    7. Follows USPTO format requirements
                    8. Enables patent searching
                    9. Provides technical overview
                    10. Attracts reader interest
                    """, application.getTitle(), application.getTechnologyArea(),
                    specificationText);
                
                return claudeService.generateCompletion(prompt, false).join();
                
            } catch (Exception e) {
                log.error("Error generating patent abstract: {}", e.getMessage());
                return "Error generating patent abstract: " + e.getMessage();
            }
        });
    }

    @Override
    public CompletableFuture<String> generatePatentSummary(Long applicationId) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AIPatentApplication application = getPatentApplicationById(applicationId);
                
                String prompt = String.format("""
                    Generate patent summary for:
                    
                    Title: %s
                    Technology Area: %s
                    Current Status: %s
                    
                    Provide comprehensive summary:
                    1. Invention overview and objectives
                    2. Technical problem addressed
                    3. Solution provided by invention
                    4. Key technical features
                    5. Advantages over prior art
                    6. Commercial applications
                    7. Patent family information
                    8. Prosecution history summary
                    9. Current status and next steps
                    10. Strategic value assessment
                    """, application.getTitle(), application.getTechnologyArea(),
                    application.getStatus());
                
                return claudeService.generateCompletion(prompt, false).join();
                
            } catch (Exception e) {
                log.error("Error generating patent summary: {}", e.getMessage());
                return "Error generating patent summary: " + e.getMessage();
            }
        });
    }

    @Override
    public CompletableFuture<List<String>> conductPriorArtSearch(Long applicationId, String searchQuery) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AIPatentApplication application = getPatentApplicationById(applicationId);
                
                String prompt = String.format("""
                    Conduct prior art search for invention:
                    
                    Title: %s
                    Technology Area: %s
                    Search Query: %s
                    
                    Search strategy should include:
                    1. USPTO patent database search
                    2. Google Patents search
                    3. Scientific literature search
                    4. Industry publications
                    5. Product documentation
                    6. Standards and specifications
                    7. International patent databases
                    8. Non-patent literature
                    9. Competitor analysis
                    10. Academic publications
                    
                    Return list of relevant prior art references with analysis.
                    """, application.getTitle(), application.getTechnologyArea(),
                    searchQuery);
                
                String response = claudeService.generateCompletion(prompt, false).join();
                return Arrays.asList(response.split("\\n"))
                        .stream()
                        .filter(line -> !line.trim().isEmpty())
                        .collect(ArrayList::new, ArrayList::add, ArrayList::addAll);
                
            } catch (Exception e) {
                log.error("Error conducting prior art search: {}", e.getMessage());
                return List.of("Error conducting prior art search");
            }
        });
    }

    @Override
    public CompletableFuture<Map<String, Object>> analyzePriorArt(Long applicationId, List<String> priorArtReferences) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AIPatentApplication application = getPatentApplicationById(applicationId);
                
                String prompt = String.format("""
                    Analyze prior art for patent application:
                    
                    Invention: %s
                    Technology Area: %s
                    Prior Art References: %s
                    
                    Provide detailed analysis:
                    1. Relevance assessment for each reference
                    2. Key features disclosed in prior art
                    3. Differences from claimed invention
                    4. Potential anticipation issues
                    5. Obviousness analysis
                    6. Combination of references
                    7. Claims most at risk
                    8. Potential amendments needed
                    9. Prosecution strategy recommendations
                    10. Patentability assessment
                    """, application.getTitle(), application.getTechnologyArea(),
                    priorArtReferences.toString());
                
                String analysis = claudeService.generateCompletion(prompt, false).join();
                
                Map<String, Object> result = new HashMap<>();
                result.put("applicationId", applicationId);
                result.put("priorArtAnalysis", analysis);
                result.put("referencesAnalyzed", priorArtReferences.size());
                result.put("analyzedAt", LocalDateTime.now());
                
                return result;
                
            } catch (Exception e) {
                log.error("Error analyzing prior art: {}", e.getMessage());
                throw new RuntimeException("Prior art analysis failed: " + e.getMessage(), e);
            }
        });
    }

    @Override
    public AIPatentPriorArt savePriorArtReference(AIPatentPriorArt priorArt) {
        priorArt.setCreatedAt(LocalDateTime.now());
        priorArt.setUpdatedAt(LocalDateTime.now());
        return priorArtRepository.save(priorArt);
    }

    @Override
    public List<AIPatentPriorArt> getPriorArtByApplicationId(Long applicationId) {
        return priorArtRepository.findByApplicationIdOrderByRelevanceScoreDesc(applicationId);
    }

    @Override
    public CompletableFuture<Map<String, Object>> analyzePatentability(Long applicationId) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AIPatentApplication application = getPatentApplicationById(applicationId);
                List<AIPatentPriorArt> priorArt = getPriorArtByApplicationId(applicationId);
                
                String prompt = String.format("""
                    Analyze patentability of invention:
                    
                    Title: %s
                    Technology Area: %s
                    Prior Art Count: %d
                    
                    Evaluate against 35 USC requirements:
                    1. Section 101 - Subject matter eligibility
                    2. Section 102 - Novelty analysis
                    3. Section 103 - Non-obviousness analysis
                    4. Section 112 - Written description/enablement
                    5. Best mode requirement
                    6. Definiteness of claims
                    7. Unity of invention
                    8. Double patenting analysis
                    9. Prior art impact assessment
                    10. Overall patentability recommendation
                    
                    Provide detailed patentability opinion.
                    """, application.getTitle(), application.getTechnologyArea(),
                    priorArt.size());
                
                String analysis = claudeService.generateCompletion(prompt, false).join();
                
                Map<String, Object> result = new HashMap<>();
                result.put("applicationId", applicationId);
                result.put("patentabilityAnalysis", analysis);
                result.put("priorArtConsidered", priorArt.size());
                result.put("analyzedAt", LocalDateTime.now());
                
                return result;
                
            } catch (Exception e) {
                log.error("Error analyzing patentability: {}", e.getMessage());
                throw new RuntimeException("Patentability analysis failed: " + e.getMessage(), e);
            }
        });
    }

    @Override
    public CompletableFuture<String> generatePatentabilityReport(Long applicationId) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                Map<String, Object> analysis = analyzePatentability(applicationId).join();
                AIPatentApplication application = getPatentApplicationById(applicationId);
                
                String prompt = String.format("""
                    Generate formal patentability report:
                    
                    Application: %s
                    Analysis: %s
                    
                    Structure report with:
                    1. Executive summary
                    2. Invention description
                    3. Prior art summary
                    4. Patentability analysis
                    5. Novelty assessment
                    6. Non-obviousness evaluation
                    7. Subject matter eligibility
                    8. Claim recommendations
                    9. Prosecution strategy
                    10. Conclusion and recommendations
                    
                    Format as professional patent opinion.
                    """, application.getTitle(), analysis.get("patentabilityAnalysis"));
                
                return claudeService.generateCompletion(prompt, false).join();
                
            } catch (Exception e) {
                log.error("Error generating patentability report: {}", e.getMessage());
                return "Error generating patentability report: " + e.getMessage();
            }
        });
    }

    @Override
    public CompletableFuture<List<String>> identifyNoveltyElements(Long applicationId) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AIPatentApplication application = getPatentApplicationById(applicationId);
                List<AIPatentPriorArt> priorArt = getPriorArtByApplicationId(applicationId);
                
                String prompt = String.format("""
                    Identify novel elements in invention:
                    
                    Invention: %s
                    Technology Area: %s
                    Prior Art References: %d
                    
                    Compare invention to prior art and identify:
                    1. Novel structural features
                    2. Novel functional aspects
                    3. Unexpected results or advantages
                    4. New combinations of known elements
                    5. Novel methods or processes
                    6. Unique applications or uses
                    7. Technical improvements
                    8. Solution to unrecognized problems
                    9. Surprising properties
                    10. Commercial advantages
                    
                    List specific novel elements with justification.
                    """, application.getTitle(), application.getTechnologyArea(),
                    priorArt.size());
                
                String response = claudeService.generateCompletion(prompt, false).join();
                return Arrays.asList(response.split("\\n"))
                        .stream()
                        .filter(line -> !line.trim().isEmpty() && (line.contains("novel") || line.contains("unique") || line.contains("•")))
                        .collect(ArrayList::new, ArrayList::add, ArrayList::addAll);
                
            } catch (Exception e) {
                log.error("Error identifying novelty elements: {}", e.getMessage());
                return List.of("Error identifying novelty elements");
            }
        });
    }

    @Override
    public CompletableFuture<List<String>> analyzeObviousnessRejections(Long applicationId) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AIPatentApplication application = getPatentApplicationById(applicationId);
                
                String prompt = String.format("""
                    Analyze potential obviousness rejections for:
                    
                    Invention: %s
                    Rejection Reasons: %s
                    
                    Evaluate obviousness under Graham v. John Deere factors:
                    1. Scope and content of prior art
                    2. Differences between prior art and claims
                    3. Level of ordinary skill in the art
                    4. Secondary considerations
                    5. Teaching-suggestion-motivation test
                    6. Combination of prior art references
                    7. Common knowledge in the field
                    8. Predictable variations
                    9. Response strategies
                    10. Potential claim amendments
                    
                    Provide detailed obviousness analysis and response options.
                    """, application.getTitle(), "Examination pending");
                
                String response = claudeService.generateCompletion(prompt, false).join();
                return Arrays.asList(response.split("\\n"))
                        .stream()
                        .filter(line -> !line.trim().isEmpty())
                        .collect(ArrayList::new, ArrayList::add, ArrayList::addAll);
                
            } catch (Exception e) {
                log.error("Error analyzing obviousness rejections: {}", e.getMessage());
                return List.of("Error analyzing obviousness rejections");
            }
        });
    }

    @Override
    public CompletableFuture<String> generateUSPTOForm(Long applicationId, String formType) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AIPatentApplication application = getPatentApplicationById(applicationId);
                
                String prompt = String.format("""
                    Generate USPTO Form %s for patent application:
                    
                    Application: %s
                    Inventor(s): %s
                    Assignee: %s
                    
                    Complete form with:
                    1. All required fields
                    2. Proper formatting
                    3. Current USPTO requirements
                    4. Accurate information
                    5. Appropriate signatures
                    6. Filing fee calculations
                    7. Supporting declarations
                    8. Proper entity status
                    9. Address information
                    10. Filing instructions
                    
                    Use current USPTO form version and requirements.
                    """, formType, application.getTitle(),
                    application.getInventors(), application.getAssignees());
                
                return claudeService.generateCompletion(prompt, false).join();
                
            } catch (Exception e) {
                log.error("Error generating USPTO form: {}", e.getMessage());
                throw new RuntimeException("USPTO form generation failed: " + e.getMessage(), e);
            }
        });
    }

    @Override
    public CompletableFuture<String> generateApplicationDataSheet(Long applicationId) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AIPatentApplication application = getPatentApplicationById(applicationId);
                
                String prompt = String.format("""
                    Generate Application Data Sheet (ADS) for:
                    
                    Title: %s
                    Inventor(s): %s
                    Assignee: %s
                    Technology: %s
                    
                    Include all ADS sections:
                    1. Applicant information
                    2. Inventor information
                    3. Correspondence address
                    4. Representative information
                    5. Domestic priority claims
                    6. Foreign priority claims
                    7. Assignee information
                    8. Entity status
                    9. Title of invention
                    10. Attorney docket number
                    
                    Format according to current USPTO requirements.
                    """, application.getTitle(), application.getInventors(),
                    application.getAssignees(), application.getTechnologyArea());
                
                return claudeService.generateCompletion(prompt, false).join();
                
            } catch (Exception e) {
                log.error("Error generating application data sheet: {}", e.getMessage());
                return "Error generating application data sheet: " + e.getMessage();
            }
        });
    }

    @Override
    public CompletableFuture<String> generateDeclarationForm(Long applicationId, Map<String, Object> inventorInfo) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AIPatentApplication application = getPatentApplicationById(applicationId);
                
                String prompt = String.format("""
                    Generate inventor declaration form for:
                    
                    Application: %s
                    Inventor Information: %s
                    
                    Include declaration requirements:
                    1. Inventor identification
                    2. Citizenship information
                    3. Residence information
                    4. Mailing address
                    5. Declaration of inventorship
                    6. Authorization of attorney
                    7. Duty of disclosure acknowledgment
                    8. Warning statements
                    9. Signature requirements
                    10. Date of execution
                    
                    Use current USPTO declaration form (AIA version).
                    """, application.getTitle(), inventorInfo.toString());
                
                return claudeService.generateCompletion(prompt, false).join();
                
            } catch (Exception e) {
                log.error("Error generating declaration form: {}", e.getMessage());
                return "Error generating declaration form: " + e.getMessage();
            }
        });
    }

    @Override
    public CompletableFuture<String> generateOfficeActionResponse(Long applicationId, String officeActionText) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AIPatentApplication application = getPatentApplicationById(applicationId);
                
                String prompt = String.format("""
                    Generate office action response for:
                    
                    Application: %s
                    Office Action: %s
                    
                    Structure response with:
                    1. Remarks addressing each rejection
                    2. Claim amendments (if needed)
                    3. Arguments distinguishing prior art
                    4. Evidence of unexpected results
                    5. Expert declarations (if applicable)
                    6. Amendment justification
                    7. Support in specification
                    8. Traversal of all rejections
                    9. Request for reconsideration
                    10. Professional presentation
                    
                    Provide comprehensive response strategy.
                    """, application.getTitle(), officeActionText);
                
                return claudeService.generateCompletion(prompt, false).join();
                
            } catch (Exception e) {
                log.error("Error generating office action response: {}", e.getMessage());
                throw new RuntimeException("Office action response generation failed: " + e.getMessage(), e);
            }
        });
    }

    @Override
    public CompletableFuture<String> generateAmendmentText(Long applicationId, Map<String, Object> amendmentDetails) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AIPatentApplication application = getPatentApplicationById(applicationId);
                
                String prompt = String.format("""
                    Generate claim amendments for patent application:
                    
                    Application: %s
                    Amendment Details: %s
                    Current Claims: %s
                    
                    Format amendments with:
                    1. Proper amendment format
                    2. Clear indication of changes
                    3. Strike-through for deletions
                    4. Underlining for additions
                    5. Claim listing with status
                    6. Amendment justification
                    7. Support in specification
                    8. Antecedent basis check
                    9. Claim dependency verification
                    10. USPTO formatting compliance
                    """, application.getTitle(), amendmentDetails.toString(),
                    application.getClaims());
                
                return claudeService.generateCompletion(prompt, false).join();
                
            } catch (Exception e) {
                log.error("Error generating amendment text: {}", e.getMessage());
                return "Error generating amendment text: " + e.getMessage();
            }
        });
    }

    @Override
    public CompletableFuture<List<String>> suggestClaimAmendments(Long applicationId, String rejectionText) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AIPatentApplication application = getPatentApplicationById(applicationId);
                
                String prompt = String.format("""
                    Suggest claim amendments to overcome rejections:
                    
                    Application: %s
                    Rejection: %s
                    Current Claims: %s
                    
                    Suggest amendments to:
                    1. Add distinguishing limitations
                    2. Narrow claim scope appropriately
                    3. Incorporate dependent claim features
                    4. Add method steps for clarity
                    5. Include specific structural elements
                    6. Add functional limitations
                    7. Incorporate advantageous features
                    8. Maintain broad protection
                    9. Address all rejections
                    10. Preserve claim value
                    
                    Provide specific amendment suggestions with rationale.
                    """, application.getTitle(), rejectionText,
                    application.getClaims());
                
                String response = claudeService.generateCompletion(prompt, false).join();
                return Arrays.asList(response.split("\\n"))
                        .stream()
                        .filter(line -> !line.trim().isEmpty() && (line.contains("amend") || line.contains("add") || line.contains("•")))
                        .collect(ArrayList::new, ArrayList::add, ArrayList::addAll);
                
            } catch (Exception e) {
                log.error("Error suggesting claim amendments: {}", e.getMessage());
                return List.of("Error suggesting claim amendments");
            }
        });
    }

    @Override
    public CompletableFuture<Map<String, Object>> analyzePatenPortfolio(Long clientId) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                List<AIPatentApplication> applications = applicationRepository.findByClientIdOrderByCreatedAtDesc(clientId);
                
                String prompt = String.format("""
                    Analyze patent portfolio for client:
                    
                    Total Applications: %d
                    Applications: %s
                    
                    Provide portfolio analysis:
                    1. Technology coverage areas
                    2. Patent family relationships
                    3. Prosecution status summary
                    4. Maintenance fee schedule
                    5. Geographic coverage
                    6. Competitive landscape
                    7. Portfolio strengths
                    8. Coverage gaps
                    9. Strategic recommendations
                    10. Licensing opportunities
                    
                    Assess overall portfolio value and strategy.
                    """, applications.size(), 
                    applications.stream().map(AIPatentApplication::getTitle).toList());
                
                String analysis = claudeService.generateCompletion(prompt, false).join();
                
                Map<String, Object> result = new HashMap<>();
                result.put("clientId", clientId);
                result.put("portfolioAnalysis", analysis);
                result.put("totalApplications", applications.size());
                result.put("analyzedAt", LocalDateTime.now());
                
                return result;
                
            } catch (Exception e) {
                log.error("Error analyzing patent portfolio: {}", e.getMessage());
                throw new RuntimeException("Patent portfolio analysis failed: " + e.getMessage(), e);
            }
        });
    }

    @Override
    public CompletableFuture<String> generatePortfolioReport(Long clientId) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                Map<String, Object> analysis = analyzePatenPortfolio(clientId).join();
                
                String prompt = String.format("""
                    Generate comprehensive patent portfolio report:
                    
                    Client ID: %s
                    Portfolio Analysis: %s
                    
                    Structure report with:
                    1. Executive summary
                    2. Portfolio overview
                    3. Technology analysis
                    4. Patent status summary
                    5. Competitive analysis
                    6. Risk assessment
                    7. Maintenance schedule
                    8. Strategic recommendations
                    9. Action items
                    10. Conclusion
                    
                    Format as professional portfolio assessment.
                    """, clientId, analysis.get("portfolioAnalysis"));
                
                return claudeService.generateCompletion(prompt, false).join();
                
            } catch (Exception e) {
                log.error("Error generating portfolio report: {}", e.getMessage());
                return "Error generating portfolio report: " + e.getMessage();
            }
        });
    }

    @Override
    public CompletableFuture<List<String>> identifyFreedomToOperate(String technologyArea) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                String prompt = String.format("""
                    Conduct freedom to operate analysis for technology area: %s
                    
                    Analyze:
                    1. Active patents in technology area
                    2. Patent expiration dates
                    3. Potential infringement risks
                    4. Design-around opportunities
                    5. Licensing requirements
                    6. Geographic considerations
                    7. Enforcement likelihood
                    8. Alternative technologies
                    9. Prior art invalidity potential
                    10. Risk mitigation strategies
                    
                    Provide FTO assessment with recommendations.
                    """, technologyArea);
                
                String response = claudeService.generateCompletion(prompt, false).join();
                return Arrays.asList(response.split("\\n"))
                        .stream()
                        .filter(line -> !line.trim().isEmpty())
                        .collect(ArrayList::new, ArrayList::add, ArrayList::addAll);
                
            } catch (Exception e) {
                log.error("Error identifying freedom to operate: {}", e.getMessage());
                return List.of("Error conducting freedom to operate analysis");
            }
        });
    }

    @Override
    public CompletableFuture<String> generatePCTApplication(Long applicationId) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AIPatentApplication application = getPatentApplicationById(applicationId);
                
                String prompt = String.format("""
                    Generate PCT application for:
                    
                    US Application: %s
                    Title: %s
                    Technology: %s
                    
                    Include PCT requirements:
                    1. PCT Request Form
                    2. Description (specification)
                    3. Claims
                    4. Abstract
                    5. Drawings (if applicable)
                    6. Sequence listing (if applicable)
                    7. PCT/RO/101 form
                    8. Priority document
                    9. Translation requirements
                    10. Fee calculation
                    
                    Format according to PCT requirements.
                    """, application.getApplicationNumber(), application.getTitle(),
                    application.getTechnologyArea());
                
                return claudeService.generateCompletion(prompt, false).join();
                
            } catch (Exception e) {
                log.error("Error generating PCT application: {}", e.getMessage());
                throw new RuntimeException("PCT application generation failed: " + e.getMessage(), e);
            }
        });
    }

    @Override
    public CompletableFuture<List<String>> analyzeInternationalRequirements(List<String> targetCountries) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                String prompt = String.format("""
                    Analyze international filing requirements for countries: %s
                    
                    For each country, provide:
                    1. Filing deadlines and priority requirements
                    2. Translation requirements
                    3. Local agent requirements
                    4. Examination procedures
                    5. Publication timelines
                    6. Opposition procedures
                    7. Renewal/maintenance requirements
                    8. Enforcement considerations
                    9. Cost estimates
                    10. Strategic recommendations
                    
                    Prioritize countries by importance and feasibility.
                    """, targetCountries.toString());
                
                String response = claudeService.generateCompletion(prompt, false).join();
                return Arrays.asList(response.split("\\n"))
                        .stream()
                        .filter(line -> !line.trim().isEmpty())
                        .collect(ArrayList::new, ArrayList::add, ArrayList::addAll);
                
            } catch (Exception e) {
                log.error("Error analyzing international requirements: {}", e.getMessage());
                return List.of("Error analyzing international requirements");
            }
        });
    }

    @Override
    public CompletableFuture<Map<String, Object>> calculateInternationalFees(List<String> targetCountries) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                String prompt = String.format("""
                    Calculate international filing fees for countries: %s
                    
                    Estimate costs for:
                    1. PCT filing fees
                    2. National phase entry fees
                    3. Translation costs
                    4. Local agent fees
                    5. Government fees
                    6. Examination fees
                    7. Publication fees
                    8. Maintenance fees (first 5 years)
                    9. Professional fees
                    10. Miscellaneous costs
                    
                    Provide detailed cost breakdown by country.
                    """, targetCountries.toString());
                
                String calculation = claudeService.generateCompletion(prompt, false).join();
                
                Map<String, Object> result = new HashMap<>();
                result.put("targetCountries", targetCountries);
                result.put("feeCalculation", calculation);
                result.put("calculatedAt", LocalDateTime.now());
                
                return result;
                
            } catch (Exception e) {
                log.error("Error calculating international fees: {}", e.getMessage());
                throw new RuntimeException("International fee calculation failed: " + e.getMessage(), e);
            }
        });
    }

    @Override
    public CompletableFuture<List<Map<String, Object>>> calculateMaintenanceFees(Long applicationId) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                AIPatentApplication application = getPatentApplicationById(applicationId);
                
                String prompt = String.format("""
                    Calculate maintenance fee schedule for patent:
                    
                    Application: %s
                    Issue Date: %s
                    Entity Status: Small Entity
                    
                    Calculate fees for:
                    1. 3.5 year maintenance fee
                    2. 7.5 year maintenance fee
                    3. 11.5 year maintenance fee
                    4. Late payment surcharges
                    5. Entity status discounts
                    6. Fee change projections
                    7. Payment deadlines
                    8. Grace periods
                    9. Reinstatement procedures
                    10. Cost planning recommendations
                    
                    Provide detailed maintenance fee schedule.
                    """, application.getTitle(), application.getPublicationDate());
                
                String schedule = claudeService.generateCompletion(prompt, false).join();
                
                List<Map<String, Object>> fees = new ArrayList<>();
                Map<String, Object> feeSchedule = new HashMap<>();
                feeSchedule.put("applicationId", applicationId);
                feeSchedule.put("schedule", schedule);
                feeSchedule.put("calculatedAt", LocalDateTime.now());
                fees.add(feeSchedule);
                
                return fees;
                
            } catch (Exception e) {
                log.error("Error calculating maintenance fees: {}", e.getMessage());
                return List.of();
            }
        });
    }

    @Override
    public CompletableFuture<String> generateMaintenanceReport(Long clientId) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                List<AIPatentApplication> applications = applicationRepository.findByClientIdOrderByCreatedAtDesc(clientId);
                
                String prompt = String.format("""
                    Generate maintenance fee report for client portfolio:
                    
                    Client ID: %s
                    Total Patents: %d
                    
                    Include in report:
                    1. Upcoming maintenance fee deadlines
                    2. Fee amounts and due dates
                    3. Grace period information
                    4. Cost projections (next 5 years)
                    5. Entity status considerations
                    6. Payment recommendations
                    7. Portfolio value assessment
                    8. Abandonment considerations
                    9. Action required items
                    10. Calendar integration
                    
                    Format as comprehensive maintenance schedule.
                    """, clientId, applications.size());
                
                return claudeService.generateCompletion(prompt, false).join();
                
            } catch (Exception e) {
                log.error("Error generating maintenance report: {}", e.getMessage());
                return "Error generating maintenance report: " + e.getMessage();
            }
        });
    }

    @Override
    public List<Map<String, Object>> getUpcomingMaintenanceDeadlines(Long clientId) {
        List<AIPatentApplication> applications = applicationRepository.findByClientIdOrderByCreatedAtDesc(clientId);
        
        List<Map<String, Object>> deadlines = new ArrayList<>();
        for (AIPatentApplication app : applications) {
            if (app.getMaintenanceFeesDue() != null) {
                Map<String, Object> deadline = new HashMap<>();
                deadline.put("applicationId", app.getId());
                deadline.put("inventionTitle", app.getTitle());
                deadline.put("maintenanceDueDate", app.getMaintenanceFeesDue());
                deadline.put("status", app.getStatus());
                deadlines.add(deadline);
            }
        }
        
        return deadlines;
    }
}