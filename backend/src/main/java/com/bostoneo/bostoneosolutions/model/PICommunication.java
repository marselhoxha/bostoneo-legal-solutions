package com.bostoneo.bostoneosolutions.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

/**
 * P9e — PI Communications Log entity.
 *
 * Tracks calls, emails, letters, and meetings between the attorney and
 * counterparties (adjusters, opposing counsel, providers, clients) on a
 * Personal Injury case. Surfaced on the Negotiation tab as a vertical
 * timeline alongside settlement events.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "pi_communications", indexes = {
    @Index(name = "idx_pi_comms_case_org", columnList = "case_id, organization_id"),
    @Index(name = "idx_pi_comms_event_date", columnList = "event_date"),
    @Index(name = "idx_pi_comms_type", columnList = "case_id, type")
})
public class PICommunication {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "case_id", nullable = false)
    private Long caseId;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "type", nullable = false, length = 20)
    private String type;

    @Column(name = "direction", nullable = false, length = 10)
    private String direction;

    @Column(name = "counterparty", length = 255)
    private String counterparty;

    @Column(name = "subject", length = 500)
    private String subject;

    @Column(name = "summary", columnDefinition = "TEXT")
    private String summary;

    @Column(name = "event_date", nullable = false)
    private LocalDateTime eventDate;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "created_by")
    private Long createdBy;
}
