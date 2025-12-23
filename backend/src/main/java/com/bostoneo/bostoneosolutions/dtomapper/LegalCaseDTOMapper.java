package com.bostoneo.bostoneosolutions.dtomapper;

import com.bostoneo.bostoneosolutions.dto.LegalCaseDTO;
import com.bostoneo.bostoneosolutions.model.LegalCase;
import com.bostoneo.bostoneosolutions.enumeration.CaseStatus;
import com.bostoneo.bostoneosolutions.enumeration.CasePriority;
import com.bostoneo.bostoneosolutions.enumeration.PaymentStatus;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Component;

@Component
public class LegalCaseDTOMapper {
    
    public LegalCaseDTO toDTO(LegalCase entity) {
        if (entity == null) {
            return null;
        }
        
        return LegalCaseDTO.builder()
            .id(entity.getId())
            .caseNumber(entity.getCaseNumber())
            .title(entity.getTitle())
            .clientName(entity.getClientName())
            .clientEmail(entity.getClientEmail())
            .clientPhone(entity.getClientPhone())
            .clientAddress(entity.getClientAddress())
            .type(entity.getType())
            .description(entity.getDescription())
            .countyName(entity.getCountyName())
            .courtroom(entity.getCourtroom())
            .judgeName(entity.getJudgeName())
            .filingDate(entity.getFilingDate())
            .nextHearing(entity.getNextHearing())
            .trialDate(entity.getTrialDate())
            .hourlyRate(entity.getHourlyRate())
            .totalHours(entity.getTotalHours())
            .totalAmount(entity.getTotalAmount())
            .status(entity.getStatus())
            .priority(entity.getPriority())
            .paymentStatus(entity.getPaymentStatus())
            .createdAt(entity.getCreatedAt())
            .updatedAt(entity.getUpdatedAt())
            .build();
    }
    
    public LegalCase toEntity(LegalCaseDTO dto) {
        if (dto == null) {
            return null;
        }
        
        LegalCase entity = new LegalCase();
        entity.setId(dto.getId());
        entity.setCaseNumber(dto.getCaseNumber());
        entity.setTitle(dto.getTitle());
        entity.setClientName(dto.getClientName());
        entity.setClientEmail(dto.getClientEmail());
        entity.setClientPhone(dto.getClientPhone());
        entity.setClientAddress(dto.getClientAddress());
        entity.setStatus(dto.getStatus());
        entity.setPriority(dto.getPriority());
        entity.setType(dto.getType());
        entity.setDescription(dto.getDescription());
        entity.setCountyName(dto.getCountyName());
        entity.setJudgeName(dto.getJudgeName());
        entity.setCourtroom(dto.getCourtroom());
        entity.setFilingDate(dto.getFilingDate());
        entity.setNextHearing(dto.getNextHearing());
        entity.setTrialDate(dto.getTrialDate());
        entity.setHourlyRate(dto.getHourlyRate());
        entity.setTotalHours(dto.getTotalHours());
        entity.setTotalAmount(dto.getTotalAmount());
        entity.setPaymentStatus(dto.getPaymentStatus());
        entity.setCreatedAt(dto.getCreatedAt());
        entity.setUpdatedAt(dto.getUpdatedAt());
        
        return entity;
    }

    public static LegalCaseDTO fromLegalCase(LegalCase legalCase) {
        LegalCaseDTO legalCaseDTO = new LegalCaseDTO();
        BeanUtils.copyProperties(legalCase, legalCaseDTO);
        return legalCaseDTO;
    }
    
    public static LegalCase toLegalCase(LegalCaseDTO legalCaseDTO) {
        LegalCase legalCase = new LegalCase();
        BeanUtils.copyProperties(legalCaseDTO, legalCase);
        return legalCase;
    }

    public LegalCase fromDTO(LegalCaseDTO dto) {
        if (dto == null) {
            return null;
        }
        
        LegalCase entity = new LegalCase();
        entity.setId(dto.getId());
        entity.setCaseNumber(dto.getCaseNumber());
        entity.setTitle(dto.getTitle());
        entity.setClientName(dto.getClientName());
        entity.setClientEmail(dto.getClientEmail());
        entity.setClientPhone(dto.getClientPhone());
        entity.setClientAddress(dto.getClientAddress());
        entity.setType(dto.getType());
        entity.setDescription(dto.getDescription());
        entity.setCountyName(dto.getCountyName());
        entity.setCourtroom(dto.getCourtroom());
        entity.setJudgeName(dto.getJudgeName());
        entity.setFilingDate(dto.getFilingDate());
        entity.setNextHearing(dto.getNextHearing());
        entity.setTrialDate(dto.getTrialDate());
        entity.setHourlyRate(dto.getHourlyRate());
        entity.setTotalHours(dto.getTotalHours());
        entity.setTotalAmount(dto.getTotalAmount());
        entity.setStatus(dto.getStatus());
        entity.setPriority(dto.getPriority());
        entity.setPaymentStatus(dto.getPaymentStatus());
        entity.setCreatedAt(dto.getCreatedAt());
        entity.setUpdatedAt(dto.getUpdatedAt());
        
        return entity;
    }
} 