package com.bostoneo.bostoneosolutions.dto;

import com.bostoneo.bostoneosolutions.enumeration.TransferStatus;
import com.bostoneo.bostoneosolutions.enumeration.TransferUrgency;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CaseTransferRequestDTO {
    private Long id;
    private Long caseId;
    private String caseNumber;
    private String caseTitle;
    private Long fromUserId;
    private String fromUserName;
    private Long toUserId;
    private String toUserName;
    private String requestedByName;
    private String reason;
    private TransferUrgency urgency;
    private TransferStatus status;
    private String approvedByName;
    private String approvalNotes;
    private LocalDateTime requestedAt;
    private LocalDateTime processedAt;
}