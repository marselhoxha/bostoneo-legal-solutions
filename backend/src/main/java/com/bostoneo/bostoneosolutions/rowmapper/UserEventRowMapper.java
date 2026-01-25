package com.bostoneo.bostoneosolutions.rowmapper;

import com.bostoneo.bostoneosolutions.model.UserEvent;
import org.springframework.jdbc.core.RowMapper;

import java.sql.ResultSet;
import java.sql.SQLException;

public class UserEventRowMapper implements RowMapper<UserEvent> {
    @Override
    public UserEvent mapRow(ResultSet resultSet, int rowNum) throws SQLException {
        java.sql.Timestamp createdAtTimestamp = resultSet.getTimestamp("created_at");
        return UserEvent.builder()
                .id(resultSet.getLong("id"))
                .type(resultSet.getString("type"))
                .description(resultSet.getString("description"))
                .device(resultSet.getString("device"))
                .ipAddress(resultSet.getString("ip_address"))
                .createdAt(createdAtTimestamp != null ? createdAtTimestamp.toLocalDateTime() : java.time.LocalDateTime.now())
                .build();
    }
}
