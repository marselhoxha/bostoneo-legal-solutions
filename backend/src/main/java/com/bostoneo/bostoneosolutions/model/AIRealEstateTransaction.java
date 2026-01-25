package com.bostoneo.bostoneosolutions.model;

import com.bostoneo.bostoneosolutions.enumeration.TransactionType;
import com.bostoneo.bostoneosolutions.enumeration.PropertyType;
import com.bostoneo.bostoneosolutions.enumeration.DeedType;
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
@Table(name = "ai_real_estate_transactions")
public class AIRealEstateTransaction {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "case_id")
    private Long caseId;

    @Enumerated(EnumType.STRING)
    @Column(name = "transaction_type", nullable = false)
    private TransactionType transactionType;

    @Column(name = "property_address", nullable = false, columnDefinition = "TEXT")
    private String propertyAddress;

    @Enumerated(EnumType.STRING)
    @Column(name = "property_type", nullable = false)
    private PropertyType propertyType;

    @Column(name = "purchase_price", precision = 15, scale = 2)
    private BigDecimal purchasePrice;

    @Column(name = "loan_amount", precision = 15, scale = 2)
    private BigDecimal loanAmount;

    @Column(name = "buyer_name", length = 300)
    private String buyerName;

    @Column(name = "seller_name", length = 300)
    private String sellerName;

    @Column(name = "lender_name", length = 200)
    private String lenderName;

    @Column(name = "closing_date")
    private LocalDate closingDate;

    @Column(name = "registry_of_deeds", length = 100)
    private String registryOfDeeds;

    @Column(name = "book_page", length = 50)
    private String bookPage;

    @Column(name = "lot_plan_info", length = 200)
    private String lotPlanInfo;

    @Column(name = "title_company", length = 200)
    private String titleCompany;

    @Column(name = "closing_attorney", length = 200)
    private String closingAttorney;

    @Column(name = "inspection_deadline")
    private LocalDate inspectionDeadline;

    @Column(name = "mortgage_contingency_deadline")
    private LocalDate mortgageContingencyDeadline;

    @Column(name = "purchase_and_sale_signed")
    private LocalDate purchaseAndSaleSigned;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "deed_type")
    private DeedType deedType = DeedType.WARRANTY;

    @Column(name = "title_issues", columnDefinition = "jsonb")
    private String titleIssues;

    @Column(name = "special_conditions", columnDefinition = "TEXT")
    private String specialConditions;

    @Column(name = "closing_costs", columnDefinition = "jsonb")
    private String closingCosts;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}