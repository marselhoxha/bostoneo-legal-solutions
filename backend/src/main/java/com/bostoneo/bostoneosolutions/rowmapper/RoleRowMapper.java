package com.***REMOVED***.***REMOVED***solutions.rowmapper;

import com.***REMOVED***.***REMOVED***solutions.model.Role;
import org.springframework.jdbc.core.RowMapper;

import java.sql.ResultSet;
import java.sql.SQLException;

public class RoleRowMapper implements RowMapper<Role> {
    @Override
    public Role mapRow(ResultSet resultSet, int rowNum) throws SQLException {
        //(@SuperBuilder annotation) it creates a constructor and passes all the values using the setters and returning it to you
        return Role.builder()
                .id(resultSet.getLong("id"))
                .name(resultSet.getString("name"))
                .permission(resultSet.getString("permission"))
                .build();
    }
}
