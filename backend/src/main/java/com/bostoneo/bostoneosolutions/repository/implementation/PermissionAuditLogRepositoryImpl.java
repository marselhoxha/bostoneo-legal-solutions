package com.bostoneo.bostoneosolutions.repository.implementation;

import com.bostoneo.bostoneosolutions.exception.ApiException;
import com.bostoneo.bostoneosolutions.model.PermissionAuditLog;
import com.bostoneo.bostoneosolutions.repository.PermissionAuditLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static java.util.Map.of;

@Repository
@RequiredArgsConstructor
@Slf4j
public class PermissionAuditLogRepositoryImpl implements PermissionAuditLogRepository<PermissionAuditLog> {

    private final NamedParameterJdbcTemplate jdbc;

    // SQL queries
    private static final String INSERT_AUDIT_LOG = 
        "INSERT INTO permission_audit_logs (user_id, action, target_type, target_id, details, performed_by, timestamp) VALUES (:userId, :action, :targetType, :targetId, :details, :performedBy, :timestamp)";
    private static final String FIND_BY_USER_ID = 
        "SELECT * FROM permission_audit_logs WHERE user_id = :userId ORDER BY timestamp DESC";
    private static final String FIND_RECENT_LOGS = 
        "SELECT * FROM permission_audit_logs ORDER BY timestamp DESC LIMIT :limit";
    
    @Override
    public PermissionAuditLog save(PermissionAuditLog auditLog) {
        try {
            KeyHolder keyHolder = new GeneratedKeyHolder();
            MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("userId", auditLog.getUserId())
                .addValue("action", auditLog.getAction())
                .addValue("targetType", auditLog.getTargetType())
                .addValue("targetId", auditLog.getTargetId())
                .addValue("details", auditLog.getDetails())
                .addValue("performedBy", auditLog.getPerformedBy())
                .addValue("timestamp", auditLog.getTimestamp());

            jdbc.update(INSERT_AUDIT_LOG, params, keyHolder, new String[]{"id"});
            auditLog.setId(keyHolder.getKey().longValue());
            return auditLog;
        } catch (Exception e) {
            log.error("Error saving audit log: {}", e.getMessage());
            throw new ApiException("Error saving audit log");
        }
    }

    @Override
    public List<PermissionAuditLog> findByUserId(Long userId) {
        try {
            return jdbc.query(FIND_BY_USER_ID, of("userId", userId), new AuditLogRowMapper());
        } catch (Exception e) {
            log.error("Error finding audit logs: {}", e.getMessage());
            throw new ApiException("Error finding audit logs");
        }
    }

    @Override
    public List<PermissionAuditLog> findRecentLogs(int limit) {
        try {
            return jdbc.query(FIND_RECENT_LOGS, of("limit", limit), new AuditLogRowMapper());
        } catch (Exception e) {
            log.error("Error finding recent logs: {}", e.getMessage());
            throw new ApiException("Error finding recent logs");
        }
    }

    @Override
    public List<PermissionAuditLog> searchLogs(Long userId, String action, String targetType, 
                                            LocalDateTime startDate, LocalDateTime endDate, int limit) {
        try {
            StringBuilder sql = new StringBuilder("SELECT * FROM permission_audit_logs WHERE 1=1");
            Map<String, Object> params = new HashMap<>();
            
            if (userId != null) {
                sql.append(" AND user_id = :userId");
                params.put("userId", userId);
            }
            
            if (action != null && !action.isEmpty()) {
                sql.append(" AND action = :action");
                params.put("action", action);
            }
            
            if (targetType != null && !targetType.isEmpty()) {
                sql.append(" AND target_type = :targetType");
                params.put("targetType", targetType);
            }
            
            if (startDate != null) {
                sql.append(" AND timestamp >= :startDate");
                params.put("startDate", startDate);
            }
            
            if (endDate != null) {
                sql.append(" AND timestamp <= :endDate");
                params.put("endDate", endDate);
            }
            
            sql.append(" ORDER BY timestamp DESC LIMIT :limit");
            params.put("limit", limit);
            
            return jdbc.query(sql.toString(), params, new AuditLogRowMapper());
        } catch (Exception e) {
            log.error("Error searching logs: {}", e.getMessage());
            throw new ApiException("Error searching logs");
        }
    }
    
    /**
     * Row mapper for permission audit logs
     */
    private static class AuditLogRowMapper implements RowMapper<PermissionAuditLog> {
        @Override
        public PermissionAuditLog mapRow(ResultSet rs, int rowNum) throws SQLException {
            return PermissionAuditLog.builder()
                .id(rs.getLong("id"))
                .userId(rs.getLong("user_id"))
                .action(rs.getString("action"))
                .targetType(rs.getString("target_type"))
                .targetId(rs.getLong("target_id"))
                .details(rs.getString("details"))
                .performedBy(rs.getLong("performed_by"))
                .timestamp(rs.getTimestamp("timestamp").toLocalDateTime())
                .build();
        }
    }
} 