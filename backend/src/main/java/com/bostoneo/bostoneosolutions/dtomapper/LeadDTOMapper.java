package com.***REMOVED***.***REMOVED***solutions.dtomapper;

import com.***REMOVED***.***REMOVED***solutions.dto.LeadDTO;
import com.***REMOVED***.***REMOVED***solutions.model.Lead;
import com.***REMOVED***.***REMOVED***solutions.model.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class LeadDTOMapper {

    public LeadDTO toDTO(Lead lead) {
        if (lead == null) {
            return null;
        }

        LeadDTO dto = LeadDTO.builder()
            .id(lead.getId())
            .firstName(lead.getFirstName())
            .lastName(lead.getLastName())
            .fullName(lead.getFullName())
            .email(lead.getEmail())
            .phone(lead.getPhone())
            .company(lead.getCompany())
            .status(lead.getStatus())
            .practiceArea(lead.getPracticeArea())
            .priority(lead.getPriority())
            .leadScore(lead.getLeadScore())
            .assignedTo(lead.getAssignedTo())
            .source(lead.getSource())
            .referralSource(lead.getReferralSource())
            .initialInquiry(lead.getInitialInquiry())
            .notes(lead.getNotes())
            .urgencyLevel(lead.getUrgencyLevel())
            .contactPreference(lead.getCommunicationPreference())
            .bestTimeToCall(lead.getBestContactTime())
            .consultationDate(lead.getConsultationDate())
            .followUpDate(lead.getFollowUpDate())
            .estimatedValue(lead.getEstimatedCaseValue() != null ? lead.getEstimatedCaseValue().intValue() : null)
            .caseType(lead.getCaseType())
            .convertedAt(lead.getConvertedAt())
            .createdAt(lead.getCreatedAt())
            .updatedAt(lead.getUpdatedAt())
            .build();

        // Set assigned user name if user is loaded
        User assignedUser = lead.getAssignedUser();
        if (assignedUser != null) {
            dto.setAssignedToName(assignedUser.getFirstName() + " " + assignedUser.getLastName());
        }

        return dto;
    }

    public Lead toEntity(LeadDTO dto) {
        if (dto == null) {
            return null;
        }

        return Lead.builder()
            .id(dto.getId())
            .firstName(dto.getFirstName())
            .lastName(dto.getLastName())
            .email(dto.getEmail())
            .phone(dto.getPhone())
            .company(dto.getCompany())
            .status(dto.getStatus())
            .practiceArea(dto.getPracticeArea())
            .priority(dto.getPriority())
            .leadScore(dto.getLeadScore())
            .assignedTo(dto.getAssignedTo())
            .source(dto.getSource())
            .referralSource(dto.getReferralSource())
            .initialInquiry(dto.getInitialInquiry())
            .notes(dto.getNotes())
            .urgencyLevel(dto.getUrgencyLevel())
            .communicationPreference(dto.getContactPreference())
            .bestContactTime(dto.getBestTimeToCall())
            .consultationDate(dto.getConsultationDate())
            .followUpDate(dto.getFollowUpDate())
            .estimatedCaseValue(dto.getEstimatedValue() != null ? java.math.BigDecimal.valueOf(dto.getEstimatedValue()) : null)
            .caseType(dto.getCaseType())
            .convertedAt(dto.getConvertedAt())
            .createdAt(dto.getCreatedAt())
            .updatedAt(dto.getUpdatedAt())
            .build();
    }
}