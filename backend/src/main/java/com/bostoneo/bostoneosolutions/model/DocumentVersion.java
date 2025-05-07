package com.***REMOVED***.***REMOVED***solutions.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "documentversion")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class DocumentVersion {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private Long documentId;
    
    @Column(nullable = false)
    private Integer versionNumber;
    
    @Column(nullable = false)
    private String fileName;
    
    @Column(nullable = false)
    private String fileUrl;
    
    private String changes;
    
    @CreationTimestamp
    private LocalDateTime uploadedAt;
    
    private Long uploadedBy;
    
    private String fileType;
    
    private Long fileSize;
} 
 
 