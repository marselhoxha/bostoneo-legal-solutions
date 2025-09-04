package com.***REMOVED***.***REMOVED***solutions.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.sql.Timestamp;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;
import static jakarta.persistence.GenerationType.IDENTITY;

@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "pipeline_stages")
public class PipelineStage {

    @Id
    @GeneratedValue(strategy = IDENTITY)
    @Column(name = "id", columnDefinition = "BIGINT UNSIGNED")
    private Long id;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "stage_order", nullable = false, unique = true)
    private Integer stageOrder;

    @Column(name = "is_active")
    private Boolean isActive = true;

    @Column(name = "color", length = 7)
    private String color = "#007bff";

    @Column(name = "icon", length = 50)
    private String icon = "ri-circle-line";

    @Column(name = "is_initial")
    private Boolean isInitial = false;

    @Column(name = "is_final")
    private Boolean isFinal = false;

    @Column(name = "auto_actions", columnDefinition = "JSON")
    private String autoActions;

    @Column(name = "required_fields", columnDefinition = "JSON")
    private String requiredFields;

    @Column(name = "estimated_days")
    private Integer estimatedDays = 7;

    @Column(name = "created_at")
    private Timestamp createdAt;

    @Column(name = "updated_at")
    private Timestamp updatedAt;

    @PrePersist
    protected void onCreate() {
        Timestamp now = new Timestamp(System.currentTimeMillis());
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = new Timestamp(System.currentTimeMillis());
    }
}