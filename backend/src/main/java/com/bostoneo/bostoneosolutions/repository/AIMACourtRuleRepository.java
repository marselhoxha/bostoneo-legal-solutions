package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AIMACourtRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AIMACourtRuleRepository extends JpaRepository<AIMACourtRule, Long> {

    @Query("SELECT r FROM AIMACourtRule r WHERE LOWER(r.ruleTitle) LIKE LOWER(CONCAT('%', :title, '%'))")
    List<AIMACourtRule> findByRuleTitleContainingIgnoreCase(@Param("title") String title);

    @Query("SELECT r FROM AIMACourtRule r WHERE LOWER(r.ruleText) LIKE LOWER(CONCAT('%', :text, '%'))")
    List<AIMACourtRule> findByRuleTextContainingIgnoreCase(@Param("text") String text);

    List<AIMACourtRule> findByRuleNumber(String ruleNumber);

    List<AIMACourtRule> findByCourtLevel(String courtLevel);

    List<AIMACourtRule> findByRuleCategory(String category);

    List<AIMACourtRule> findByRuleNumberAndCourtLevel(String ruleNumber, String courtLevel);

    @Query("SELECT r FROM AIMACourtRule r WHERE " +
           "(LOWER(r.ruleTitle) LIKE LOWER(CONCAT('%', :term1, '%')) OR LOWER(r.ruleText) LIKE LOWER(CONCAT('%', :term1, '%'))) AND " +
           "(LOWER(r.ruleTitle) LIKE LOWER(CONCAT('%', :term2, '%')) OR LOWER(r.ruleText) LIKE LOWER(CONCAT('%', :term2, '%')))")
    List<AIMACourtRule> findByBothTerms(@Param("term1") String term1, @Param("term2") String term2);

    @Query("SELECT r FROM AIMACourtRule r WHERE " +
           "(LOWER(r.ruleTitle) LIKE LOWER(CONCAT('%', :term1, '%')) OR LOWER(r.ruleText) LIKE LOWER(CONCAT('%', :term1, '%'))) OR " +
           "(LOWER(r.ruleTitle) LIKE LOWER(CONCAT('%', :term2, '%')) OR LOWER(r.ruleText) LIKE LOWER(CONCAT('%', :term2, '%')))")
    List<AIMACourtRule> findByEitherTerm(@Param("term1") String term1, @Param("term2") String term2);

    @Query("SELECT r FROM AIMACourtRule r WHERE " +
           "(LOWER(r.ruleTitle) LIKE LOWER(CONCAT('%', :includeTerm, '%')) OR LOWER(r.ruleText) LIKE LOWER(CONCAT('%', :includeTerm, '%'))) AND " +
           "NOT (LOWER(r.ruleTitle) LIKE LOWER(CONCAT('%', :excludeTerm, '%')) OR LOWER(r.ruleText) LIKE LOWER(CONCAT('%', :excludeTerm, '%')))")
    List<AIMACourtRule> findWithTermButNotAnother(@Param("includeTerm") String includeTerm, @Param("excludeTerm") String excludeTerm);
}
