package com.bostoneo.bostoneosolutions.rowmapper;

import com.bostoneo.bostoneosolutions.model.UserEvent;
import org.springframework.jdbc.core.RowMapper;

import java.sql.ResultSet;
import java.sql.SQLException;

public class UserEventRowMapper implements RowMapper<UserEvent> {
    @Override
    public UserEvent mapRow(ResultSet resultSet, int rowNum) throws SQLException {
        java.sql.Timestamp createdAtTimestamp = resultSet.getTimestamp("created_at");

        // SECURITY: Try to get organization_id if present in result set
        Long organizationId = null;
        try {
            organizationId = resultSet.getLong("organization_id");
            if (resultSet.wasNull()) {
                organizationId = null;
            }
        } catch (SQLException e) {
            // Column not present in this query - backwards compatibility
        }

        return UserEvent.builder()
                .id(resultSet.getLong("id"))
                .organizationId(organizationId)
                .type(resultSet.getString("type"))
                .description(resultSet.getString("description"))
                .device(resultSet.getString("device"))
                .ipAddress(resultSet.getString("ip_address"))
                .createdAt(createdAtTimestamp != null ? createdAtTimestamp.toLocalDateTime() : java.time.LocalDateTime.now())
                .build();
    }
}
