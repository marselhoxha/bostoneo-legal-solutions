package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AIMAStatute;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AIMAStatuteRepository extends JpaRepository<AIMAStatute, Long> {

    @Query("SELECT s FROM AIMAStatute s WHERE LOWER(s.title) LIKE LOWER(CONCAT('%', :title, '%'))")
    List<AIMAStatute> findByTitleContainingIgnoreCase(@Param("title") String title);

    @Query("SELECT s FROM AIMAStatute s WHERE LOWER(s.statuteText) LIKE LOWER(CONCAT('%', :text, '%'))")
    List<AIMAStatute> findByStatuteTextContainingIgnoreCase(@Param("text") String text);

    List<AIMAStatute> findByChapterAndSection(String chapter, String section);

    List<AIMAStatute> findByPracticeArea(String practiceArea);

    List<AIMAStatute> findByChapter(String chapter);

    @Query("SELECT s FROM AIMAStatute s WHERE " +
           "(LOWER(s.title) LIKE LOWER(CONCAT('%', :term1, '%')) OR LOWER(s.statuteText) LIKE LOWER(CONCAT('%', :term1, '%'))) AND " +
           "(LOWER(s.title) LIKE LOWER(CONCAT('%', :term2, '%')) OR LOWER(s.statuteText) LIKE LOWER(CONCAT('%', :term2, '%')))")
    List<AIMAStatute> findByBothTerms(@Param("term1") String term1, @Param("term2") String term2);

    @Query("SELECT s FROM AIMAStatute s WHERE " +
           "(LOWER(s.title) LIKE LOWER(CONCAT('%', :term1, '%')) OR LOWER(s.statuteText) LIKE LOWER(CONCAT('%', :term1, '%'))) OR " +
           "(LOWER(s.title) LIKE LOWER(CONCAT('%', :term2, '%')) OR LOWER(s.statuteText) LIKE LOWER(CONCAT('%', :term2, '%')))")
    List<AIMAStatute> findByEitherTerm(@Param("term1") String term1, @Param("term2") String term2);

    @Query("SELECT s FROM AIMAStatute s WHERE " +
           "(LOWER(s.title) LIKE LOWER(CONCAT('%', :includeTerm, '%')) OR LOWER(s.statuteText) LIKE LOWER(CONCAT('%', :includeTerm, '%'))) AND " +
           "NOT (LOWER(s.title) LIKE LOWER(CONCAT('%', :excludeTerm, '%')) OR LOWER(s.statuteText) LIKE LOWER(CONCAT('%', :excludeTerm, '%')))")
    List<AIMAStatute> findWithTermButNotAnother(@Param("includeTerm") String includeTerm, @Param("excludeTerm") String excludeTerm);

    // Date-based filtering methods
    @Query("SELECT s FROM AIMAStatute s WHERE s.effectiveDate >= :startDate AND s.effectiveDate <= :endDate")
    List<AIMAStatute> findByEffectiveDateBetween(@Param("startDate") java.time.LocalDate startDate, @Param("endDate") java.time.LocalDate endDate);

    @Query("SELECT s FROM AIMAStatute s WHERE s.practiceArea IN :practiceAreas")
    List<AIMAStatute> findByPracticeAreaIn(@Param("practiceAreas") List<String> practiceAreas);

    @Query("SELECT s FROM AIMAStatute s WHERE " +
           "(LOWER(s.title) LIKE LOWER(CONCAT('%', :query, '%')) OR LOWER(s.statuteText) LIKE LOWER(CONCAT('%', :query, '%'))) AND " +
           "s.effectiveDate >= :startDate AND s.effectiveDate <= :endDate AND " +
           "s.practiceArea IN :practiceAreas")
    List<AIMAStatute> findByQueryAndDateRangeAndPracticeAreas(@Param("query") String query,
                                                              @Param("startDate") java.time.LocalDate startDate,
                                                              @Param("endDate") java.time.LocalDate endDate,
                                                              @Param("practiceAreas") List<String> practiceAreas);

    @Query("SELECT DISTINCT s.practiceArea FROM AIMAStatute s WHERE s.practiceArea IS NOT NULL ORDER BY s.practiceArea")
    List<String> findDistinctPracticeAreas();
}
