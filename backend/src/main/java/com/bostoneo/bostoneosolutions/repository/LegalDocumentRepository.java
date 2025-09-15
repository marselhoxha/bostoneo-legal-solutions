package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.LegalDocument;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LegalDocumentRepository extends JpaRepository<LegalDocument, Long> {
    
    // Use native query to handle naming strategy issues
    @Query(value = "SELECT * FROM legaldocument WHERE caseId = :caseId ORDER BY updatedAt DESC", nativeQuery = true)
    List<LegalDocument> findByCaseId(@Param("caseId") Long caseId);
    
    @Query(value = "SELECT * FROM legaldocument WHERE caseId = :caseId ORDER BY updatedAt DESC", nativeQuery = true)
    Page<LegalDocument> findByCaseId(@Param("caseId") Long caseId, Pageable pageable);
} 
 
 