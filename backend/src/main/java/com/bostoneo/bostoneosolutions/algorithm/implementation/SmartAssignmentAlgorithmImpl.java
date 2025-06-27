package com.***REMOVED***.***REMOVED***solutions.algorithm.implementation;

import com.***REMOVED***.***REMOVED***solutions.algorithm.SmartAssignmentAlgorithm;
import com.***REMOVED***.***REMOVED***solutions.dto.AssignmentRecommendation;
import com.***REMOVED***.***REMOVED***solutions.dto.AssignmentRecommendation.RecommendedUser;
import com.***REMOVED***.***REMOVED***solutions.enumeration.CasePriority;
import com.***REMOVED***.***REMOVED***solutions.enumeration.ExpertiseArea;
import com.***REMOVED***.***REMOVED***solutions.model.*;
import com.***REMOVED***.***REMOVED***solutions.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
@Slf4j
public class SmartAssignmentAlgorithmImpl implements SmartAssignmentAlgorithm {
    
    private final UserRepository userRepository;
    private final AttorneyExpertiseRepository expertiseRepository;
    private final CaseAssignmentRepository assignmentRepository;
    private final UserWorkloadRepository workloadRepository;
    private final AssignmentRuleRepository ruleRepository;
    
    private static final BigDecimal MAX_WORKLOAD_THRESHOLD = new BigDecimal("85.0");
    private static final BigDecimal IDEAL_WORKLOAD_THRESHOLD = new BigDecimal("70.0");
    
    @Override
    public AssignmentRecommendation recommendAssignment(LegalCase legalCase) {
        log.info("Calculating assignment recommendation for case: {}", legalCase.getCaseNumber());
        
        // Find suitable attorneys
        List<User> candidates = findSuitableAttorneys(legalCase, 10);
        
        if (candidates.isEmpty()) {
            log.warn("No suitable attorneys found for case: {}", legalCase.getCaseNumber());
            return null;
        }
        
        // Score and rank candidates
        List<RecommendedUser> recommendedUsers = candidates.stream()
            .map(attorney -> scoreAttorney(attorney, legalCase))
            .sorted((a, b) -> b.getScore().compareTo(a.getScore()))
            .limit(3)
            .collect(Collectors.toList());
        
        // Calculate case workload weight
        BigDecimal workloadWeight = calculateCaseWorkloadWeight(legalCase);
        
        // Get the top match score
        BigDecimal topMatchScore = recommendedUsers.isEmpty() ? BigDecimal.ZERO : 
            recommendedUsers.get(0).getScore();
        
        // Build recommendation details
        Map<String, Object> analysisDetails = new HashMap<>();
        analysisDetails.put("candidatesEvaluated", candidates.size());
        analysisDetails.put("caseType", legalCase.getType());
        analysisDetails.put("casePriority", legalCase.getPriority());
        analysisDetails.put("algorithmVersion", "1.0");
        
        return AssignmentRecommendation.builder()
            .caseId(legalCase.getId())
            .recommendedUsers(recommendedUsers)
            .workloadWeight(workloadWeight)
            .matchScore(topMatchScore)
            .recommendationReason(generateRecommendationReason(recommendedUsers, legalCase))
            .analysisDetails(analysisDetails)
            .build();
    }
    
    @Override
    public List<User> findSuitableAttorneys(LegalCase legalCase, int maxResults) {
        // Get all active attorneys
        List<User> attorneys = userRepository.findActiveAttorneys();
        
        // Filter by basic criteria
        return attorneys.stream()
            .filter(attorney -> canTakeCase(attorney, legalCase))
            .sorted((a, b) -> {
                double scoreA = calculateMatchScore(a, legalCase);
                double scoreB = calculateMatchScore(b, legalCase);
                return Double.compare(scoreB, scoreA);
            })
            .limit(maxResults)
            .collect(Collectors.toList());
    }
    
    @Override
    public double calculateMatchScore(User attorney, LegalCase legalCase) {
        double score = 0.0;
        
        // Expertise match (40% weight)
        double expertiseScore = calculateExpertiseScore(attorney, legalCase);
        score += expertiseScore * 0.4;
        
        // Workload balance (30% weight)
        double workloadScore = calculateWorkloadScore(attorney);
        score += workloadScore * 0.3;
        
        // Previous client experience (20% weight)
        double clientExperienceScore = calculateClientExperienceScore(attorney, legalCase);
        score += clientExperienceScore * 0.2;
        
        // Success rate (10% weight)
        double successRateScore = calculateSuccessRateScore(attorney, legalCase);
        score += successRateScore * 0.1;
        
        return score;
    }
    
    @Override
    public boolean canTakeCase(User attorney, LegalCase legalCase) {
        // Check if attorney is active
        if (!attorney.isEnabled()) {
            return false;
        }
        
        // Check workload capacity
        UserWorkload workload = workloadRepository
            .findByUserIdAndCalculationDate(attorney.getId(), LocalDate.now())
            .orElse(null);
        
        if (workload != null && workload.getCapacityPercentage().compareTo(MAX_WORKLOAD_THRESHOLD) > 0) {
            return false;
        }
        
        // Check for conflicts of interest (simplified)
        // In real implementation, this would check against conflict database
        
        return true;
    }
    
