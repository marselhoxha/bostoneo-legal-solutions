package com.bostoneo.bostoneosolutions.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

/**
 * P10.c — Liens & subrogation claims against a Personal Injury settlement.
 *
 * Reduces net-to-client when the case settles. Surfaced on the Damages tab
 * for active negotiation; consumed by the closing-statement generator (P9f)
 * to compute the final disbursement.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "pi_liens", indexes = {
    @Index(name = "idx_pi_liens_case_org",    columnList = "case_id, organization_id"),
    @Index(name = "idx_pi_liens_case_status", columnList = "case_id, status")
})
public class PILien {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "case_id", nullable = false)
    private Long caseId;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "holder", nullable = false, length = 255)
    private String holder;

    @Column(name = "type", nullable = false, length = 20)
    private String type;

    @Column(name = "original_amount", precision = 12, scale = 2)
    private BigDecimal originalAmount;

    @Column(name = "negotiated_amount", precision = 12, scale = 2)
    private BigDecimal negotiatedAmount;

    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private String status = "OPEN";

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "asserted_date")
    private LocalDate assertedDate;

    @Column(name = "resolved_date")
    private LocalDate resolvedDate;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "created_by")
    private Long createdBy;
}
