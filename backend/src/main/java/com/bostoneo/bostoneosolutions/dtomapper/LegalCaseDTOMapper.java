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
            .organizationId(entity.getOrganizationId())
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
            // Personal Injury (PI) fields
            .injuryDate(entity.getInjuryDate())
            .injuryType(entity.getInjuryType())
            .injuryDescription(entity.getInjuryDescription())
            .accidentLocation(entity.getAccidentLocation())
            .liabilityAssessment(entity.getLiabilityAssessment())
            .comparativeNegligencePercent(entity.getComparativeNegligencePercent())
            .medicalProviders(entity.getMedicalProviders())
            .medicalExpensesTotal(entity.getMedicalExpensesTotal() != null ? java.math.BigDecimal.valueOf(entity.getMedicalExpensesTotal()) : null)
            .lostWages(entity.getLostWages() != null ? java.math.BigDecimal.valueOf(entity.getLostWages()) : null)
            .futureMedicalEstimate(entity.getFutureMedicalEstimate() != null ? java.math.BigDecimal.valueOf(entity.getFutureMedicalEstimate()) : null)
            .painSufferingMultiplier(entity.getPainSufferingMultiplier() != null ? java.math.BigDecimal.valueOf(entity.getPainSufferingMultiplier()) : null)
            .settlementDemandAmount(entity.getSettlementDemandAmount() != null ? java.math.BigDecimal.valueOf(entity.getSettlementDemandAmount()) : null)
            .settlementOfferAmount(entity.getSettlementOfferAmount() != null ? java.math.BigDecimal.valueOf(entity.getSettlementOfferAmount()) : null)
            .settlementFinalAmount(entity.getSettlementFinalAmount() != null ? java.math.BigDecimal.valueOf(entity.getSettlementFinalAmount()) : null)
            .settlementDate(entity.getSettlementDate())
            .insuranceCompany(entity.getInsuranceCompany())
            .insurancePolicyNumber(entity.getInsurancePolicyNumber())
            .insurancePolicyLimit(entity.getInsurancePolicyLimit() != null ? java.math.BigDecimal.valueOf(entity.getInsurancePolicyLimit()) : null)
            .insuranceAdjusterName(entity.getInsuranceAdjusterName())
            .insuranceAdjusterContact(entity.getInsuranceAdjusterContact())
            .insuranceAdjusterEmail(entity.getInsuranceAdjusterEmail())
            .insuranceAdjusterPhone(entity.getInsuranceAdjusterPhone())
            .employerName(entity.getEmployerName())
            .employerEmail(entity.getEmployerEmail())
            .employerPhone(entity.getEmployerPhone())
            .employerHrContact(entity.getEmployerHrContact())
            .defendantName(entity.getDefendantName())
            .defendantAddress(entity.getDefendantAddress())
            .build();
    }
    
    public LegalCase toEntity(LegalCaseDTO dto) {
        if (dto == null) {
            return null;
        }

        LegalCase entity = new LegalCase();
        entity.setId(dto.getId());
        entity.setOrganizationId(dto.getOrganizationId());
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
        // Personal Injury (PI) fields
        entity.setInjuryDate(dto.getInjuryDate());
        entity.setInjuryType(dto.getInjuryType());
        entity.setInjuryDescription(dto.getInjuryDescription());
        entity.setAccidentLocation(dto.getAccidentLocation());
        entity.setLiabilityAssessment(dto.getLiabilityAssessment());
        entity.setComparativeNegligencePercent(dto.getComparativeNegligencePercent());
        entity.setMedicalProviders(dto.getMedicalProviders());
        entity.setMedicalExpensesTotal(dto.getMedicalExpensesTotal() != null ? dto.getMedicalExpensesTotal().doubleValue() : null);
        entity.setLostWages(dto.getLostWages() != null ? dto.getLostWages().doubleValue() : null);
        entity.setFutureMedicalEstimate(dto.getFutureMedicalEstimate() != null ? dto.getFutureMedicalEstimate().doubleValue() : null);
        entity.setPainSufferingMultiplier(dto.getPainSufferingMultiplier() != null ? dto.getPainSufferingMultiplier().doubleValue() : null);
        entity.setSettlementDemandAmount(dto.getSettlementDemandAmount() != null ? dto.getSettlementDemandAmount().doubleValue() : null);
        entity.setSettlementOfferAmount(dto.getSettlementOfferAmount() != null ? dto.getSettlementOfferAmount().doubleValue() : null);
        entity.setSettlementFinalAmount(dto.getSettlementFinalAmount() != null ? dto.getSettlementFinalAmount().doubleValue() : null);
        entity.setSettlementDate(dto.getSettlementDate());
        entity.setInsuranceCompany(dto.getInsuranceCompany());
        entity.setInsurancePolicyNumber(dto.getInsurancePolicyNumber());
        entity.setInsurancePolicyLimit(dto.getInsurancePolicyLimit() != null ? dto.getInsurancePolicyLimit().doubleValue() : null);
        entity.setInsuranceAdjusterName(dto.getInsuranceAdjusterName());
        entity.setInsuranceAdjusterContact(dto.getInsuranceAdjusterContact());
        entity.setInsuranceAdjusterEmail(dto.getInsuranceAdjusterEmail());
        entity.setInsuranceAdjusterPhone(dto.getInsuranceAdjusterPhone());
        entity.setEmployerName(dto.getEmployerName());
        entity.setEmployerEmail(dto.getEmployerEmail());
        entity.setEmployerPhone(dto.getEmployerPhone());
        entity.setEmployerHrContact(dto.getEmployerHrContact());
        entity.setDefendantName(dto.getDefendantName());
        entity.setDefendantAddress(dto.getDefendantAddress());

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
        // Delegate to toEntity to avoid code duplication
        return toEntity(dto);
    }
} 