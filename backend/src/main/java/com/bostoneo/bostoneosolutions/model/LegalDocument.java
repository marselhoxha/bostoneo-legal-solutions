package com.bostoneo.bostoneosolutions.model;

import com.bostoneo.bostoneosolutions.enumeration.DocumentCategory;
import com.bostoneo.bostoneosolutions.enumeration.DocumentStatus;
import com.bostoneo.bostoneosolutions.enumeration.DocumentType;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "documents")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class LegalDocument {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(nullable = false)
    private String title;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "document_type", nullable = false)
    private DocumentType type;

    @Enumerated(EnumType.STRING)
    @Column(name = "document_category")
    private DocumentCategory category;

    @Transient // Not persisted in database - computed field
    private DocumentStatus status;
    
    @Column(name = "case_id")
    private Long caseId;

    @Column(length = 1000)
    private String description;

    @Column(name = "file_path", nullable = false)
    private String url;

    @ElementCollection
    @CollectionTable(name = "LegalDocument_tags", joinColumns = @JoinColumn(name = "legal_document_id"))
    @Column(name = "tags")
    private List<String> tags = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "uploaded_at")
    private LocalDateTime uploadedAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "file_name", nullable = false)
    private String fileName;

    @Column(name = "mime_type")
    private String fileType;

    @Column(name = "file_size")
    private Long fileSize;

    @Column(name = "uploaded_by")
    private Long uploadedBy;
} 


 
 