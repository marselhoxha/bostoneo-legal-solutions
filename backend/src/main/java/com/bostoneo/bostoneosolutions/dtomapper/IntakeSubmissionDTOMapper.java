package com.bostoneo.bostoneosolutions.dtomapper;

import com.bostoneo.bostoneosolutions.dto.IntakeSubmissionDTO;
import com.bostoneo.bostoneosolutions.model.IntakeForm;
import com.bostoneo.bostoneosolutions.model.IntakeSubmission;
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
public class IntakeSubmissionDTOMapper {

    private final ObjectMapper objectMapper;

    public IntakeSubmissionDTO toDTO(IntakeSubmission submission) {
        if (submission == null) {
            return null;
        }

        IntakeSubmissionDTO dto = IntakeSubmissionDTO.builder()
            .id(submission.getId())
            .organizationId(submission.getOrganizationId())
            .intakeFormId(submission.getFormId())
            .status(submission.getStatus())
            .priorityScore(submission.getPriorityScore())
            .priority(mapPriorityFromScore(submission.getPriorityScore()))
            .notes(submission.getNotes())
            .reviewedBy(submission.getReviewedBy())
            .reviewedAt(submission.getReviewedAt())
            .convertedToLeadId(submission.getLeadId())
            .createdAt(submission.getCreatedAt())
            .updatedAt(submission.getUpdatedAt())
            .build();

        // Parse submission data JSON
        if (submission.getSubmissionData() != null) {
            try {
                Map<String, Object> submissionData = objectMapper.readValue(
                    submission.getSubmissionData(), 
                    new TypeReference<Map<String, Object>>() {}
                );
                dto.setSubmissionData(submissionData);
            } catch (Exception e) {
                log.error("Error parsing submission data JSON for submission ID: {}", submission.getId(), e);
                dto.setSubmissionData(new HashMap<>());
            }
        }

        // Set form info if intake form is loaded
        IntakeForm intakeForm = submission.getIntakeForm();
        if (intakeForm != null) {
            dto.setFormTitle(intakeForm.getName());
            dto.setPracticeArea(intakeForm.getPracticeArea()); // Default fallback
        }

        // Extract client info and practice area from submission data
        extractClientInfoFromSubmissionData(dto);
        
        // Override practice area with submission data if available
        if (dto.getSubmissionData() != null) {
            String submissionPracticeArea = getStringValue(dto.getSubmissionData(), "practiceArea");
            if (submissionPracticeArea != null) {
                dto.setPracticeArea(submissionPracticeArea);
            }
            
            // Extract urgency from submission data
            String submissionUrgency = getStringValue(dto.getSubmissionData(), "urgency");
            if (submissionUrgency != null) {
                dto.setUrgency(submissionUrgency);
            }
        }

        // Set reviewer name if user is loaded
        User reviewer = submission.getReviewer();
        if (reviewer != null) {
            dto.setReviewerName(reviewer.getFirstName() + " " + reviewer.getLastName());
        }

        return dto;
    }

    public IntakeSubmission toEntity(IntakeSubmissionDTO dto) {
        if (dto == null) {
            return null;
        }

        IntakeSubmission.IntakeSubmissionBuilder<?, ?> builder = IntakeSubmission.builder()
            .id(dto.getId())
            .organizationId(dto.getOrganizationId())
            .formId(dto.getIntakeFormId())
            .status(dto.getStatus())
            .priorityScore(dto.getPriorityScore())
            .notes(dto.getNotes())
            .reviewedBy(dto.getReviewedBy())
            .reviewedAt(dto.getReviewedAt())
            .leadId(dto.getConvertedToLeadId())
            .createdAt(dto.getCreatedAt())
            .updatedAt(dto.getUpdatedAt());

        // Serialize submission data to JSON
        if (dto.getSubmissionData() != null) {
            try {
                String submissionDataJson = objectMapper.writeValueAsString(dto.getSubmissionData());
                builder.submissionData(submissionDataJson);
            } catch (Exception e) {
                log.error("Error serializing submission data to JSON for DTO ID: {}", dto.getId(), e);
                builder.submissionData("{}");
            }
        }

        return builder.build();
    }

    private String mapPriorityFromScore(Integer priorityScore) {
        if (priorityScore == null) return "LOW";
        
        if (priorityScore >= 80) return "URGENT";
        if (priorityScore >= 60) return "HIGH";
        if (priorityScore >= 40) return "MEDIUM";
        return "LOW";
    }

    private void extractClientInfoFromSubmissionData(IntakeSubmissionDTO dto) {
        if (dto.getSubmissionData() != null) {
            Map<String, Object> data = dto.getSubmissionData();
            
            // Try various common field names for client information
            String clientName = getStringValue(data, "fullName", "name", "clientName", "firstName");
            String clientEmail = getStringValue(data, "email", "emailAddress", "clientEmail");
            String clientPhone = getStringValue(data, "phone", "phoneNumber", "clientPhone");
            
            // If we have separate first/last names, combine them
            if (clientName == null) {
                String firstName = getStringValue(data, "firstName");
                String lastName = getStringValue(data, "lastName");
                if (firstName != null || lastName != null) {
                    clientName = (firstName != null ? firstName : "") + 
                               (lastName != null ? (firstName != null ? " " : "") + lastName : "");
                }
            }
            
            dto.setClientName(clientName);
            dto.setClientEmail(clientEmail);
            dto.setClientPhone(clientPhone);
        }
    }

    private String getStringValue(Map<String, Object> data, String... keys) {
        for (String key : keys) {
            Object value = data.get(key);
            if (value != null && !value.toString().trim().isEmpty()) {
                return value.toString().trim();
            }
        }
        return null;
    }
}