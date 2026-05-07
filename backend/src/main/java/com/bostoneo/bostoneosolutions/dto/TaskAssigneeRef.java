package com.bostoneo.bostoneosolutions.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Lightweight projection of a User for the multi-assignee picker.
 * Carries just the bits the avatar stack and name label need; the full
 * User object stays out of CaseTaskDTO to keep payload small.
 *
 * V78: paired with the case_task_assignees join table.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class TaskAssigneeRef {
    private Long id;
    private String firstName;
    private String lastName;
    private String email;
}
