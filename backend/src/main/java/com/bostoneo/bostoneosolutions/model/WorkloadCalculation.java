package com.bostoneo.bostoneosolutions.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.hypersistence.utils.hibernate.type.json.JsonType;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.Type;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

@Entity
@Table(name = "workload_calculations")
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
public class WorkloadCalculation {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(name = "user_id", nullable = false)
    private Long userId;
    
    @Column(name = "calculation_date", nullable = false)
    private LocalDate calculationDate;
    
    @Type(JsonType.class)
    @Column(name = "case_points", columnDefinition = "jsonb")
    @Builder.Default
    private Map<Long, BigDecimal> casePoints = new HashMap<>();
    
    @Column(name = "total_points", nullable = false, precision = 10, scale = 2)
    private BigDecimal totalPoints;
    
    @Type(JsonType.class)
    @Column(columnDefinition = "jsonb")
    @Builder.Default
    private Map<String, Object> factors = new HashMap<>();
    
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (calculationDate == null) {
            calculationDate = LocalDate.now();
        }
    }
    
    /**
     * Add case points to the calculation
     */
    public void addCasePoints(Long caseId, BigDecimal points) {
        if (casePoints == null) {
            casePoints = new HashMap<>();
        }
        casePoints.put(caseId, points);
    }
    
    /**
     * Add a calculation factor
     */
    public void addFactor(String key, Object value) {
        if (factors == null) {
            factors = new HashMap<>();
        }
        factors.put(key, value);
    }
}