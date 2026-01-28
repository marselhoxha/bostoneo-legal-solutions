package com.bostoneo.bostoneosolutions.model;

import com.bostoneo.bostoneosolutions.enumeration.RuleType;
import com.fasterxml.jackson.annotation.JsonInclude;
import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.Type;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

@Entity
@Table(name = "assignment_rules")
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
public class AssignmentRule {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id")
    private Long organizationId;

    @Column(name = "rule_name", nullable = false, length = 100)
    private String ruleName;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "rule_type", nullable = false)
    private RuleType ruleType;
    
    @Column(name = "case_type", length = 50)
    private String caseType;
    
    @Column(name = "priority_order")
    private Integer priorityOrder = 0;
    
    @Column(name = "is_active")
    private boolean active = true;
    
    @Column(name = "max_workload_percentage", precision = 5, scale = 2)
    private BigDecimal maxWorkloadPercentage = new BigDecimal("80.00");
    
    @Column(name = "min_expertise_score", precision = 5, scale = 2)
    private BigDecimal minExpertiseScore = new BigDecimal("60.00");
    
    @Column(name = "prefer_previous_attorney")
    private boolean preferPreviousAttorney = true;
    
    @Type(JsonType.class)
    @Column(name = "rule_conditions", columnDefinition = "TEXT")
    private Map<String, Object> ruleConditions = new HashMap<>();
    
    @Type(JsonType.class)
    @Column(name = "rule_actions", columnDefinition = "TEXT")
    private Map<String, Object> ruleActions = new HashMap<>();
    
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
     * Add a condition to the rule
     */
    public void addCondition(String key, Object value) {
        if (ruleConditions == null) {
            ruleConditions = new HashMap<>();
        }
        ruleConditions.put(key, value);
    }
    
    /**
     * Add an action to the rule
     */
    public void addAction(String key, Object value) {
        if (ruleActions == null) {
            ruleActions = new HashMap<>();
        }
        ruleActions.put(key, value);
    }
    
    /**
     * Check if rule applies to a specific case type
     */
    public boolean appliesTo(String caseType) {
        return this.caseType == null || 
               this.caseType.isEmpty() || 
               this.caseType.equalsIgnoreCase(caseType);
    }
}