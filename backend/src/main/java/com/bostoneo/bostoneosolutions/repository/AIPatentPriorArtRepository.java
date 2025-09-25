package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AIPatentPriorArt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface AIPatentPriorArtRepository extends JpaRepository<AIPatentPriorArt, Long> {
    
    List<AIPatentPriorArt> findByApplicationIdOrderByRelevanceScoreDesc(Long applicationId);
    
    List<AIPatentPriorArt> findByApplicationId(Long applicationId);
    
    List<AIPatentPriorArt> findByPatentNumberContaining(String patentNumber);
    
    List<AIPatentPriorArt> findByInventorNameContainingIgnoreCase(String inventorName);
    
    List<AIPatentPriorArt> findByTitleContainingIgnoreCase(String title);
}
