package com.bostoneo.bostoneosolutions.dtomapper;

import com.bostoneo.bostoneosolutions.dto.CaseActivityDTO;
import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.model.CaseActivity;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;

import java.util.Collections;
import java.util.Map;

@Slf4j
public class CaseActivityDTOMapper {

    private static final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * Convert from Entity to DTO
     *
     * @param caseActivity The CaseActivity entity to convert
     * @return The CaseActivityDTO
     */
    public static CaseActivityDTO fromCaseActivity(CaseActivity caseActivity) {
        if (caseActivity == null) {
            return null;
        }

        CaseActivityDTO dto = new CaseActivityDTO();
        BeanUtils.copyProperties(caseActivity, dto);

        // Set the userId which we already have
        dto.setUserId(caseActivity.getUserId());

        // Parse JSON metadata if present
        if (caseActivity.getMetadataJson() != null && !caseActivity.getMetadataJson().isBlank()) {
            try {
                Map<String, Object> metadata = objectMapper.readValue(
                    caseActivity.getMetadataJson(),
                    new TypeReference<Map<String, Object>>() {}
                );
                dto.setMetadata(metadata);
            } catch (JsonProcessingException e) {
                // Log error and continue with empty metadata
                log.error("Error parsing metadata JSON: {}", e.getMessage());
                dto.setMetadata(Collections.emptyMap());
            }
        }

        return dto;
    }

    /**
     * Convert from DTO to Entity
     *
     * @param dto The CaseActivityDTO to convert
     * @return The CaseActivity entity
     */
    public static CaseActivity toCaseActivity(CaseActivityDTO dto) {
        if (dto == null) {
            return null;
        }

        CaseActivity entity = new CaseActivity();
        BeanUtils.copyProperties(dto, entity);

        // Convert metadata to JSON string
        if (dto.getMetadata() != null) {
            try {
                String metadataJson = objectMapper.writeValueAsString(dto.getMetadata());
                entity.setMetadataJson(metadataJson);
            } catch (JsonProcessingException e) {
                // Log error and continue with null metadata
                log.error("Error serializing metadata to JSON: {}", e.getMessage());
                entity.setMetadataJson("{}");
            }
        }

        return entity;
    }
} 