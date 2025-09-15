package com.bostoneo.bostoneosolutions.algorithm;

import com.bostoneo.bostoneosolutions.dto.AssignmentRecommendation;
import com.bostoneo.bostoneosolutions.model.LegalCase;
import com.bostoneo.bostoneosolutions.model.User;

import java.util.List;

public interface SmartAssignmentAlgorithm {
    
    /**
     * Recommend the best attorney(s) for a case based on expertise, workload, and other factors
     */
    AssignmentRecommendation recommendAssignment(LegalCase legalCase);
    
    /**
     * Find suitable attorneys for a specific case
     */
    List<User> findSuitableAttorneys(LegalCase legalCase, int maxResults);
    
    /**
     * Calculate match score between an attorney and a case
     */
    double calculateMatchScore(User attorney, LegalCase legalCase);
    
    /**
     * Validate if an attorney can take on a new case
     */
    boolean canTakeCase(User attorney, LegalCase legalCase);
}