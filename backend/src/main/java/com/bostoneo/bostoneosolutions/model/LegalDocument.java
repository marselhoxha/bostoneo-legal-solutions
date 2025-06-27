package com.***REMOVED***.***REMOVED***solutions.model;

import com.***REMOVED***.***REMOVED***solutions.enumeration.DocumentCategory;
import com.***REMOVED***.***REMOVED***solutions.enumeration.DocumentStatus;
import com.***REMOVED***.***REMOVED***solutions.enumeration.DocumentType;
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
@Table(name = "legaldocument")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class LegalDocument {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private String title;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DocumentType type;
    
    @Enumerated(EnumType.STRING)
    @Column
    private DocumentCategory category;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DocumentStatus status;
    
    @Column(name = "caseId")
    private Long caseId;
    
    @Column(length = 1000)
    private String description;
    
    @Column(nullable = false)
    private String url;
    
    @ElementCollection
    private List<String> tags = new ArrayList<>();
    
    @CreationTimestamp
    @Column(name = "uploadedAt")
    private LocalDateTime uploadedAt;
    
    @UpdateTimestamp
    @Column(name = "updatedAt")
    private LocalDateTime updatedAt;
    
    @Column(name = "fileName", nullable = false)
    private String fileName;
    
    @Column(name = "fileType")
    private String fileType;
    
    @Column(name = "fileSize")
    private Long fileSize;
    
    @Column(name = "uploadedBy")
    private Long uploadedBy;
} 


 
 