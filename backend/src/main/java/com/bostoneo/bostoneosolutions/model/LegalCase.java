package com.bostoneo.bostoneosolutions.model;

import com.bostoneo.bostoneosolutions.enumeration.CasePriority;
import com.bostoneo.bostoneosolutions.enumeration.CaseStatus;
import com.bostoneo.bostoneosolutions.enumeration.PaymentStatus;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.util.Date;
import java.util.Collection;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;
import static jakarta.persistence.CascadeType.ALL;
import static jakarta.persistence.FetchType.EAGER;
import static jakarta.persistence.GenerationType.IDENTITY;

@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "legal_cases")
public class LegalCase {
    @Id
    @GeneratedValue(strategy = IDENTITY)
    @Column(name = "id", columnDefinition = "BIGINT UNSIGNED")
    private Long id;

    @Column(name = "organization_id", columnDefinition = "BIGINT UNSIGNED")
    private Long organizationId;

    @Column(name = "case_number", nullable = false, unique = true)
    private String caseNumber;

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "client_name", nullable = false)
    private String clientName;

    @Column(name = "client_email", nullable = false)
    private String clientEmail;
    
    @Column(name = "client_phone")
    private String clientPhone;
    
    @Column(name = "client_address")
    private String clientAddress;

    @Column(name = "status", nullable = false)
    @Enumerated(EnumType.STRING)
    private CaseStatus status;

    @Column(name = "priority")
    @Enumerated(EnumType.STRING)
    private CasePriority priority;

    @Column(name = "type")
    private String type;

    @Column(name = "description")
    @Lob
    private String description;

    // Court Information
    @Column(name = "county_name")
    private String countyName;
    
    @Column(name = "courtroom")
    private String courtroom;
    
    @Column(name = "judge_name")
    private String judgeName;

    // Important Dates
    @Column(name = "filing_date")
    @Temporal(TemporalType.DATE)
    private Date filingDate;

    @Column(name = "next_hearing")
    @Temporal(TemporalType.DATE)
    private Date nextHearing;

    @Column(name = "trial_date")
    @Temporal(TemporalType.DATE)
    private Date trialDate;

    @Column(name = "closed_date")
    @Temporal(TemporalType.DATE)
    private Date closedDate;

    // Billing Information
    @Column(name = "hourly_rate")
    private Double hourlyRate;
    
    @Column(name = "total_hours")
    private Double totalHours;
    
    @Column(name = "total_amount")
    private Double totalAmount;

    @Column(name = "payment_status")
    @Enumerated(EnumType.STRING)
    private PaymentStatus paymentStatus;

    @Column(name = "created_at", nullable = false)
    @Temporal(TemporalType.TIMESTAMP)
    private Date createdAt;

    @Column(name = "updated_at")
    @Temporal(TemporalType.TIMESTAMP)
    private Date updatedAt;

    @OneToMany(mappedBy = "legalCase", fetch = FetchType.LAZY)
    @JsonIgnoreProperties("legalCase")
    private Collection<Expense> expenses;

    // Timeline fields
    @Column(name = "current_timeline_phase")
    private Integer currentTimelinePhase;

    @Column(name = "timeline_initialized")
    private Boolean timelineInitialized;

    @PrePersist
    protected void onCreate() {
        createdAt = new Date();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = new Date();
    }
} 