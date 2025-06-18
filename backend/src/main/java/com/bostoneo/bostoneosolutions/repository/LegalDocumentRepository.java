package com.***REMOVED***.***REMOVED***solutions.repository;

import com.***REMOVED***.***REMOVED***solutions.model.LegalDocument;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LegalDocumentRepository extends JpaRepository<LegalDocument, Long> {
    
    // Explicit queries to handle any naming strategy issues
    @Query("SELECT ld FROM LegalDocument ld WHERE ld.caseId = :caseId ORDER BY ld.updatedAt DESC")
    List<LegalDocument> findByCaseId(@Param("caseId") Long caseId);
    
    @Query("SELECT ld FROM LegalDocument ld WHERE ld.caseId = :caseId ORDER BY ld.updatedAt DESC")
    Page<LegalDocument> findByCaseId(@Param("caseId") Long caseId, Pageable pageable);
} 
 
 