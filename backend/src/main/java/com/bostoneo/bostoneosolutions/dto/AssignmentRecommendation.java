package com.bostoneo.bostoneosolutions.dto;

import com.bostoneo.bostoneosolutions.model.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AssignmentRecommendation {
    private Long caseId;
    private List<RecommendedUser> recommendedUsers;
    private BigDecimal workloadWeight;
    private BigDecimal matchScore;
    private String recommendationReason;
    private Map<String, Object> analysisDetails;
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RecommendedUser {
        private User user;
        private BigDecimal score;
        private BigDecimal currentWorkload;
        private BigDecimal expertiseMatch;
        private boolean hasPreviousClientExperience;
        private List<String> strengths;
        private List<String> concerns;
    }
}