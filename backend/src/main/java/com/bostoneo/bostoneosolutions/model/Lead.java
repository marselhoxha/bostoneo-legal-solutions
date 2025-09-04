package com.***REMOVED***.***REMOVED***solutions.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;
import java.sql.Timestamp;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;
import static jakarta.persistence.GenerationType.IDENTITY;

@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "leads")
public class Lead {

    @Id
    @GeneratedValue(strategy = IDENTITY)
    @Column(name = "id", columnDefinition = "BIGINT UNSIGNED")
    private Long id;

    @Column(name = "first_name", nullable = false, length = 100)
    private String firstName;

    @Column(name = "last_name", nullable = false, length = 100)
    private String lastName;

    @Column(name = "email", nullable = false, unique = true, length = 100)
    private String email;

    @Column(name = "phone", length = 30)
    private String phone;

    @Column(name = "company", length = 100)
    private String company;

    @Column(name = "source", length = 50)
    private String source = "WEBSITE";

    @Column(name = "status", length = 50)
    private String status = "NEW";

    @Column(name = "priority", length = 20)
    private String priority = "MEDIUM";

    @Column(name = "assigned_to", columnDefinition = "BIGINT UNSIGNED")
    private Long assignedTo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_to", insertable = false, updatable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private User assignedUser;

    @Column(name = "lead_score")
    private Integer leadScore = 0;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "initial_inquiry", columnDefinition = "TEXT")
    private String initialInquiry;

    @Column(name = "estimated_case_value", precision = 10, scale = 2)
    private BigDecimal estimatedCaseValue;

    @Column(name = "practice_area", length = 100)
    private String practiceArea;

    @Column(name = "referral_source", length = 100)
    private String referralSource;

    @Column(name = "marketing_campaign", length = 100)
    private String marketingCampaign;

    @Column(name = "consultation_date")
    private Timestamp consultationDate;

    @Column(name = "follow_up_date")
    private Timestamp followUpDate;

    @Column(name = "lost_reason")
    private String lostReason;

    @Column(name = "case_type", length = 100)
    private String caseType;

    @Column(name = "urgency_level", length = 20)
    private String urgencyLevel = "MEDIUM";

    @Column(name = "lead_quality", length = 20)
    private String leadQuality = "UNKNOWN";

    @Column(name = "referral_quality_score")
    private Integer referralQualityScore = 0;

    @Column(name = "client_budget_range", length = 50)
    private String clientBudgetRange;

    @Column(name = "competitor_firms", columnDefinition = "JSON")
    private String competitorFirms;

    @Column(name = "geographic_location", length = 100)
    private String geographicLocation;

    @Column(name = "communication_preference", length = 20)
    private String communicationPreference = "EMAIL";

    @Column(name = "best_contact_time", length = 50)
    private String bestContactTime;

    @Column(name = "case_complexity", length = 20)
    private String caseComplexity = "MEDIUM";

    @Column(name = "created_at")
    private Timestamp createdAt;

    @Column(name = "updated_at")
    private Timestamp updatedAt;

    @Column(name = "converted_at")
    private Timestamp convertedAt;

    @PrePersist
    protected void onCreate() {
        Timestamp now = new Timestamp(System.currentTimeMillis());
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = new Timestamp(System.currentTimeMillis());
    }

    public String getFullName() {
        return firstName + " " + lastName;
    }
}