package com.***REMOVED***.***REMOVED***solutions.repository;

import com.***REMOVED***.***REMOVED***solutions.enumeration.CaseStatus;
import com.***REMOVED***.***REMOVED***solutions.model.LegalCase;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.ListCrudRepository;
import org.springframework.data.repository.PagingAndSortingRepository;

import java.util.List;
import java.util.Optional;

public interface LegalCaseRepository extends PagingAndSortingRepository<LegalCase, Long>, ListCrudRepository<LegalCase, Long> {
    Optional<LegalCase> findByCaseNumber(String caseNumber);
    
    Page<LegalCase> findByTitleContainingIgnoreCase(String title, Pageable pageable);
    
    Page<LegalCase> findByClientNameContainingIgnoreCase(String clientName, Pageable pageable);
    
    Page<LegalCase> findByStatus(CaseStatus status, Pageable pageable);
    
    List<LegalCase> findByStatus(CaseStatus status);
    
    Page<LegalCase> findByType(String type, Pageable pageable);
} 