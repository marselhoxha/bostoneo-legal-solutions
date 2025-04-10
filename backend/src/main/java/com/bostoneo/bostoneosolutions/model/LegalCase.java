package com.bostoneo.bostoneosolutions.model;

import com.bostoneo.bostoneosolutions.enumeration.CasePriority;
import com.bostoneo.bostoneosolutions.enumeration.CaseStatus;
import com.bostoneo.bostoneosolutions.enumeration.PaymentStatus;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

@Entity
@Table(name = "legal_cases")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class LegalCase {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String caseNumber;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private String clientName;

    private String clientEmail;
    private String clientPhone;
    private String clientAddress;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CaseStatus status;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CasePriority priority;

    @Column(nullable = false)
    private String type;

    @Column(columnDefinition = "LONGTEXT")
    private String description;

    // Court Information
    private String courtName;
    private String courtroom;
    private String judgeName;

    // Important Dates
    @Temporal(TemporalType.TIMESTAMP)
    private Date filingDate;

    @Temporal(TemporalType.TIMESTAMP)
    private Date nextHearing;

    @Temporal(TemporalType.TIMESTAMP)
    private Date trialDate;

    // Billing Information
    private Double hourlyRate;
    private Double totalHours;
    private Double totalAmount;

    @Enumerated(EnumType.STRING)
    private PaymentStatus paymentStatus;

    @Column(nullable = false)
    @Temporal(TemporalType.TIMESTAMP)
    private Date createdAt;

    @Temporal(TemporalType.TIMESTAMP)
    private Date updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = new Date();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = new Date();
    }
} 