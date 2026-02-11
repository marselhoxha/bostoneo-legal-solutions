package com.bostoneo.bostoneosolutions.rowmapper;

import com.bostoneo.bostoneosolutions.model.User;
import org.springframework.jdbc.core.RowMapper;

import java.sql.ResultSet;
import java.sql.SQLException;

public class UserRowMapper implements RowMapper<User> {
    @Override
    public User mapRow(ResultSet resultSet, int rowNum) throws SQLException {
        java.sql.Timestamp createdAtTimestamp = resultSet.getTimestamp("created_at");

        // Get organization_id, handling potential null value
        Long organizationId = resultSet.getLong("organization_id");
        if (resultSet.wasNull()) {
            organizationId = null;
        }

        java.sql.Timestamp lockedUntilTimestamp = resultSet.getTimestamp("locked_until");

        return User.builder()
                .id(resultSet.getLong("id"))
                .organizationId(organizationId)
                .firstName(resultSet.getString("first_name"))
                .lastName(resultSet.getString("last_name"))
                .email(resultSet.getString("email"))
                .password(resultSet.getString("password"))
                .address(resultSet.getString("address"))
                .phone(resultSet.getString("phone"))
                .title(resultSet.getString("title"))
                .bio(resultSet.getString("bio"))
                .imageUrl(resultSet.getString("image_url"))
                .enabled(resultSet.getBoolean("enabled"))
                .usingMFA(resultSet.getBoolean("using_mfa"))
                .notLocked(resultSet.getBoolean("non_locked"))
                .createdAt(createdAtTimestamp != null ? createdAtTimestamp.toLocalDateTime() : java.time.LocalDateTime.now())
                .failedLoginAttempts(resultSet.getInt("failed_login_attempts"))
                .lockedUntil(lockedUntilTimestamp != null ? lockedUntilTimestamp.toLocalDateTime() : null)
                .build();

    }
}
