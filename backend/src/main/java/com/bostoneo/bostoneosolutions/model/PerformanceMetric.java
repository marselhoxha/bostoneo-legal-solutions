package com.***REMOVED***.***REMOVED***solutions.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;
import static jakarta.persistence.GenerationType.IDENTITY;

/**
 * Entity for storing performance metrics and KPIs
 * Used for dashboard analytics and reporting
 */
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "performance_metrics", indexes = {
    @Index(name = "idx_metrics_name_period", columnList = "metric_name, period_start, period_end"),
    @Index(name = "idx_metrics_category", columnList = "category"),
    @Index(name = "idx_metrics_created", columnList = "created_at")
})
public class PerformanceMetric {

    @Id
    @GeneratedValue(strategy = IDENTITY)
    @Column(name = "id", columnDefinition = "BIGINT UNSIGNED")
    private Long id;

    @Column(name = "metric_name", nullable = false, length = 100)
    private String metricName;

    @Column(name = "metric_value", nullable = false, precision = 15, scale = 4)
    private BigDecimal metricValue;

    @Column(name = "metric_unit", length = 20)
    private String metricUnit;

    @Enumerated(EnumType.STRING)
    @Column(name = "category", nullable = false, length = 50)
    private MetricCategory category;

    @Column(name = "period_start", nullable = false)
    private LocalDate periodStart;

    @Column(name = "period_end", nullable = false)
    private LocalDate periodEnd;

    @Column(name = "created_at")
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

    // Enum for metric categories
    public enum MetricCategory {
        FINANCIAL,           // Revenue, collection rate, profit margin
        CASE_MANAGEMENT,     // Success rate, resolution time, case load
        CLIENT_SATISFACTION, // Response time, satisfaction score, retention
        OPERATIONAL,         // System uptime, processing time, efficiency
        PRODUCTIVITY,        // Billable hours, utilization, task completion
        COMPLIANCE,          // Audit compliance, security metrics
        MARKETING,           // Lead generation, conversion rates
        HUMAN_RESOURCES      // Employee satisfaction, training completion
    }
} 
 
 
 
 
 
 