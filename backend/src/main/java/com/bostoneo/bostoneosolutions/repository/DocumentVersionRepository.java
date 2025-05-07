package com.***REMOVED***.***REMOVED***solutions.repository;

import com.***REMOVED***.***REMOVED***solutions.model.DocumentVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DocumentVersionRepository extends JpaRepository<DocumentVersion, Long> {
    
    List<DocumentVersion> findByDocumentIdOrderByVersionNumberDesc(Long documentId);
    
    Optional<DocumentVersion> findByDocumentIdAndVersionNumber(Long documentId, Integer versionNumber);
    
    @Query("SELECT MAX(v.versionNumber) FROM DocumentVersion v WHERE v.documentId = ?1")
    Integer findMaxVersionNumberByDocumentId(Long documentId);
} 
 
 
 