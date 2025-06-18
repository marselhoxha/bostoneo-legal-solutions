package com.***REMOVED***.***REMOVED***solutions.model;

import com.***REMOVED***.***REMOVED***solutions.enumeration.TimeEntryStatus;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Date;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;
import static jakarta.persistence.GenerationType.IDENTITY;

@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "time_entries")
@JsonIgnoreProperties(ignoreUnknown = true)
public class TimeEntry {
    @Id
    @GeneratedValue(strategy = IDENTITY)
    @Column(name = "id", columnDefinition = "BIGINT UNSIGNED")
    private Long id;

    @Column(name = "legal_case_id", nullable = false, columnDefinition = "BIGINT UNSIGNED")
    private Long legalCaseId;

    @Column(name = "user_id", nullable = false, columnDefinition = "BIGINT UNSIGNED")
    private Long userId;

    @Column(name = "date", nullable = false)
    private LocalDate date;

    @Column(name = "start_time")
    private LocalTime startTime;

    @Column(name = "end_time")
    private LocalTime endTime;

    @Column(name = "hours", nullable = false, precision = 4, scale = 2)
    private BigDecimal hours;

    @Column(name = "rate", nullable = false, precision = 10, scale = 2)
    private BigDecimal rate;

    @Column(name = "description", nullable = false, columnDefinition = "TEXT")
    private String description;

    @Column(name = "status", nullable = false)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private TimeEntryStatus status = TimeEntryStatus.DRAFT;

    @Column(name = "billable", nullable = false)
    @Builder.Default
    private Boolean billable = true;

    @Column(name = "invoice_id")
    private Long invoiceId;

    @Column(name = "billed_amount", precision = 10, scale = 2)
    private BigDecimal billedAmount;

    @Column(name = "created_at", nullable = false)
    @Temporal(TemporalType.TIMESTAMP)
    private Date createdAt;

    @Column(name = "updated_at")
    @Temporal(TemporalType.TIMESTAMP)
    private Date updatedAt;

    // Calculated fields - no entity relationships
    @Transient
    private BigDecimal totalAmount;

    @Transient
    private String caseName;

    @Transient
    private String caseNumber;

    @Transient
    private String userName;

    @Transient
    private String userEmail;

    public BigDecimal getTotalAmount() {
        if (hours != null && rate != null) {
            return hours.multiply(rate);
        }
        return BigDecimal.ZERO;
    }

    @PrePersist
    protected void onCreate() {
        createdAt = new Date();
        if (status == null) {
            status = TimeEntryStatus.DRAFT;
        }
        if (billable == null) {
            billable = true;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = new Date();
    }
} 
 
 
 
 
 
 