package com.bostoneo.bostoneosolutions.rowmapper;

import com.bostoneo.bostoneosolutions.enums.ActionType;
import com.bostoneo.bostoneosolutions.enums.ResourceType;
import com.bostoneo.bostoneosolutions.model.Permission;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.RowMapper;

import java.sql.ResultSet;
import java.sql.SQLException;

/**
 * Maps database rows to Permission objects
 */
@Slf4j
public class PermissionRowMapper implements RowMapper<Permission> {

    @Override
    public Permission mapRow(ResultSet resultSet, int rowNum) throws SQLException {
        try {
            String resourceTypeStr = resultSet.getString("resource_type");
            String actionTypeStr = resultSet.getString("action_type");
            
            ResourceType resourceType;
            ActionType actionType;
            
            try {
                resourceType = ResourceType.valueOf(resourceTypeStr);
            } catch (IllegalArgumentException e) {
                
                resourceType = ResourceType.ADMINISTRATIVE;
            }
            
            try {
                actionType = ActionType.valueOf(actionTypeStr);
            } catch (IllegalArgumentException e) {
                
                actionType = ActionType.VIEW;
            }
            
            return Permission.builder()
                    .id(resultSet.getLong("id"))
                    .name(resultSet.getString("name"))
                    .description(resultSet.getString("description"))
                    .resourceType(resourceType)
                    .actionType(actionType)
                    .build();
        } catch (Exception e) {
            log.error("Error mapping permission row: {}", e.getMessage());
            // Return a minimal permission object to avoid breaking the application
            return Permission.builder()
                    .id(resultSet.getLong("id"))
                    .name(resultSet.getString("name"))
                    .description("Error mapping permission")
                    .resourceType(ResourceType.ADMINISTRATIVE)
                    .actionType(ActionType.VIEW)
                    .build();
        }
    }
} 