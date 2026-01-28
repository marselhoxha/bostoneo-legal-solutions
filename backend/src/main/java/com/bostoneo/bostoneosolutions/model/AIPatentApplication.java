package com.bostoneo.bostoneosolutions.model;

import com.bostoneo.bostoneosolutions.enumeration.PatentType;
import com.bostoneo.bostoneosolutions.enumeration.PatentStatus;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "ai_patent_applications")
public class AIPatentApplication {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id")
    private Long organizationId;

    @Column(name = "client_id", nullable = false)
    private Long clientId;

    @Column(name = "application_number", unique = true, length = 50)
    private String applicationNumber;

    @Column(name = "title", nullable = false, length = 500)
    private String title;

    @Column(name = "abstract", columnDefinition = "TEXT")
    private String abstractText;

    @Enumerated(EnumType.STRING)
    @Column(name = "patent_type", nullable = false)
    private PatentType patentType;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private PatentStatus status;

    @Column(name = "technology_area", length = 200)
    private String technologyArea;

    @Column(name = "filing_date")
    private LocalDate filingDate;

    @Column(name = "priority_date")
    private LocalDate priorityDate;

    @Column(name = "publication_date")
    private LocalDate publicationDate;

    @Column(name = "examination_date")
    private LocalDate examinationDate;

    @Column(name = "grant_date")
    private LocalDate grantDate;

    @Column(name = "expiration_date")
    private LocalDate expirationDate;

    @Column(name = "examiner_name", length = 200)
    private String examinerName;

    @Column(name = "art_unit", length = 10)
    private String artUnit;

    @Builder.Default
    @Column(name = "is_international")
    private Boolean isInternational = false;

    @Column(name = "priority_country", length = 50)
    private String priorityCountry;

    @Column(name = "priority_application_number", length = 50)
    private String priorityApplicationNumber;

    @Column(name = "inventors", columnDefinition = "TEXT")
    private String inventors;

    @Column(name = "assignees", columnDefinition = "TEXT")
    private String assignees;

    @Column(name = "claims_count")
    private Integer claimsCount;

    @Column(name = "independent_claims_count")
    private Integer independentClaimsCount;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "claims", columnDefinition = "TEXT")
    private String claims;

    @Column(name = "drawings_count")
    private Integer drawingsCount;

    @Column(name = "specification_pages")
    private Integer specificationPages;

    @Column(name = "filing_fees", precision = 10, scale = 2)
    private BigDecimal filingFees;

    @Column(name = "search_fees", precision = 10, scale = 2)
    private BigDecimal searchFees;

    @Column(name = "examination_fees", precision = 10, scale = 2)
    private BigDecimal examinationFees;

    @Column(name = "issue_fees", precision = 10, scale = 2)
    private BigDecimal issueFees;

    @Column(name = "maintenance_fees_due")
    private LocalDate maintenanceFeesDue;

    @Column(name = "next_maintenance_fee", precision = 10, scale = 2)
    private BigDecimal nextMaintenanceFee;

    @Column(name = "office_actions_count")
    private Integer officeActionsCount;

    @Column(name = "last_office_action_date")
    private LocalDate lastOfficeActionDate;

    @Column(name = "response_due_date")
    private LocalDate responseDueDate;

    @Column(name = "continuation_data", columnDefinition = "TEXT")
    private String continuationData;

    @Column(name = "foreign_filing_data", columnDefinition = "TEXT")
    private String foreignFilingData;

    @Column(name = "prior_art_references", columnDefinition = "TEXT")
    private String priorArtReferences;

    @Column(name = "cited_references_count")
    private Integer citedReferencesCount;

    @Column(name = "forward_citations_count")
    private Integer forwardCitationsCount;

    @Column(name = "ipc_classification", length = 50)
    private String ipcClassification;

    @Column(name = "cpc_classification", length = 50)
    private String cpcClassification;

    @Column(name = "us_classification", length = 50)
    private String usClassification;

    @Column(name = "attorney_docket_number", length = 100)
    private String attorneyDocketNumber;

    @Column(name = "law_firm", length = 200)
    private String lawFirm;

    @Column(name = "attorney_name", length = 200)
    private String attorneyName;

    @Column(name = "customer_number", length = 20)
    private String customerNumber;

    @Column(name = "confirmation_number", length = 20)
    private String confirmationNumber;

    @Column(name = "small_entity_status")
    private Boolean smallEntityStatus;

    @Column(name = "micro_entity_status")
    private Boolean microEntityStatus;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "internal_reference", length = 100)
    private String internalReference;

    @Builder.Default
    @Column(name = "ai_analysis_completed")
    private Boolean aiAnalysisCompleted = false;

    @Column(name = "ai_risk_score", precision = 3, scale = 2)
    private BigDecimal aiRiskScore;

    @Column(name = "ai_recommendations", columnDefinition = "TEXT")
    private String aiRecommendations;

    @Column(name = "created_by")
    private Long createdBy;

    @Column(name = "updated_by")
    private Long updatedBy;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}