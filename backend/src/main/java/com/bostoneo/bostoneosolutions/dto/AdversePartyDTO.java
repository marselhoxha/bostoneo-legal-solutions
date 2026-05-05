package com.bostoneo.bostoneosolutions.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL;

/**
 * API contract for adverse parties (plaintiffs, defendants, witnesses, experts,
 * counsel, etc.) attached to a legal case.
 *
 * <p>Mirrors the {@link com.bostoneo.bostoneosolutions.model.AdverseParty}
 * entity but flattens the encryption boundary — service layer is responsible
 * for tenant filtering and entity↔DTO conversion via {@link
 * com.bostoneo.bostoneosolutions.dtomapper.AdversePartyDTOMapper}.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_NULL)
public class AdversePartyDTO {

    private Long id;

    private Long organizationId;

    private Long caseId;

    private Long clientId;

    /** Display name (required). */
    private String name;

    /** Email (encrypted at rest). */
    private String email;

    /** Phone (encrypted at rest). */
    private String phone;

    /** Mailing address (encrypted at rest). */
    private String address;

    /**
     * One of: PLAINTIFF, DEFENDANT, WITNESS, EXPERT, OPPOSING_COUNSEL,
     * INSURANCE_ADJUSTER, OTHER. Validated client-side; server stores the raw
     * string so the taxonomy can evolve without a schema change.
     */
    private String partyType;

    private String notes;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