    private RecommendedUser scoreAttorney(User attorney, LegalCase legalCase) {
        BigDecimal score = BigDecimal.valueOf(calculateMatchScore(attorney, legalCase));
        
        // Get current workload
        UserWorkload workload = workloadRepository
            .findByUserIdAndCalculationDate(attorney.getId(), LocalDate.now())
            .orElse(null);
        
        BigDecimal currentWorkload = workload != null ? 
            workload.getCapacityPercentage() : BigDecimal.ZERO;
        
        // Calculate expertise match
        BigDecimal expertiseMatch = BigDecimal.valueOf(calculateExpertiseScore(attorney, legalCase));
        
        // Check previous client experience
        boolean hasClientExperience = assignmentRepository
            .existsByUserIdAndClientEmail(attorney.getId(), legalCase.getClientEmail());
        
        // Identify strengths and concerns
        List<String> strengths = identifyStrengths(attorney, legalCase);
        List<String> concerns = identifyConcerns(attorney, legalCase, currentWorkload);
        
        return RecommendedUser.builder()
            .user(attorney)
            .score(score)
            .currentWorkload(currentWorkload)
            .expertiseMatch(expertiseMatch)
            .hasPreviousClientExperience(hasClientExperience)
            .strengths(strengths)
            .concerns(concerns)
            .build();
    }
    
    private double calculateExpertiseScore(User attorney, LegalCase legalCase) {
        // Get attorney's expertise areas
        List<AttorneyExpertise> expertiseList = expertiseRepository
            .findByUserIdOrderByProficiencyDesc(attorney.getId());
        
        if (expertiseList.isEmpty()) {
            return 0.0;
        }
        
        // Match case type to expertise
        // This is simplified - real implementation would have sophisticated matching
        double maxScore = 0.0;
        for (AttorneyExpertise expertise : expertiseList) {
            double matchScore = 0.0;
            
            // Check if expertise area matches case type
            if (isExpertiseMatchForCase(expertise.getExpertiseArea(), legalCase)) {
                // Base score from proficiency level
                matchScore = expertise.getProficiencyLevel().ordinal() * 25.0;
                
                // Bonus for experience
                if (expertise.getYearsExperience() > 5) {
                    matchScore += 10.0;
                }
                
                // Bonus for success rate
                if (expertise.getSuccessRate() != null && 
                    expertise.getSuccessRate().compareTo(new BigDecimal("80")) > 0) {
                    matchScore += 15.0;
                }
            }
            
            maxScore = Math.max(maxScore, matchScore);
        }
        
        return Math.min(maxScore, 100.0);
    }
    
    private double calculateWorkloadScore(User attorney) {
        UserWorkload workload = workloadRepository
            .findByUserIdAndCalculationDate(attorney.getId(), LocalDate.now())
            .orElse(null);
        
        if (workload == null) {
            return 100.0; // Full score if no workload data
        }
        
        BigDecimal capacity = workload.getCapacityPercentage();
        
        // Ideal range is 40-70% capacity
        if (capacity.compareTo(new BigDecimal("40")) >= 0 && 
            capacity.compareTo(IDEAL_WORKLOAD_THRESHOLD) <= 0) {
            return 100.0;
        }
        
        // Slightly over ideal (70-85%)
        if (capacity.compareTo(IDEAL_WORKLOAD_THRESHOLD) > 0 && 
            capacity.compareTo(MAX_WORKLOAD_THRESHOLD) <= 0) {
            return 100.0 - capacity.subtract(IDEAL_WORKLOAD_THRESHOLD).doubleValue();
        }
        
        // Under-utilized (< 40%)
        if (capacity.compareTo(new BigDecimal("40")) < 0) {
            return 80.0 + (capacity.doubleValue() / 2);
        }
        
        // Over capacity (> 85%)
        return Math.max(0.0, 30.0 - (capacity.doubleValue() - 85.0) * 2);
    }
    
    private double calculateClientExperienceScore(User attorney, LegalCase legalCase) {
        // Check if attorney has worked with this client before
        boolean hasWorkedWithClient = assignmentRepository
            .existsByUserIdAndClientEmail(attorney.getId(), legalCase.getClientEmail());
        
        if (hasWorkedWithClient) {
            // Get success metrics with this client
            // Simplified - real implementation would calculate actual metrics
            return 90.0;
        }
        
        return 50.0; // Neutral score for new client relationship
    }
    
