package com.bostoneo.bostoneosolutions.model;

import com.bostoneo.bostoneosolutions.enumeration.AssignmentType;
import com.bostoneo.bostoneosolutions.enumeration.CaseRoleType;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

@Entity
@Table(name = "case_assignments")
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
public class CaseAssignment {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "case_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private LegalCase legalCase;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private User assignedTo;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "role_type", nullable = false)
    private CaseRoleType roleType;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "assignment_type")
    @Builder.Default
    private AssignmentType assignmentType = AssignmentType.MANUAL;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_by")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private User assignedBy;
    
    @Column(name = "assigned_at")
    private LocalDateTime assignedAt;
    
    @Column(name = "effective_from", nullable = false)
    private LocalDate effectiveFrom;
    
    @Column(name = "effective_to")
    private LocalDate effectiveTo;
    
    @Column(name = "is_active")
    @Builder.Default
    private boolean active = true;
    
    @Column(name = "workload_weight", precision = 5, scale = 2)
    @Builder.Default
    private BigDecimal workloadWeight = BigDecimal.ONE;
    
    @Column(name = "expertise_match_score", precision = 5, scale = 2)
    private BigDecimal expertiseMatchScore;
    
    @Column(columnDefinition = "TEXT")
    private String notes;
    
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (assignedAt == null) {
            assignedAt = LocalDateTime.now();
        }
        if (effectiveFrom == null) {
            effectiveFrom = LocalDate.now();
        }
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
    
    /**
     * Check if this assignment is currently effective
     */
    public boolean isEffective() {
        LocalDate today = LocalDate.now();
        return active && 
               !effectiveFrom.isAfter(today) && 
               (effectiveTo == null || !effectiveTo.isBefore(today));
    }
    
    /**
     * Check if this assignment will be effective on a given date
     */
    public boolean isEffectiveOn(LocalDate date) {
        return active && 
               !effectiveFrom.isAfter(date) && 
               (effectiveTo == null || !effectiveTo.isBefore(date));
    }
}