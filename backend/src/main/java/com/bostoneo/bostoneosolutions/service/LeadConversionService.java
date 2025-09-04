package com.***REMOVED***.***REMOVED***solutions.service;

import com.***REMOVED***.***REMOVED***solutions.model.Client;
import com.***REMOVED***.***REMOVED***solutions.model.ConflictCheck;
import com.***REMOVED***.***REMOVED***solutions.model.Lead;
import com.***REMOVED***.***REMOVED***solutions.model.LegalCase;

import java.util.List;
import java.util.Map;

public interface LeadConversionService {
    
    // Three conversion types as specified
    
    /**
     * Convert lead to Client Only
     * Creates client record with contact information only
     */
    Client convertToClientOnly(Long leadId, Map<String, Object> additionalClientData, Long convertedBy);
    
    /**
     * Convert lead to Matter/Case Only  
     * Creates legal case without full client profile
     */
    LegalCase convertToMatterOnly(Long leadId, Map<String, Object> caseData, Long convertedBy);
    
    /**
     * Convert lead to Client AND Matter
     * Complete conversion with both client and case records
     */
    ConversionResult convertToClientAndMatter(Long leadId, Map<String, Object> clientData, Map<String, Object> caseData, Long convertedBy);
    
    // Conflict checking operations
    ConflictCheck performConflictCheck(Long leadId, String conversionType, Long checkedBy);
    
    List<ConflictCheck> findConflictsByLead(Long leadId);
    
    ConflictCheck resolveConflict(Long conflictCheckId, String resolution, String resolutionNotes, Long resolvedBy);
    
    boolean hasUnresolvedConflicts(Long leadId);
    
    // Validation operations
    boolean validateClientData(Map<String, Object> clientData);
    
    boolean validateCaseData(Map<String, Object> caseData);
    
    boolean canConvertLead(Long leadId, String conversionType);
    
    // Conversion history and tracking
    List<ConversionResult> getConversionHistory(Long leadId);
    
    ConversionResult findConversionByLeadId(Long leadId);
    
    // Additional data collection support
    Map<String, Object> getRequiredClientFields();
    
    Map<String, Object> getRequiredCaseFields();
    
    Map<String, Object> getOptionalClientFields();
    
    Map<String, Object> getOptionalCaseFields();
    
    // Conversion workflow support
    ConversionResult initiateConversion(Long leadId, String conversionType, Long initiatedBy);
    
    ConversionResult completeConversion(Long conversionId, Map<String, Object> finalData, Long completedBy);
    
    ConversionResult cancelConversion(Long conversionId, String reason, Long cancelledBy);
    
    // Conversion result wrapper
    public static class ConversionResult {
        private Long id;
        private Long leadId;
        private String conversionType; // CLIENT_ONLY, MATTER_ONLY, CLIENT_AND_MATTER
        private String status; // INITIATED, IN_PROGRESS, COMPLETED, CANCELLED
        private Long clientId;
        private Long caseId;
        private List<ConflictCheck> conflictChecks;
        private String notes;
        private Long convertedBy;
        private java.sql.Timestamp convertedAt;
        private java.sql.Timestamp createdAt;
        private java.sql.Timestamp updatedAt;
        
        // Constructors, getters, and setters
        public ConversionResult() {}
        
        public ConversionResult(Long leadId, String conversionType, Long convertedBy) {
            this.leadId = leadId;
            this.conversionType = conversionType;
            this.convertedBy = convertedBy;
            this.status = "INITIATED";
            this.createdAt = new java.sql.Timestamp(System.currentTimeMillis());
            this.updatedAt = this.createdAt;
        }
        
        // Getters and setters
        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }
        
        public Long getLeadId() { return leadId; }
        public void setLeadId(Long leadId) { this.leadId = leadId; }
        
        public String getConversionType() { return conversionType; }
        public void setConversionType(String conversionType) { this.conversionType = conversionType; }
        
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        
        public Long getClientId() { return clientId; }
        public void setClientId(Long clientId) { this.clientId = clientId; }
        
        public Long getCaseId() { return caseId; }
        public void setCaseId(Long caseId) { this.caseId = caseId; }
        
        public List<ConflictCheck> getConflictChecks() { return conflictChecks; }
        public void setConflictChecks(List<ConflictCheck> conflictChecks) { this.conflictChecks = conflictChecks; }
        
        public String getNotes() { return notes; }
        public void setNotes(String notes) { this.notes = notes; }
        
        public Long getConvertedBy() { return convertedBy; }
        public void setConvertedBy(Long convertedBy) { this.convertedBy = convertedBy; }
        
        public java.sql.Timestamp getConvertedAt() { return convertedAt; }
        public void setConvertedAt(java.sql.Timestamp convertedAt) { this.convertedAt = convertedAt; }
        
        public java.sql.Timestamp getCreatedAt() { return createdAt; }
        public void setCreatedAt(java.sql.Timestamp createdAt) { this.createdAt = createdAt; }
        
        public java.sql.Timestamp getUpdatedAt() { return updatedAt; }
        public void setUpdatedAt(java.sql.Timestamp updatedAt) { this.updatedAt = updatedAt; }
        
        public boolean isClientConversion() {
            return "CLIENT_ONLY".equals(conversionType) || "CLIENT_AND_MATTER".equals(conversionType);
        }
        
        public boolean isCaseConversion() {
            return "MATTER_ONLY".equals(conversionType) || "CLIENT_AND_MATTER".equals(conversionType);
        }
        
        public boolean isComplete() {
            return "COMPLETED".equals(status);
        }
    }
}