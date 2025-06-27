package com.***REMOVED***.***REMOVED***solutions.model;

import com.***REMOVED***.***REMOVED***solutions.enumeration.ExpertiseArea;
import com.***REMOVED***.***REMOVED***solutions.enumeration.ProficiencyLevel;
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
@Table(name = "attorney_expertise", 
       uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "expertise_area"}))
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
public class AttorneyExpertise {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private User attorney;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "expertise_area", nullable = false)
    private ExpertiseArea expertiseArea;
    
    @Enumerated(EnumType.STRING)
    @Column(name = "proficiency_level", nullable = false)
    private ProficiencyLevel proficiencyLevel;
    
    @Column(name = "years_experience")
    private Integer yearsExperience = 0;
    
    @Column(name = "cases_handled")
    private Integer casesHandled = 0;
    
    @Column(name = "success_rate", precision = 5, scale = 2)
    private BigDecimal successRate;
    
    @Column(name = "last_case_date")
    private LocalDate lastCaseDate;
    
    @Column(columnDefinition = "TEXT")
    private String certifications;
    
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
     * Calculate expertise score based on multiple factors
     */
    public BigDecimal calculateExpertiseScore() {
        BigDecimal baseScore = switch (proficiencyLevel) {
            case EXPERT -> new BigDecimal("90");
            case ADVANCED -> new BigDecimal("75");
            case INTERMEDIATE -> new BigDecimal("60");
            case BEGINNER -> new BigDecimal("40");
        };
        
        // Adjust for experience
        if (yearsExperience != null && yearsExperience > 5) {
            baseScore = baseScore.add(new BigDecimal("5"));
        }
        
        // Adjust for success rate
        if (successRate != null && successRate.compareTo(new BigDecimal("80")) > 0) {
            baseScore = baseScore.add(new BigDecimal("5"));
        }
        
        return baseScore.min(new BigDecimal("100"));
    }
}