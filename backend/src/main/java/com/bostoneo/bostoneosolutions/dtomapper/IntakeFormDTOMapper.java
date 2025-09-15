package com.bostoneo.bostoneosolutions.dtomapper;

import com.bostoneo.bostoneosolutions.dto.IntakeFormDTO;
import com.bostoneo.bostoneosolutions.model.IntakeForm;
import com.bostoneo.bostoneosolutions.model.User;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class IntakeFormDTOMapper {

    private final ObjectMapper objectMapper;

    public IntakeFormDTO toDTO(IntakeForm form) {
        if (form == null) {
            return null;
        }

        IntakeFormDTO dto = IntakeFormDTO.builder()
            .id(form.getId())
            .name(form.getName())
            .description(form.getDescription())
            .formType(form.getFormType())
            .status(form.getStatus())
            .isPublic(form.getIsPublic())
            .publicUrl(form.getPublicUrl())
            .successMessage(form.getSuccessMessage())
            .redirectUrl(form.getRedirectUrl())
            .emailTemplateId(form.getEmailTemplateId())
            .autoAssignTo(form.getAutoAssignTo())
            .practiceArea(form.getPracticeArea())
            .version(form.getVersion())
            .submissionCount(form.getSubmissionCount())
            .conversionRate(form.getConversionRate())
            .createdBy(form.getCreatedBy())
            .createdAt(form.getCreatedAt())
            .updatedAt(form.getUpdatedAt())
            .publishedAt(form.getPublishedAt())
            .build();

        // Parse form config JSON
        if (form.getFormConfig() != null) {
            try {
                Map<String, Object> formConfig = objectMapper.readValue(
                    form.getFormConfig(), 
                    new TypeReference<Map<String, Object>>() {}
                );
                dto.setFormConfig(formConfig);
            } catch (Exception e) {
                log.error("Error parsing form config JSON for form ID: {}", form.getId(), e);
                dto.setFormConfig(new HashMap<>());
            }
        }

        return dto;
    }

    public IntakeForm toEntity(IntakeFormDTO dto) {
        if (dto == null) {
            return null;
        }

        IntakeForm.IntakeFormBuilder<?, ?> builder = IntakeForm.builder()
            .id(dto.getId())
            .name(dto.getName())
            .description(dto.getDescription())
            .formType(dto.getFormType())
            .status(dto.getStatus())
            .isPublic(dto.getIsPublic())
            .publicUrl(dto.getPublicUrl())
            .successMessage(dto.getSuccessMessage())
            .redirectUrl(dto.getRedirectUrl())
            .emailTemplateId(dto.getEmailTemplateId())
            .autoAssignTo(dto.getAutoAssignTo())
            .practiceArea(dto.getPracticeArea())
            .version(dto.getVersion())
            .submissionCount(dto.getSubmissionCount())
            .conversionRate(dto.getConversionRate())
            .createdBy(dto.getCreatedBy())
            .createdAt(dto.getCreatedAt())
            .updatedAt(dto.getUpdatedAt())
            .publishedAt(dto.getPublishedAt());

        // Serialize form config to JSON
        if (dto.getFormConfig() != null) {
            try {
                String formConfigJson = objectMapper.writeValueAsString(dto.getFormConfig());
                builder.formConfig(formConfigJson);
            } catch (Exception e) {
                log.error("Error serializing form config to JSON for DTO ID: {}", dto.getId(), e);
                builder.formConfig("{}");
            }
        }

        return builder.build();
    }
}