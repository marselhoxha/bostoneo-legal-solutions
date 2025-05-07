package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.LegalDocument;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LegalDocumentRepository extends JpaRepository<LegalDocument, Long> {
    List<LegalDocument> findByCaseId(Long caseId);
    Page<LegalDocument> findByCaseId(Long caseId, Pageable pageable);
} 
 
 