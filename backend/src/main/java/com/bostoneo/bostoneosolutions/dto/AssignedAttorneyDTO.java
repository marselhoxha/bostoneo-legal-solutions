package com.bostoneo.bostoneosolutions.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

/**
 * Lightweight DTO for attorney assignment info displayed in case lists.
 * This is a simplified version of CaseAssignmentDTO for UI display purposes.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AssignedAttorneyDTO {
    private Long id;
    private String firstName;
    private String lastName;
    private String email;
    private String roleType;
    private Double workloadWeight;
    private Long assignmentId;
    private Date assignedAt;
    private Boolean active;
}