    private double calculateSuccessRateScore(User attorney, LegalCase legalCase) {
        // Get attorney's overall success rate for similar cases
        // Simplified implementation
        List<AttorneyExpertise> relevantExpertise = expertiseRepository
            .findByUserIdOrderByProficiencyDesc(attorney.getId())
            .stream()
            .filter(exp -> isExpertiseMatchForCase(exp.getExpertiseArea(), legalCase))
            .collect(Collectors.toList());
        
        if (relevantExpertise.isEmpty()) {
            return 50.0; // Default neutral score
        }
        
        // Average success rate across relevant expertise areas
        BigDecimal totalSuccessRate = relevantExpertise.stream()
            .map(AttorneyExpertise::getSuccessRate)
            .filter(Objects::nonNull)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        
        if (totalSuccessRate.compareTo(BigDecimal.ZERO) == 0) {
            return 50.0;
        }
        
        BigDecimal avgSuccessRate = totalSuccessRate.divide(
            new BigDecimal(relevantExpertise.size()), 2, RoundingMode.HALF_UP);
        
        return avgSuccessRate.doubleValue();
    }
    
    private BigDecimal calculateCaseWorkloadWeight(LegalCase legalCase) {
        BigDecimal weight = BigDecimal.ONE;
        
        // Adjust for priority
        if (legalCase.getPriority() == CasePriority.URGENT) {
            weight = weight.multiply(new BigDecimal("2.0"));
        } else if (legalCase.getPriority() == CasePriority.HIGH) {
            weight = weight.multiply(new BigDecimal("1.5"));
        }
        
        // Adjust for complexity (would need complexity field in real implementation)
        // For now, use case type as proxy
        
        return weight;
    }
    
    private boolean isExpertiseMatchForCase(ExpertiseArea expertise, LegalCase legalCase) {
        // Simplified matching logic
        // Real implementation would have sophisticated mapping
        String caseType = legalCase.getType().toLowerCase();
        String expertiseArea = expertise.name().toLowerCase();
        
        return caseType.contains(expertiseArea) || expertiseArea.contains(caseType);
    }
    
    private List<String> identifyStrengths(User attorney, LegalCase legalCase) {
        List<String> strengths = new ArrayList<>();
        
        // Check expertise match
        List<AttorneyExpertise> expertise = expertiseRepository
            .findByUserIdOrderByProficiencyDesc(attorney.getId());
        
        for (AttorneyExpertise exp : expertise) {
            if (isExpertiseMatchForCase(exp.getExpertiseArea(), legalCase)) {
                strengths.add("Expert in " + exp.getExpertiseArea().name());
                break;
            }
        }
        
        // Check client history
        if (assignmentRepository.existsByUserIdAndClientEmail(attorney.getId(), 
            legalCase.getClientEmail())) {
            strengths.add("Previous experience with client");
        }
        
        // Check workload
        UserWorkload workload = workloadRepository
            .findByUserIdAndCalculationDate(attorney.getId(), LocalDate.now())
            .orElse(null);
        
        if (workload != null && workload.getCapacityPercentage().compareTo(new BigDecimal("60")) < 0) {
            strengths.add("Good availability");
        }
        
        return strengths;
    }
    
    private List<String> identifyConcerns(User attorney, LegalCase legalCase, BigDecimal currentWorkload) {
        List<String> concerns = new ArrayList<>();
        
        // Check workload
        if (currentWorkload.compareTo(new BigDecimal("75")) > 0) {
            concerns.add("High current workload (" + currentWorkload + "%)");
        }
        
        // Check overdue tasks
        UserWorkload workload = workloadRepository
            .findByUserIdAndCalculationDate(attorney.getId(), LocalDate.now())
            .orElse(null);
        
        if (workload != null && workload.getOverdueTasksCount() > 0) {
            concerns.add("Has " + workload.getOverdueTasksCount() + " overdue tasks");
        }
        
        // Check expertise gaps
        boolean hasRelevantExpertise = expertiseRepository
            .findByUserIdOrderByProficiencyDesc(attorney.getId())
            .stream()
            .anyMatch(exp -> isExpertiseMatchForCase(exp.getExpertiseArea(), legalCase));
        
        if (!hasRelevantExpertise) {
            concerns.add("Limited experience in this case type");
        }
        
        return concerns;
    }
    
    private String generateRecommendationReason(List<RecommendedUser> recommendedUsers, 
                                               LegalCase legalCase) {
        if (recommendedUsers.isEmpty()) {
            return "No suitable attorneys found based on current criteria";
        }
        
        RecommendedUser topChoice = recommendedUsers.get(0);
        StringBuilder reason = new StringBuilder();
        
        reason.append("Recommended ")
              .append(topChoice.getUser().getFirstName())
              .append(" ")
              .append(topChoice.getUser().getLastName())
              .append(" based on ");
        
        List<String> factors = new ArrayList<>();
        
        if (topChoice.getExpertiseMatch().compareTo(new BigDecimal("80")) > 0) {
            factors.add("strong expertise match");
        }
        
        if (topChoice.isHasPreviousClientExperience()) {
            factors.add("previous client experience");
        }
        
        if (topChoice.getCurrentWorkload().compareTo(new BigDecimal("60")) < 0) {
            factors.add("good availability");
        }
        
        reason.append(String.join(", ", factors));
        
        return reason.toString();
    }
}