package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AIStyleGuide;
import com.bostoneo.bostoneosolutions.enumeration.CitationStyle;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AIStyleGuideRepository extends JpaRepository<AIStyleGuide, Long> {
    
    List<AIStyleGuide> findByCreatedByAndIsActiveTrue(Long userId);
    
    List<AIStyleGuide> findByFirmIdAndIsActiveTrue(Long firmId);
    
    List<AIStyleGuide> findByFirmId(Long firmId);
    
    List<AIStyleGuide> findByCreatedBy(Long userId);
    
    List<AIStyleGuide> findByIsActiveTrue();
    
    Optional<AIStyleGuide> findByFirmIdAndIsDefaultTrueAndIsActiveTrue(Long firmId);
    
    List<AIStyleGuide> findByCitationStyle(CitationStyle citationStyle);
    
    List<AIStyleGuide> findByNameContainingIgnoreCase(String name);
    
    @Query("SELECT sg FROM AIStyleGuide sg WHERE sg.firmId = :firmId AND sg.isActive = true ORDER BY sg.isDefault DESC, sg.createdAt DESC")
    List<AIStyleGuide> findByFirmIdOrderedByDefaultFirst(@Param("firmId") Long firmId);
    
    @Query("SELECT sg FROM AIStyleGuide sg WHERE (sg.createdBy = :userId OR sg.firmId = :firmId) AND sg.isActive = true")
    List<AIStyleGuide> findAccessibleStyleGuides(@Param("userId") Long userId, @Param("firmId") Long firmId);
    
    @Query("SELECT COUNT(sg) FROM AIStyleGuide sg WHERE sg.firmId = :firmId AND sg.isDefault = true AND sg.isActive = true")
    Long countDefaultStyleGuidesByFirm(@Param("firmId") Long firmId);
}