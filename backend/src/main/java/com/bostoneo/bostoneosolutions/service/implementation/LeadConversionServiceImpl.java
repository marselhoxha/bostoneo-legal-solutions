package com.***REMOVED***.***REMOVED***solutions.service.implementation;

import com.***REMOVED***.***REMOVED***solutions.model.*;
import com.***REMOVED***.***REMOVED***solutions.repository.*;
import com.***REMOVED***.***REMOVED***solutions.service.LeadConversionService;
import com.***REMOVED***.***REMOVED***solutions.service.LeadService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class LeadConversionServiceImpl implements LeadConversionService {

    private final LeadRepository leadRepository;
    private final ClientRepository clientRepository;
    private final LegalCaseRepository legalCaseRepository;
    private final ConflictCheckRepository conflictCheckRepository;
    private final LeadService leadService;
    private final ObjectMapper objectMapper;

    @Override
    public Client convertToClientOnly(Long leadId, Map<String, Object> additionalClientData, Long convertedBy) {
        log.info("Converting lead ID: {} to Client Only by user: {}", leadId, convertedBy);
        
        Lead lead = leadRepository.findById(leadId)
            .orElseThrow(() -> new RuntimeException("Lead not found with ID: " + leadId));
        
        // Perform conflict check
        performConflictCheck(leadId, "CLIENT_ONLY", convertedBy);
        if (hasUnresolvedConflicts(leadId)) {
            throw new RuntimeException("Cannot convert lead due to unresolved conflicts");
        }
        
        // Validate client data
        if (!validateClientData(additionalClientData)) {
            throw new RuntimeException("Invalid client data provided");
        }
        
        // Create client from lead data
        Client client = createClientFromLead(lead, additionalClientData);
        client = clientRepository.save(client);
        
        // Update lead status to converted
        leadService.markAsConverted(leadId, convertedBy, "Converted to Client Only (ID: " + client.getId() + ")");
        
        // Add activity
        leadService.addActivity(leadId, "CONVERSION", "Converted to Client", 
            "Lead converted to Client Only (Client ID: " + client.getId() + ")", convertedBy);
        
        log.info("Successfully converted lead ID: {} to Client ID: {}", leadId, client.getId());
        return client;
    }

    @Override
    public LegalCase convertToMatterOnly(Long leadId, Map<String, Object> caseData, Long convertedBy) {
        log.info("Converting lead ID: {} to Matter Only by user: {}", leadId, convertedBy);
        
        Lead lead = leadRepository.findById(leadId)
            .orElseThrow(() -> new RuntimeException("Lead not found with ID: " + leadId));
        
        // Perform conflict check
        performConflictCheck(leadId, "MATTER_ONLY", convertedBy);
        if (hasUnresolvedConflicts(leadId)) {
            throw new RuntimeException("Cannot convert lead due to unresolved conflicts");
        }
        
        // Validate case data
        if (!validateCaseData(caseData)) {
            throw new RuntimeException("Invalid case data provided");
        }
        
        // Create case from lead data
        LegalCase legalCase = createCaseFromLead(lead, caseData);
        legalCase = legalCaseRepository.save(legalCase);
        
        // Update lead status to converted
        leadService.markAsConverted(leadId, convertedBy, "Converted to Matter Only (Case ID: " + legalCase.getId() + ")");
        
        // Add activity
        leadService.addActivity(leadId, "CONVERSION", "Converted to Matter", 
            "Lead converted to Matter Only (Case ID: " + legalCase.getId() + ")", convertedBy);
        
        log.info("Successfully converted lead ID: {} to Case ID: {}", leadId, legalCase.getId());
        return legalCase;
    }

    @Override
    public ConversionResult convertToClientAndMatter(Long leadId, Map<String, Object> clientData, Map<String, Object> caseData, Long convertedBy) {
        log.info("Converting lead ID: {} to Client AND Matter by user: {}", leadId, convertedBy);
        
        Lead lead = leadRepository.findById(leadId)
            .orElseThrow(() -> new RuntimeException("Lead not found with ID: " + leadId));
        
        // Perform conflict check
        ConflictCheck conflictCheck = performConflictCheck(leadId, "CLIENT_AND_MATTER", convertedBy);
        if (hasUnresolvedConflicts(leadId)) {
            throw new RuntimeException("Cannot convert lead due to unresolved conflicts");
        }
        
        // Validate both client and case data
        if (!validateClientData(clientData)) {
            throw new RuntimeException("Invalid client data provided");
        }
        if (!validateCaseData(caseData)) {
            throw new RuntimeException("Invalid case data provided");
        }
        
        // Create client first
        Client client = createClientFromLead(lead, clientData);
        client = clientRepository.save(client);
        
        // Create case and link to client
        LegalCase legalCase = createCaseFromLead(lead, caseData);
        legalCase.setClientName(client.getName());
        legalCase.setClientEmail(client.getEmail());
        legalCase.setClientPhone(client.getPhone());
        legalCase.setClientAddress(client.getAddress());
        legalCase = legalCaseRepository.save(legalCase);
        
        // Update lead status to converted
        leadService.markAsConverted(leadId, convertedBy, 
            "Converted to Client AND Matter (Client ID: " + client.getId() + ", Case ID: " + legalCase.getId() + ")");
        
        // Add activity
        leadService.addActivity(leadId, "CONVERSION", "Converted to Client & Matter", 
            "Lead converted to Client AND Matter (Client ID: " + client.getId() + ", Case ID: " + legalCase.getId() + ")", convertedBy);
        
        // Create conversion result
        ConversionResult result = new ConversionResult(leadId, "CLIENT_AND_MATTER", convertedBy);
        result.setClientId(client.getId());
        result.setCaseId(legalCase.getId());
        result.setStatus("COMPLETED");
        result.setConvertedAt(new Timestamp(System.currentTimeMillis()));
        result.setNotes("Complete conversion to both Client and Matter");
        result.setConflictChecks(Arrays.asList(conflictCheck));
        
        log.info("Successfully converted lead ID: {} to Client ID: {} and Case ID: {}", leadId, client.getId(), legalCase.getId());
        return result;
    }

    @Override
    public ConflictCheck performConflictCheck(Long leadId, String conversionType, Long checkedBy) {
        log.info("Performing conflict check for lead ID: {} with conversion type: {}", leadId, conversionType);
        
        Lead lead = leadRepository.findById(leadId)
            .orElseThrow(() -> new RuntimeException("Lead not found with ID: " + leadId));
        
        // Create conflict check record
        ConflictCheck conflictCheck = ConflictCheck.builder()
            .entityType("LEAD")
            .entityId(leadId)
            .checkType("CONVERSION_" + conversionType)
            .searchTerms(createSearchTermsJson(lead))
            .status("PENDING")
            .autoChecked(true)
            .checkedBy(checkedBy)
            .checkedAt(new Timestamp(System.currentTimeMillis()))
            .build();
        
        // Perform actual conflict detection
        List<String> conflicts = detectConflicts(lead);
        
        if (conflicts.isEmpty()) {
            conflictCheck.setStatus("NO_CONFLICT");
            conflictCheck.setConfidenceScore(new BigDecimal("100.00"));
            conflictCheck.setResults("{\"conflicts\": [], \"status\": \"clear\"}");
        } else {
            conflictCheck.setStatus("CONFLICT_FOUND");
            conflictCheck.setConfidenceScore(new BigDecimal("95.00"));
            try {
                conflictCheck.setResults(objectMapper.writeValueAsString(Map.of("conflicts", conflicts, "status", "conflicts_found")));
            } catch (Exception e) {
                log.error("Error serializing conflict results", e);
                conflictCheck.setResults("{\"conflicts\": [\"Serialization error\"], \"status\": \"error\"}");
            }
        }
        
        return conflictCheckRepository.save(conflictCheck);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ConflictCheck> findConflictsByLead(Long leadId) {
        return conflictCheckRepository.findByLeadId(leadId);
    }

    @Override
    public ConflictCheck resolveConflict(Long conflictCheckId, String resolution, String resolutionNotes, Long resolvedBy) {
        log.info("Resolving conflict ID: {} with resolution: {} by user: {}", conflictCheckId, resolution, resolvedBy);
        
        ConflictCheck conflictCheck = conflictCheckRepository.findById(conflictCheckId)
            .orElseThrow(() -> new RuntimeException("ConflictCheck not found with ID: " + conflictCheckId));
        
        conflictCheck.setResolution(resolution);
        conflictCheck.setResolutionNotes(resolutionNotes);
        conflictCheck.setResolvedBy(resolvedBy);
        conflictCheck.setResolvedAt(new Timestamp(System.currentTimeMillis()));
        conflictCheck.setStatus("RESOLVED");
        
        return conflictCheckRepository.save(conflictCheck);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean hasUnresolvedConflicts(Long leadId) {
        List<ConflictCheck> unresolvedConflicts = conflictCheckRepository.findUnresolvedByLeadId(leadId);
        return !unresolvedConflicts.isEmpty();
    }

    @Override
    public List<Map<String, Object>> getConflictDetails(Long leadId) {
        log.info("Getting conflict details for lead ID: {}", leadId);
        
        List<ConflictCheck> conflicts = conflictCheckRepository.findUnresolvedByLeadId(leadId);
        log.info("getConflictDetails found {} conflicts for lead ID: {}", conflicts.size(), leadId);
        
        List<Map<String, Object>> conflictDetails = new ArrayList<>();
        for (ConflictCheck conflict : conflicts) {
            Map<String, Object> conflictMap = new HashMap<>();
            conflictMap.put("type", conflict.getCheckType() != null ? conflict.getCheckType() : "GENERAL_CONFLICT");
            conflictMap.put("description", buildConflictDescription(conflict));
            conflictMap.put("severity", "WARNING");
            conflictMap.put("checkedAt", conflict.getCheckedAt());
            conflictMap.put("status", conflict.getStatus());
            conflictDetails.add(conflictMap);
        }
        
        return conflictDetails;
    }
    
    private String buildConflictDescription(ConflictCheck conflict) {
        if (conflict.getResults() != null && !conflict.getResults().isEmpty()) {
            return conflict.getResults();
        }
        
        // Fallback description based on conflict type
        String checkType = conflict.getCheckType();
        if ("CLIENT_NAME".equals(checkType)) {
            return "Potential client name conflict detected";
        } else if ("MATTER_CONFLICT".equals(checkType)) {
            return "Potential matter conflict detected";
        } else if ("ADVERSE_INTEREST".equals(checkType)) {
            return "Potential adverse interest conflict";
        } else {
            return "Conflict detected during conversion eligibility check";
        }
    }

    @Override
    @Transactional(readOnly = true)
    public boolean validateClientData(Map<String, Object> clientData) {
        if (clientData == null || clientData.isEmpty()) {
            return false;
        }
        
        // Required fields for client creation
        String[] requiredFields = {"name", "email"};
        for (String field : requiredFields) {
            if (!clientData.containsKey(field) || clientData.get(field) == null || 
                clientData.get(field).toString().trim().isEmpty()) {
                log.warn("Missing required client field: {}", field);
                return false;
            }
        }
        
        // Email validation
        String email = clientData.get("email").toString();
        if (!email.matches("^[A-Za-z0-9+_.-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$")) {
            log.warn("Invalid email format: {}", email);
            return false;
        }
        
        return true;
    }

    @Override
    @Transactional(readOnly = true)
    public boolean validateCaseData(Map<String, Object> caseData) {
        if (caseData == null || caseData.isEmpty()) {
            return false;
        }
        
        // Required fields for case creation
        String[] requiredFields = {"title", "type", "description"};
        for (String field : requiredFields) {
            if (!caseData.containsKey(field) || caseData.get(field) == null || 
                caseData.get(field).toString().trim().isEmpty()) {
                log.warn("Missing required case field: {}", field);
                return false;
            }
        }
        
        return true;
    }

    @Override
    public boolean canConvertLead(Long leadId, String conversionType) {
        Lead lead = leadRepository.findById(leadId).orElse(null);
        if (lead == null) {
            return false;
        }
        
        // Lead must be in convertible status
        List<String> convertibleStatuses = Arrays.asList("QUALIFIED", "CONSULTATION_SCHEDULED", "PROPOSAL_SENT", "NEGOTIATION");
        if (!convertibleStatuses.contains(lead.getStatus())) {
            log.warn("Lead ID: {} is not in convertible status. Current status: {}", leadId, lead.getStatus());
            return false;
        }
        
        // IMPORTANT: Clear any existing conflict records and perform fresh conflict detection
        // This ensures we detect current conflicts based on modified lead data
        log.info("Clearing existing conflicts and performing fresh conflict detection for lead ID: {}", leadId);
        clearExistingConflicts(leadId);
        performConflictCheck(leadId, conversionType, 1L); // Use system user ID 1
        
        // Check for unresolved conflicts (now that we've run detection)
        if (hasUnresolvedConflicts(leadId)) {
            log.warn("Lead ID: {} has unresolved conflicts after running detection", leadId);
            return false;
        }
        
        return true;
    }

    @Override
    @Transactional(readOnly = true)
    public List<ConversionResult> getConversionHistory(Long leadId) {
        // This would be implemented with a proper ConversionHistory entity in a full implementation
        // For now, return empty list
        return new ArrayList<>();
    }

    @Override
    @Transactional(readOnly = true)
    public ConversionResult findConversionByLeadId(Long leadId) {
        // This would query a ConversionHistory entity in a full implementation
        // For now, return null
        return null;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> getRequiredClientFields() {
        Map<String, Object> fields = new LinkedHashMap<>();
        fields.put("name", Map.of("type", "string", "description", "Client full name"));
        fields.put("email", Map.of("type", "email", "description", "Client email address"));
        return fields;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> getRequiredCaseFields() {
        Map<String, Object> fields = new LinkedHashMap<>();
        fields.put("title", Map.of("type", "string", "description", "Case title"));
        fields.put("type", Map.of("type", "string", "description", "Case type"));
        fields.put("description", Map.of("type", "text", "description", "Case description"));
        return fields;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> getOptionalClientFields() {
        Map<String, Object> fields = new LinkedHashMap<>();
        fields.put("phone", Map.of("type", "phone", "description", "Client phone number"));
        fields.put("address", Map.of("type", "text", "description", "Client address"));
        fields.put("type", Map.of("type", "select", "description", "Client type", "options", Arrays.asList("INDIVIDUAL", "BUSINESS")));
        return fields;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> getOptionalCaseFields() {
        Map<String, Object> fields = new LinkedHashMap<>();
        fields.put("priority", Map.of("type", "select", "description", "Case priority", "options", Arrays.asList("LOW", "MEDIUM", "HIGH", "URGENT")));
        fields.put("courtName", Map.of("type", "string", "description", "Court name"));
        fields.put("filingDate", Map.of("type", "date", "description", "Filing date"));
        fields.put("hourlyRate", Map.of("type", "number", "description", "Hourly rate"));
        return fields;
    }

    @Override
    public ConversionResult initiateConversion(Long leadId, String conversionType, Long initiatedBy) {
        log.info("Initiating conversion for lead ID: {} to type: {} by user: {}", leadId, conversionType, initiatedBy);
        
        if (!canConvertLead(leadId, conversionType)) {
            throw new RuntimeException("Lead cannot be converted at this time");
        }
        
        ConversionResult result = new ConversionResult(leadId, conversionType, initiatedBy);
        result.setStatus("INITIATED");
        
        // Add activity
        leadService.addActivity(leadId, "CONVERSION_INITIATED", "Conversion Initiated", 
            "Conversion to " + conversionType + " has been initiated", initiatedBy);
        
        return result;
    }

    @Override
    public ConversionResult completeConversion(Long conversionId, Map<String, Object> finalData, Long completedBy) {
        // This would be implemented with proper ConversionHistory entity storage
        // For now, return a basic result
        ConversionResult result = new ConversionResult();
        result.setId(conversionId);
        result.setStatus("COMPLETED");
        result.setConvertedAt(new Timestamp(System.currentTimeMillis()));
        result.setConvertedBy(completedBy);
        return result;
    }

    @Override
    public ConversionResult cancelConversion(Long conversionId, String reason, Long cancelledBy) {
        // This would be implemented with proper ConversionHistory entity storage
        ConversionResult result = new ConversionResult();
        result.setId(conversionId);
        result.setStatus("CANCELLED");
        result.setNotes("Cancelled: " + reason);
        result.setUpdatedAt(new Timestamp(System.currentTimeMillis()));
        return result;
    }

    private Client createClientFromLead(Lead lead, Map<String, Object> additionalData) {
        Client client = Client.builder()
            .name(lead.getFullName())
            .email(lead.getEmail())
            .phone(lead.getPhone())
            .type(getStringValue(additionalData, "type", "INDIVIDUAL"))
            .status(getStringValue(additionalData, "status", "ACTIVE"))
            .address(getStringValue(additionalData, "address"))
            .build();
        
        return client;
    }

    private LegalCase createCaseFromLead(Lead lead, Map<String, Object> caseData) {
        // Generate unique case number
        String caseNumber = generateCaseNumber();
        
        LegalCase legalCase = LegalCase.builder()
            .caseNumber(caseNumber)
            .title(getStringValue(caseData, "title"))
            .clientName(lead.getFullName())
            .clientEmail(lead.getEmail())
            .clientPhone(lead.getPhone())
            .status(com.***REMOVED***.***REMOVED***solutions.enumeration.CaseStatus.ACTIVE)
            .priority(com.***REMOVED***.***REMOVED***solutions.enumeration.CasePriority.valueOf(getStringValue(caseData, "priority", "MEDIUM")))
            .type(getStringValue(caseData, "type"))
            .description(getStringValue(caseData, "description"))
            .courtName(getStringValue(caseData, "courtName"))
            .hourlyRate(getDoubleValue(caseData, "hourlyRate", 0.0))
            .paymentStatus(com.***REMOVED***.***REMOVED***solutions.enumeration.PaymentStatus.PENDING)
            .build();
        
        return legalCase;
    }

    private String createSearchTermsJson(Lead lead) {
        try {
            Map<String, Object> searchTerms = new HashMap<>();
            searchTerms.put("name", lead.getFullName());
            searchTerms.put("email", lead.getEmail());
            if (lead.getPhone() != null) searchTerms.put("phone", lead.getPhone());
            if (lead.getCompany() != null) searchTerms.put("company", lead.getCompany());
            
            return objectMapper.writeValueAsString(searchTerms);
        } catch (Exception e) {
            log.error("Error creating search terms JSON", e);
            return "{\"name\":\"" + lead.getFullName() + "\"}";
        }
    }

    private List<String> detectConflicts(Lead lead) {
        List<String> conflicts = new ArrayList<>();
        
        // Check for existing clients with same name (case insensitive)
        String fullName = lead.getFullName();
        if (fullName != null && !fullName.trim().isEmpty()) {
            // Add specific logging for Emily Davis
            if (fullName.contains("Emily") || fullName.contains("Davis")) {
                log.info("EMILY DEBUG: Checking conflicts for lead: '{}' (ID: {}), email: '{}'", 
                    fullName, lead.getId(), lead.getEmail());
            }
            
            List<Client> existingClientsByName = clientRepository.findByNameIgnoreCase(fullName);
            
            // Add specific logging for Emily Davis
            if (fullName.contains("Emily") || fullName.contains("Davis")) {
                log.info("EMILY DEBUG: Found {} clients with matching name '{}'", 
                    existingClientsByName.size(), fullName);
                for (Client client : existingClientsByName) {
                    log.info("EMILY DEBUG: - Client ID: {}, Name: '{}', Email: '{}'", 
                        client.getId(), client.getName(), client.getEmail());
                }
            }
            
            for (Client existingClient : existingClientsByName) {
                conflicts.add("A client named \"" + existingClient.getName() + "\" already exists in your system (Client ID: " + existingClient.getId() + "). This may be the same person or a different client with the same name.");
            }
        }
        
        // Check for existing clients with same email
        if (lead.getEmail() != null && !lead.getEmail().trim().isEmpty()) {
            List<Client> existingClientsByEmail = clientRepository.findByEmail(lead.getEmail());
            
            // Add specific logging for Emily Davis
            if (lead.getEmail().contains("emily") || (fullName != null && fullName.contains("Emily"))) {
                log.info("EMILY DEBUG: Found {} clients with matching email '{}'", 
                    existingClientsByEmail.size(), lead.getEmail());
                for (Client client : existingClientsByEmail) {
                    log.info("EMILY DEBUG: - Client ID: {}, Name: '{}', Email: '{}'", 
                        client.getId(), client.getName(), client.getEmail());
                }
            }
            
            if (!existingClientsByEmail.isEmpty()) {
                for (Client existingClient : existingClientsByEmail) {
                    conflicts.add("A client with email \"" + existingClient.getEmail() + "\" already exists in your system (Client ID: " + existingClient.getId() + ").");
                }
            }
        }
        
        return conflicts;
    }

    private void clearExistingConflicts(Long leadId) {
        log.info("Clearing existing conflict records for lead ID: {}", leadId);
        List<ConflictCheck> existingConflicts = conflictCheckRepository.findByLeadId(leadId);
        if (!existingConflicts.isEmpty()) {
            log.info("Deleting {} existing conflict records for lead ID: {}", existingConflicts.size(), leadId);
            conflictCheckRepository.deleteAll(existingConflicts);
        }
    }

    private String generateCaseNumber() {
        // Generate unique case number - in reality would use a more sophisticated algorithm
        return "CASE-" + System.currentTimeMillis();
    }

    private String getStringValue(Map<String, Object> data, String key) {
        return getStringValue(data, key, null);
    }

    private String getStringValue(Map<String, Object> data, String key, String defaultValue) {
        Object value = data.get(key);
        return value != null ? value.toString() : defaultValue;
    }

    private Double getDoubleValue(Map<String, Object> data, String key, Double defaultValue) {
        Object value = data.get(key);
        if (value == null) return defaultValue;
        try {
            return Double.valueOf(value.toString());
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }
}