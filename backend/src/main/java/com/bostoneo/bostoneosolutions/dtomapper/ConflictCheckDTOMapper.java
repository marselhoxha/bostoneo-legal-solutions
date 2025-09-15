package com.bostoneo.bostoneosolutions.dtomapper;

import com.bostoneo.bostoneosolutions.dto.ConflictCheckDTO;
import com.bostoneo.bostoneosolutions.dto.ConflictMatchDTO;
import com.bostoneo.bostoneosolutions.model.ConflictCheck;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.List;
import java.util.Map;

@Component
public class ConflictCheckDTOMapper {

    private final ObjectMapper objectMapper;

    public ConflictCheckDTOMapper(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public ConflictCheckDTO toDTO(ConflictCheck conflictCheck) {
        if (conflictCheck == null) {
            return null;
        }

        ConflictCheckDTO.ConflictCheckDTOBuilder builder = ConflictCheckDTO.builder()
                .id(conflictCheck.getId())
                .entityType(conflictCheck.getEntityType())
                .entityId(conflictCheck.getEntityId())
                .checkType(conflictCheck.getCheckType())
                .status(conflictCheck.getStatus())
                .confidenceScore(conflictCheck.getConfidenceScore())
                .autoChecked(conflictCheck.getAutoChecked())
                .checkedBy(conflictCheck.getCheckedBy())
                .checkedAt(conflictCheck.getCheckedAt())
                .resolution(conflictCheck.getResolution())
                .resolutionNotes(conflictCheck.getResolutionNotes())
                .waiverDocumentPath(conflictCheck.getWaiverDocumentPath())
                .resolvedBy(conflictCheck.getResolvedBy())
                .resolvedAt(conflictCheck.getResolvedAt())
                .expiresAt(conflictCheck.getExpiresAt())
                .createdAt(conflictCheck.getCreatedAt())
                .updatedAt(conflictCheck.getUpdatedAt());

        // Parse JSON fields
        try {
            if (conflictCheck.getSearchTerms() != null) {
                List<String> searchTerms = objectMapper.readValue(
                    conflictCheck.getSearchTerms(), 
                    new TypeReference<List<String>>() {}
                );
                builder.searchTerms(searchTerms);
            }

            if (conflictCheck.getSearchParameters() != null) {
                Map<String, Object> searchParameters = objectMapper.readValue(
                    conflictCheck.getSearchParameters(), 
                    new TypeReference<Map<String, Object>>() {}
                );
                builder.searchParameters(searchParameters);
            }

            if (conflictCheck.getResults() != null) {
                List<ConflictMatchDTO> results = objectMapper.readValue(
                    conflictCheck.getResults(), 
                    new TypeReference<List<ConflictMatchDTO>>() {}
                );
                builder.results(results);
            }
        } catch (JsonProcessingException e) {
            // Log error and set empty collections
            builder.searchTerms(Collections.emptyList())
                   .searchParameters(Collections.emptyMap())
                   .results(Collections.emptyList());
        }

        // Set user names if available
        if (conflictCheck.getChecker() != null) {
            builder.checkedByName(conflictCheck.getChecker().getFirstName() + " " + 
                                 conflictCheck.getChecker().getLastName());
        }

        if (conflictCheck.getResolver() != null) {
            builder.resolvedByName(conflictCheck.getResolver().getFirstName() + " " + 
                                  conflictCheck.getResolver().getLastName());
        }

        return builder.build();
    }

    public ConflictCheck toEntity(ConflictCheckDTO dto) {
        if (dto == null) {
            return null;
        }

        ConflictCheck.ConflictCheckBuilder<?, ?> builder = ConflictCheck.builder()
                .id(dto.getId())
                .entityType(dto.getEntityType())
                .entityId(dto.getEntityId())
                .checkType(dto.getCheckType())
                .status(dto.getStatus())
                .confidenceScore(dto.getConfidenceScore())
                .autoChecked(dto.getAutoChecked())
                .checkedBy(dto.getCheckedBy())
                .checkedAt(dto.getCheckedAt())
                .resolution(dto.getResolution())
                .resolutionNotes(dto.getResolutionNotes())
                .waiverDocumentPath(dto.getWaiverDocumentPath())
                .resolvedBy(dto.getResolvedBy())
                .resolvedAt(dto.getResolvedAt())
                .expiresAt(dto.getExpiresAt())
                .createdAt(dto.getCreatedAt())
                .updatedAt(dto.getUpdatedAt());

        // Serialize collections to JSON
        try {
            if (dto.getSearchTerms() != null) {
                builder.searchTerms(objectMapper.writeValueAsString(dto.getSearchTerms()));
            }

            if (dto.getSearchParameters() != null) {
                builder.searchParameters(objectMapper.writeValueAsString(dto.getSearchParameters()));
            }

            if (dto.getResults() != null) {
                builder.results(objectMapper.writeValueAsString(dto.getResults()));
            }
        } catch (JsonProcessingException e) {
            // Log error and use empty JSON
            builder.searchTerms("[]")
                   .searchParameters("{}")
                   .results("[]");
        }

        return builder.build();
    }
}