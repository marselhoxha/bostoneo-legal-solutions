package com.bostoneo.bostoneosolutions.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.List;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "research_session")
public class ResearchSession {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "session_id", nullable = false, unique = true)
    private String sessionId;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "session_name")
    private String sessionName;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @OneToMany(mappedBy = "sessionId", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<SearchHistory> searchQueries;

    @OneToMany(mappedBy = "sessionId", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<ResearchAnnotation> annotations;

    @Builder.Default
    @Column(name = "is_active")
    private Boolean isActive = true;

    @Column(name = "total_searches")
    private Integer totalSearches;

    @Column(name = "total_documents_viewed")
    private Integer totalDocumentsViewed;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "last_accessed")
    private LocalDateTime lastAccessed;

    @Column(name = "workflow_execution_id")
    private Long workflowExecutionId;
}