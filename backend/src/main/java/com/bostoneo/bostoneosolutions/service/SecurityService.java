package com.bostoneo.bostoneosolutions.service;

public interface SecurityService {
    boolean isCurrentUser(Long userId);
    boolean canAccessCase(Long caseId);
    boolean hasAccessToCase(Long caseId);
    boolean hasAccessToTask(Long taskId);
    boolean isTaskAssignee(Long taskId);
    boolean canManageAssignments(Long caseId);
    boolean canApproveTransfers();
}