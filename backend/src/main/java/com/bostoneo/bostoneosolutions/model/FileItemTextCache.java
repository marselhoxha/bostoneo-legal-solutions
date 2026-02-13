package com.bostoneo.bostoneosolutions.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "file_item_text_cache")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FileItemTextCache {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "file_item_id", nullable = false)
    private Long fileItemId;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "extracted_text", columnDefinition = "TEXT")
    private String extractedText;

    @Column(name = "extraction_status", nullable = false, length = 20)
    @Builder.Default
    private String extractionStatus = "pending";

    @Column(name = "error_message", length = 500)
    private String errorMessage;

    @Column(name = "char_count")
    @Builder.Default
    private Integer charCount = 0;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
