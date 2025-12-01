package com.bostoneo.bostoneosolutions.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "ai_document_analysis")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class AIDocumentAnalysis {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "analysis_id", unique = true, nullable = false)
    private String analysisId;

    @Column(name = "file_name")
    private String fileName;

    @Column(name = "file_type")
    private String fileType;

    @Column(name = "file_size")
    private Long fileSize;

    @Column(name = "analysis_type", nullable = false)
    private String analysisType;

    @Column(name = "analysis_context")
    private String analysisContext;  // respond, negotiate, client_review, due_diligence, general

    @Column(name = "document_content", columnDefinition = "TEXT")
    private String documentContent;

    @Column(name = "analysis_result", columnDefinition = "TEXT")
    private String analysisResult;

    @Column(name = "summary", columnDefinition = "TEXT")
    private String summary;

    @Column(name = "risk_score")
    private Integer riskScore;

    @Column(name = "risk_level")
    private String riskLevel;

    @Column(name = "status")
    private String status;

    @Column(name = "error_message")
    private String errorMessage;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "case_id")
    private Long caseId;

    @Column(name = "processing_time_ms")
    private Long processingTimeMs;

    @Column(name = "tokens_used")
    private Integer tokensUsed;

    @Column(name = "cost_estimate")
    private Double costEstimate;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "is_archived", nullable = false)
    private Boolean isArchived = false;

    // Key findings as JSON
    @Column(name = "key_findings", columnDefinition = "TEXT")
    private String keyFindings;

    // Recommendations as JSON
    @Column(name = "recommendations", columnDefinition = "TEXT")
    private String recommendations;

    // Compliance issues as JSON
    @Column(name = "compliance_issues", columnDefinition = "TEXT")
    private String complianceIssues;

    // Document metadata as JSON
    @Column(name = "metadata", columnDefinition = "TEXT")
    private String metadata;

    // Detected document type (Complaint, Contract, Motion, etc.)
    @Column(name = "detected_type")
    private String detectedType;

    // Extracted metadata (parties, dates, case numbers)
    @Column(name = "extracted_metadata", columnDefinition = "TEXT")
    private String extractedMetadata;

    // OCR required flag
    @Column(name = "requires_ocr")
    private Boolean requiresOcr = false;
}