package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AIPatentPriorArt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface AIPatentPriorArtRepository extends JpaRepository<AIPatentPriorArt, Long> {

    // ==================== TENANT ISOLATION METHODS ====================

    /**
     * SECURITY: Get all prior art for an organization
     */
    List<AIPatentPriorArt> findByOrganizationId(Long organizationId);

    /**
     * SECURITY: Get prior art by ID with tenant verification
     */
    java.util.Optional<AIPatentPriorArt> findByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * SECURITY: Get prior art by application with tenant filter
     */
    List<AIPatentPriorArt> findByApplicationIdAndOrganizationIdOrderByRelevanceScoreDesc(Long applicationId, Long organizationId);

    // ==================== EXISTING METHODS (Use with caution) ====================

    List<AIPatentPriorArt> findByApplicationIdOrderByRelevanceScoreDesc(Long applicationId);
    
    List<AIPatentPriorArt> findByApplicationId(Long applicationId);
    
    List<AIPatentPriorArt> findByPatentNumberContaining(String patentNumber);
    
    List<AIPatentPriorArt> findByInventorNameContainingIgnoreCase(String inventorName);
    
    List<AIPatentPriorArt> findByTitleContainingIgnoreCase(String title);
}
