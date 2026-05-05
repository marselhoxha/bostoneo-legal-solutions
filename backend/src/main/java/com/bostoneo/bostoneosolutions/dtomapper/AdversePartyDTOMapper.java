package com.bostoneo.bostoneosolutions.dtomapper;

import com.bostoneo.bostoneosolutions.dto.AdversePartyDTO;
import com.bostoneo.bostoneosolutions.model.AdverseParty;

/**
 * Static mapper between {@link AdverseParty} entity and {@link AdversePartyDTO}.
 *
 * <p>The entity carries encrypted fields (email/phone/address) via
 * {@link com.bostoneo.bostoneosolutions.converter.EncryptedStringConverter};
 * the converter handles encryption transparently on save and decryption on
 * load, so this mapper only deals with plaintext on both sides.
 */
public final class AdversePartyDTOMapper {

    private AdversePartyDTOMapper() {}

    public static AdversePartyDTO toDTO(AdverseParty entity) {
        if (entity == null) return null;
        return AdversePartyDTO.builder()
                .id(entity.getId())
                .organizationId(entity.getOrganizationId())
                .caseId(entity.getCaseId())
                .clientId(entity.getClientId())
                .name(entity.getName())
                .email(entity.getEmail())
                .phone(entity.getPhone())
                .address(entity.getAddress())
                .partyType(entity.getPartyType())
                .notes(entity.getNotes())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    /**
     * Build a fresh entity from a DTO. Used on create — caller must set
     * {@code organizationId} and {@code caseId} from server context, not
     * trust client values.
     */
    public static AdverseParty toEntity(AdversePartyDTO dto) {
        if (dto == null) return null;
        return AdverseParty.builder()
                .id(dto.getId())
                .organizationId(dto.getOrganizationId())
                .caseId(dto.getCaseId())
                .clientId(dto.getClientId())
                .name(dto.getName())
                .email(dto.getEmail())
                .phone(dto.getPhone())
                .address(dto.getAddress())
                .partyType(dto.getPartyType())
                .notes(dto.getNotes())
                .build();
    }

    /**
     * Apply mutable fields from a DTO onto an existing entity (used on update).
     * Skips id/organizationId/caseId so client can't sneak in tenant changes.
     */
    public static void applyEditableFields(AdversePartyDTO dto, AdverseParty entity) {
        if (dto == null || entity == null) return;
        if (dto.getName() != null)      entity.setName(dto.getName());
        if (dto.getPartyType() != null) entity.setPartyType(dto.getPartyType());
        // Email/phone/address/notes can legitimately be set to empty string to
        // clear, but null means "no change". null-vs-blank ambiguity at the
        // wire level is the client's responsibility.
        if (dto.getEmail() != null)   entity.setEmail(dto.getEmail());
        if (dto.getPhone() != null)   entity.setPhone(dto.getPhone());
        if (dto.getAddress() != null) entity.setAddress(dto.getAddress());
        if (dto.getNotes() != null)   entity.setNotes(dto.getNotes());
        if (dto.getClientId() != null) entity.setClientId(dto.getClientId());
    }
}
