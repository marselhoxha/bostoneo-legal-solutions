package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.PermissionAuditLog;

import java.time.LocalDateTime;
import java.util.List;

public interface PermissionAuditLogRepository<T extends PermissionAuditLog> {
    T save(T log);
    List<T> findByUserId(Long userId);
    List<T> findRecentLogs(int limit);
    List<T> searchLogs(Long userId, String action, String targetType, 
                     LocalDateTime startDate, LocalDateTime endDate, int limit);
} 