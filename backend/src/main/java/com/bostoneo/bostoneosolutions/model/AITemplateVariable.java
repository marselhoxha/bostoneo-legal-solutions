package com.bostoneo.bostoneosolutions.model;

import com.bostoneo.bostoneosolutions.enumeration.VariableType;
import com.bostoneo.bostoneosolutions.enumeration.DataSource;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "ai_template_variables")
public class AITemplateVariable {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "template_id", nullable = false)
    private Long templateId;

    @Column(name = "variable_name", nullable = false, length = 100)
    private String variableName;

    @Column(name = "display_name", length = 150)
    private String displayName;

    @Enumerated(EnumType.STRING)
    @Column(name = "variable_type", nullable = false)
    private VariableType variableType;

    @Enumerated(EnumType.STRING)
    @Column(name = "data_source", nullable = false)
    private DataSource dataSource;

    @Column(name = "source_field", length = 100)
    private String sourceField;

    @Column(name = "validation_rules", columnDefinition = "jsonb")
    private String validationRules;

    @Column(name = "default_value", columnDefinition = "TEXT")
    private String defaultValue;

    @Builder.Default
    @Column(name = "is_required")
    private Boolean isRequired = false;

    @Builder.Default
    @Column(name = "is_computed")
    private Boolean isComputed = false;

    @Column(name = "computation_formula", columnDefinition = "TEXT")
    private String computationFormula;

    @Builder.Default
    @Column(name = "display_order")
    private Integer displayOrder = 0;

    @Column(name = "help_text", columnDefinition = "TEXT")
    private String helpText;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;
}