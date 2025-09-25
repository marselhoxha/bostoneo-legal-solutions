package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AIMASentencingGuideline;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AIMASentencingGuidelineRepository extends JpaRepository<AIMASentencingGuideline, Long> {

    @Query("SELECT g FROM AIMASentencingGuideline g WHERE LOWER(g.offenseDescription) LIKE LOWER(CONCAT('%', :description, '%'))")
    List<AIMASentencingGuideline> findByOffenseDescriptionContainingIgnoreCase(@Param("description") String description);

    List<AIMASentencingGuideline> findByCategory(String category);

    List<AIMASentencingGuideline> findBySubcategory(String subcategory);

    @Query("SELECT g FROM AIMASentencingGuideline g WHERE LOWER(g.eligibilityNotes) LIKE LOWER(CONCAT('%', :text, '%'))")
    List<AIMASentencingGuideline> findByEligibilityNotesContainingIgnoreCase(@Param("text") String text);
}