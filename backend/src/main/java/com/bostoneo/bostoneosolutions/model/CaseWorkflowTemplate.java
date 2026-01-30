package com.bostoneo.bostoneosolutions.model;

import com.bostoneo.bostoneosolutions.enumeration.WorkflowTemplateType;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Type;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

@Entity
@Table(name = "case_workflow_templates")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
public class CaseWorkflowTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "template_type", nullable = false)
    private WorkflowTemplateType templateType;

    @Type(JsonType.class)
    @Column(name = "steps_config", columnDefinition = "TEXT", nullable = false)
    private Map<String, Object> stepsConfig;

    @Column(name = "is_system")
    @Builder.Default
    private Boolean isSystem = false;

    @Column(name = "organization_id")
    private Long organizationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private User createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    /**
     * Determines if this workflow template requires documents to produce quality output.
     * Step types DISPLAY, SYNTHESIS, GENERATION, and INTEGRATION need document input.
     * Step types ACTION, TASK_CREATION, and CASE_UPDATE work without documents.
     *
     * @return true if the template has steps that need document input
     */
    @SuppressWarnings("unchecked")
    public boolean requiresDocuments() {
        if (stepsConfig == null) return false;

        Object stepsObj = stepsConfig.get("steps");
        if (!(stepsObj instanceof List)) return false;

        List<Map<String, Object>> steps = (List<Map<String, Object>>) stepsObj;

        // Step types that require documents to produce quality output
        Set<String> documentRequiringTypes = Set.of(
                "DISPLAY", "SYNTHESIS", "GENERATION", "INTEGRATION"
        );

        return steps.stream()
                .map(step -> {
                    Object type = step.get("type");
                    return type != null ? type.toString().toUpperCase() : "";
                })
                .anyMatch(documentRequiringTypes::contains);
    }
}
