package com.***REMOVED***.***REMOVED***solutions.repository.implementation;

import com.***REMOVED***.***REMOVED***solutions.exception.ApiException;
import com.***REMOVED***.***REMOVED***solutions.model.PermissionAuditLog;
import com.***REMOVED***.***REMOVED***solutions.repository.PermissionAuditRepository;
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
import java.util.List;

import static java.util.Map.of;

@Repository
@RequiredArgsConstructor
@Slf4j
public class PermissionAuditRepositoryImpl implements PermissionAuditRepository<PermissionAuditLog> {

    private final NamedParameterJdbcTemplate jdbc;

    // SQL queries
    private static final String INSERT_AUDIT_LOG = 
        "INSERT INTO permission_audit_logs (user_id, action, target_type, target_id, details, performed_by, timestamp) VALUES (:userId, :action, :targetType, :targetId, :details, :performedBy, :timestamp)";
    private static final String FIND_BY_USER_ID = 
        "SELECT * FROM permission_audit_logs WHERE user_id = :userId ORDER BY timestamp DESC LIMIT :limit";
    private static final String FIND_RECENT_LOGS = 
        "SELECT * FROM permission_audit_logs ORDER BY timestamp DESC LIMIT :limit";
    
    @Override
    public PermissionAuditLog create(PermissionAuditLog auditLog) {
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
            log.error("Error creating audit log: {}", e.getMessage());
            throw new ApiException("Error creating audit log");
        }
    }

    @Override
    public List<PermissionAuditLog> getRecentLogs(int limit) {
        try {
            return jdbc.query(FIND_RECENT_LOGS, of("limit", limit), new AuditLogRowMapper());
        } catch (Exception e) {
            log.error("Error getting recent logs: {}", e.getMessage());
            throw new ApiException("Error getting recent logs");
        }
    }

    @Override
    public List<PermissionAuditLog> getLogsByUserId(Long userId, int limit) {
        try {
            return jdbc.query(FIND_BY_USER_ID, of("userId", userId, "limit", limit), new AuditLogRowMapper());
        } catch (Exception e) {
            log.error("Error getting logs by user ID: {}", e.getMessage());
            throw new ApiException("Error getting logs by user ID");
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