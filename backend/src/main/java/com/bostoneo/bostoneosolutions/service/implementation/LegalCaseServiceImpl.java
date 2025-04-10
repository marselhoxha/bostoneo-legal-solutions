package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.dto.LegalCaseDTO;
import com.bostoneo.bostoneosolutions.dtomapper.LegalCaseDTOMapper;
import com.bostoneo.bostoneosolutions.enumeration.CaseStatus;
import com.bostoneo.bostoneosolutions.exception.LegalCaseException;
import com.bostoneo.bostoneosolutions.model.LegalCase;
import com.bostoneo.bostoneosolutions.repository.LegalCaseRepository;
import com.bostoneo.bostoneosolutions.service.LegalCaseService;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

@Service
@Transactional
@RequiredArgsConstructor
@Slf4j
public class LegalCaseServiceImpl implements LegalCaseService {

    private final LegalCaseRepository legalCaseRepository;
    private final LegalCaseDTOMapper legalCaseDTOMapper;

    @Override
    public LegalCaseDTO createCase(LegalCaseDTO caseDTO) {
        LegalCase legalCase = legalCaseDTOMapper.toEntity(caseDTO);
        legalCase = legalCaseRepository.save(legalCase);
        return legalCaseDTOMapper.toDTO(legalCase);
    }

    @Override
    public LegalCaseDTO updateCase(Long id, LegalCaseDTO caseDTO) {
        LegalCase existingCase = legalCaseRepository.findById(id)
            .orElseThrow(() -> new LegalCaseException("Case not found with id: " + id));
        
        // Update fields from DTO
        existingCase.setTitle(caseDTO.getTitle());
        existingCase.setClientName(caseDTO.getClientName());
        existingCase.setClientEmail(caseDTO.getClientEmail());
        existingCase.setClientPhone(caseDTO.getClientPhone());
        existingCase.setClientAddress(caseDTO.getClientAddress());
        existingCase.setStatus(caseDTO.getStatus());
        existingCase.setPriority(caseDTO.getPriority());
        existingCase.setType(caseDTO.getType());
        existingCase.setDescription(caseDTO.getDescription());
        
        // Update court info
        existingCase.setCourtName(caseDTO.getCourtName());
        existingCase.setCourtroom(caseDTO.getCourtroom());
        existingCase.setJudgeName(caseDTO.getJudgeName());
        
        // Update important dates
        existingCase.setFilingDate(caseDTO.getFilingDate());
        existingCase.setNextHearing(caseDTO.getNextHearing());
        existingCase.setTrialDate(caseDTO.getTrialDate());
        
        // Update billing info
        existingCase.setHourlyRate(caseDTO.getHourlyRate());
        existingCase.setTotalHours(caseDTO.getTotalHours());
        existingCase.setTotalAmount(caseDTO.getTotalAmount());
        existingCase.setPaymentStatus(caseDTO.getPaymentStatus());
        
        existingCase = legalCaseRepository.save(existingCase);
        return legalCaseDTOMapper.toDTO(existingCase);
    }

    @Override
    public LegalCaseDTO getCase(Long id) {
        LegalCase legalCase = legalCaseRepository.findById(id)
            .orElseThrow(() -> new LegalCaseException("Case not found with id: " + id));
        return legalCaseDTOMapper.toDTO(legalCase);
    }

    @Override
    public LegalCaseDTO getCaseByNumber(String caseNumber) {
        LegalCase legalCase = legalCaseRepository.findByCaseNumber(caseNumber)
            .orElseThrow(() -> new LegalCaseException("Case not found with number: " + caseNumber));
        return legalCaseDTOMapper.toDTO(legalCase);
    }

    @Override
    public Page<LegalCaseDTO> getAllCases(int page, int size) {
        Page<LegalCase> cases = legalCaseRepository.findAll(PageRequest.of(page, size));
        return cases.map(legalCaseDTOMapper::toDTO);
    }

    @Override
    public Page<LegalCaseDTO> searchCasesByTitle(String title, int page, int size) {
        Page<LegalCase> cases = legalCaseRepository.findByTitleContainingIgnoreCase(title, PageRequest.of(page, size));
        return cases.map(legalCaseDTOMapper::toDTO);
    }

    @Override
    public Page<LegalCaseDTO> searchCasesByClientName(String clientName, int page, int size) {
        Page<LegalCase> cases = legalCaseRepository.findByClientNameContainingIgnoreCase(clientName, PageRequest.of(page, size));
        return cases.map(legalCaseDTOMapper::toDTO);
    }

    @Override
    public Page<LegalCaseDTO> getCasesByStatus(CaseStatus status, int page, int size) {
        Page<LegalCase> cases = legalCaseRepository.findByStatus(status, PageRequest.of(page, size));
        return cases.map(legalCaseDTOMapper::toDTO);
    }

    @Override
    public Page<LegalCaseDTO> getCasesByType(String type, int page, int size) {
        Page<LegalCase> cases = legalCaseRepository.findByType(type, PageRequest.of(page, size));
        return cases.map(legalCaseDTOMapper::toDTO);
    }

    @Override
    public void deleteCase(Long id) {
        if (!legalCaseRepository.existsById(id)) {
            throw new LegalCaseException("Case not found with id: " + id);
        }
        legalCaseRepository.deleteById(id);
    }

    @Override
    public LegalCaseDTO updateCaseStatus(Long id, CaseStatus status) {
        LegalCase legalCase = legalCaseRepository.findById(id)
            .orElseThrow(() -> new LegalCaseException("Case not found with id: " + id));
        legalCase.setStatus(status);
        legalCase = legalCaseRepository.save(legalCase);
        return legalCaseDTOMapper.toDTO(legalCase);
    }
} 