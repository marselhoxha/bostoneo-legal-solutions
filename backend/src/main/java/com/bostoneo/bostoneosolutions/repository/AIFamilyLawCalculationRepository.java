package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AIFamilyLawCalculation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface AIFamilyLawCalculationRepository extends JpaRepository<AIFamilyLawCalculation, Long> {
    List<AIFamilyLawCalculation> findByCaseIdOrderByCreatedAtDesc(Long caseId);
}