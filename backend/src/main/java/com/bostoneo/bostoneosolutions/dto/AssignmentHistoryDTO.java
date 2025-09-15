package com.bostoneo.bostoneosolutions.dto;

import com.bostoneo.bostoneosolutions.enumeration.AssignmentAction;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AssignmentHistoryDTO {
    private Long id;
    private Long caseAssignmentId;
    private Long caseId;
    private String caseNumber;
    private Long userId;
    private String userName;
    private AssignmentAction action;
    private String previousUserName;
    private String newUserName;
    private String reason;
    private String performedByName;
    private LocalDateTime performedAt;
    private Map<String, Object> metadata;
}