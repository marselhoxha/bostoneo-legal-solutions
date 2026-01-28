package com.bostoneo.bostoneosolutions.model;

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
@Table(name = "user_workload", 
       uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "calculation_date"}))
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
public class UserWorkload {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private User user;

    @Column(name = "organization_id")
    private Long organizationId;

    @Column(name = "calculation_date", nullable = false)
    private LocalDate calculationDate;
    
    @Column(name = "active_cases_count")
    private Integer activeCasesCount = 0;
    
    @Column(name = "total_workload_points", precision = 10, scale = 2)
    private BigDecimal totalWorkloadPoints = BigDecimal.ZERO;
    
    @Column(name = "capacity_percentage", precision = 5, scale = 2)
    private BigDecimal capacityPercentage = BigDecimal.ZERO;
    
    @Column(name = "max_capacity_points", precision = 10, scale = 2)
    private BigDecimal maxCapacityPoints = new BigDecimal("40.00");
    
    @Column(name = "billable_hours_week", precision = 5, scale = 2)
    private BigDecimal billableHoursWeek = BigDecimal.ZERO;
    
    @Column(name = "non_billable_hours_week", precision = 5, scale = 2)
    private BigDecimal nonBillableHoursWeek = BigDecimal.ZERO;
    
    @Column(name = "average_response_time_hours", precision = 5, scale = 2)
    private BigDecimal averageResponseTimeHours;
    
    @Column(name = "overdue_tasks_count")
    private Integer overdueTasksCount = 0;
    
    @Column(name = "upcoming_deadlines_count")
    private Integer upcomingDeadlinesCount = 0;
    
    @Column(name = "last_calculated_at")
    private LocalDateTime lastCalculatedAt;
    
    @PrePersist
    @PreUpdate
    protected void onUpdate() {
        lastCalculatedAt = LocalDateTime.now();
        if (calculationDate == null) {
            calculationDate = LocalDate.now();
        }
    }
    
    /**
     * Get workload status based on capacity percentage
     */
    public WorkloadStatus getWorkloadStatus() {
        if (capacityPercentage == null) return WorkloadStatus.LOW;
        
        int percentage = capacityPercentage.intValue();
        if (percentage >= 90) return WorkloadStatus.OVERLOADED;
        if (percentage >= 70) return WorkloadStatus.HIGH;
        if (percentage >= 50) return WorkloadStatus.MEDIUM;
        return WorkloadStatus.LOW;
    }
    
    /**
     * Calculate available capacity
     */
    public BigDecimal getAvailableCapacity() {
        if (maxCapacityPoints == null || totalWorkloadPoints == null) {
            return BigDecimal.ZERO;
        }
        return maxCapacityPoints.subtract(totalWorkloadPoints).max(BigDecimal.ZERO);
    }
    
    public enum WorkloadStatus {
        LOW("Low", "green"),
        MEDIUM("Medium", "yellow"),
        HIGH("High", "orange"),
        OVERLOADED("Overloaded", "red");
        
        private final String displayName;
        private final String colorCode;
        
        WorkloadStatus(String displayName, String colorCode) {
            this.displayName = displayName;
            this.colorCode = colorCode;
        }
        
        public String getDisplayName() {
            return displayName;
        }
        
        public String getColorCode() {
            return colorCode;
        }
    }
}