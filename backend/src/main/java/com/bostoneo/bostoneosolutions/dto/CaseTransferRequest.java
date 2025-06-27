package com.***REMOVED***.***REMOVED***solutions.dto;

import com.***REMOVED***.***REMOVED***solutions.enumeration.TransferUrgency;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CaseTransferRequest {
    
    @NotNull(message = "Case ID is required")
    private Long caseId;
    
    @NotNull(message = "From user ID is required")
    private Long fromUserId;
    
    @NotNull(message = "To user ID is required")
    private Long toUserId;
    
    @NotBlank(message = "Reason is required")
    private String reason;
    
    private TransferUrgency urgency = TransferUrgency.MEDIUM;
}