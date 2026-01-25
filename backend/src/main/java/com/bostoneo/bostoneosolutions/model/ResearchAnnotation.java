package com.bostoneo.bostoneosolutions.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "research_annotation")
public class ResearchAnnotation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "session_id")
    private String sessionId;

    @Column(name = "document_id")
    private Long documentId;

    @Column(name = "document_type")
    private String documentType; // "statute", "court_rule", "case", etc.

    @Column(name = "document_title", columnDefinition = "TEXT")
    private String documentTitle;

    @Column(name = "annotation_text", nullable = false, columnDefinition = "TEXT")
    private String annotationText;

    @Column(name = "highlighted_text", columnDefinition = "TEXT")
    private String highlightedText;

    @Column(name = "annotation_type")
    private String annotationType; // "note", "highlight", "bookmark", etc.

    @Column(name = "page_number")
    private Integer pageNumber;

    @Column(name = "position_data", columnDefinition = "jsonb")
    private String positionData; // For storing highlight position coordinates

    @Builder.Default
    @Column(name = "is_private")
    private Boolean isPrivate = true;

    @Column(name = "color")
    private String color; // For highlight colors

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}