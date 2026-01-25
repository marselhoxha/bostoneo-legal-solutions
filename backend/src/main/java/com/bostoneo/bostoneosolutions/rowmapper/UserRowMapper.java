package com.bostoneo.bostoneosolutions.rowmapper;

import com.bostoneo.bostoneosolutions.model.User;
import org.springframework.jdbc.core.RowMapper;

import java.sql.ResultSet;
import java.sql.SQLException;

public class UserRowMapper implements RowMapper<User> {
    @Override
    public User mapRow(ResultSet resultSet, int rowNum) throws SQLException {
        java.sql.Timestamp createdAtTimestamp = resultSet.getTimestamp("created_at");
        return User.builder()
                .id(resultSet.getLong("id"))
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
                .build();

    }
}
