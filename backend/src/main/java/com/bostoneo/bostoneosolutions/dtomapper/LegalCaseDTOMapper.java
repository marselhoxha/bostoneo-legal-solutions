package com.***REMOVED***.***REMOVED***solutions.dtomapper;

import com.***REMOVED***.***REMOVED***solutions.dto.LegalCaseDTO;
import com.***REMOVED***.***REMOVED***solutions.model.LegalCase;
import org.springframework.stereotype.Component;

@Component
public class LegalCaseDTOMapper {
    
    public LegalCaseDTO toDTO(LegalCase entity) {
        if (entity == null) {
            return null;
        }
        
        LegalCaseDTO dto = new LegalCaseDTO();
        dto.setId(entity.getId());
        dto.setCaseNumber(entity.getCaseNumber());
        dto.setTitle(entity.getTitle());
        dto.setClientName(entity.getClientName());
        dto.setClientEmail(entity.getClientEmail());
        dto.setClientPhone(entity.getClientPhone());
        dto.setClientAddress(entity.getClientAddress());
        dto.setStatus(entity.getStatus());
        dto.setPriority(entity.getPriority());
        dto.setType(entity.getType());
        dto.setDescription(entity.getDescription());
        
        // Map court info
        dto.setCourtName(entity.getCourtName());
        dto.setJudgeName(entity.getJudgeName());
        dto.setCourtroom(entity.getCourtroom());
        
        // Map important dates
        dto.setFilingDate(entity.getFilingDate());
        dto.setNextHearing(entity.getNextHearing());
        dto.setTrialDate(entity.getTrialDate());
        
        // Map billing info
        dto.setHourlyRate(entity.getHourlyRate());
        dto.setTotalHours(entity.getTotalHours());
        dto.setTotalAmount(entity.getTotalAmount());
        dto.setPaymentStatus(entity.getPaymentStatus());
        
        dto.setCreatedAt(entity.getCreatedAt());
        dto.setUpdatedAt(entity.getUpdatedAt());
        
        return dto;
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
        
        // Set court info
        entity.setCourtName(dto.getCourtName());
        entity.setJudgeName(dto.getJudgeName());
        entity.setCourtroom(dto.getCourtroom());
        
        // Set important dates
        entity.setFilingDate(dto.getFilingDate());
        entity.setNextHearing(dto.getNextHearing());
        entity.setTrialDate(dto.getTrialDate());
        
        // Set billing info
        entity.setHourlyRate(dto.getHourlyRate());
        entity.setTotalHours(dto.getTotalHours());
        entity.setTotalAmount(dto.getTotalAmount());
        entity.setPaymentStatus(dto.getPaymentStatus());
        
        entity.setCreatedAt(dto.getCreatedAt());
        entity.setUpdatedAt(dto.getUpdatedAt());
        
        return entity;
    }
} 