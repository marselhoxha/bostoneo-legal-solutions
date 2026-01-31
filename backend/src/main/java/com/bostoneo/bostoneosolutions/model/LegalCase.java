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
    @Column(name = "id")
    private Long id;

    @Column(name = "organization_id")
    private Long organizationId;

    @Column(name = "client_id")
    private Long clientId;

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

    @Column(name = "is_confidential")
    private Boolean isConfidential;

    @Column(name = "priority")
    @Enumerated(EnumType.STRING)
    private CasePriority priority;

    @Column(name = "type")
    private String type;

    @Column(name = "description", columnDefinition = "TEXT")
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

    // ============================================
    // Personal Injury (PI) Specific Fields
    // ============================================

    // Injury Information
    @Column(name = "injury_date")
    @Temporal(TemporalType.DATE)
    private Date injuryDate;

    @Column(name = "injury_type")
    private String injuryType;

    @Column(name = "injury_description", columnDefinition = "TEXT")
    private String injuryDescription;

    @Column(name = "accident_location")
    private String accidentLocation;

    @Column(name = "liability_assessment")
    private String liabilityAssessment;

    @Column(name = "comparative_negligence_percent")
    private Integer comparativeNegligencePercent;

    // Medical Providers (JSONB)
    @Column(name = "medical_providers", columnDefinition = "jsonb")
    private String medicalProviders;

    // Financial Damages
    @Column(name = "medical_expenses_total")
    private Double medicalExpensesTotal;

    @Column(name = "lost_wages")
    private Double lostWages;

    @Column(name = "future_medical_estimate")
    private Double futureMedicalEstimate;

    @Column(name = "pain_suffering_multiplier")
    private Double painSufferingMultiplier;

    // Settlement Information
    @Column(name = "settlement_demand_amount")
    private Double settlementDemandAmount;

    @Column(name = "settlement_offer_amount")
    private Double settlementOfferAmount;

    @Column(name = "settlement_final_amount")
    private Double settlementFinalAmount;

    @Column(name = "settlement_date")
    @Temporal(TemporalType.DATE)
    private Date settlementDate;

    // Insurance Information
    @Column(name = "insurance_company")
    private String insuranceCompany;

    @Column(name = "insurance_policy_number")
    private String insurancePolicyNumber;

    @Column(name = "insurance_policy_limit")
    private Double insurancePolicyLimit;

    @Column(name = "insurance_adjuster_name")
    private String insuranceAdjusterName;

    @Column(name = "insurance_adjuster_contact")
    private String insuranceAdjusterContact;

    // Defendant Information
    @Column(name = "defendant_name")
    private String defendantName;

    @Column(name = "defendant_address", columnDefinition = "TEXT")
    private String defendantAddress;

    @PrePersist
    protected void onCreate() {
        createdAt = new Date();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = new Date();
    }
} 