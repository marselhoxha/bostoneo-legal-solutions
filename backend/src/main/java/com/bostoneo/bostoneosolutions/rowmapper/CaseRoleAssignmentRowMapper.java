package com.***REMOVED***.***REMOVED***solutions.rowmapper;

import com.***REMOVED***.***REMOVED***solutions.model.CaseRoleAssignment;
import com.***REMOVED***.***REMOVED***solutions.model.LegalCase;
import com.***REMOVED***.***REMOVED***solutions.model.Role;
import com.***REMOVED***.***REMOVED***solutions.model.User;
import com.***REMOVED***.***REMOVED***solutions.repository.RoleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.RowMapper;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;

/**
 * Maps database rows to CaseRoleAssignment objects
 */
@RequiredArgsConstructor
public class CaseRoleAssignmentRowMapper implements RowMapper<CaseRoleAssignment> {

    private final RoleRepository<Role> roleRepository;

    @Override
    public CaseRoleAssignment mapRow(ResultSet rs, int rowNum) throws SQLException {
        Long id = rs.getLong("id");
        Long caseId = rs.getLong("case_id");
        Long userId = rs.getLong("user_id");
        Long roleId = rs.getLong("role_id");
        
        LocalDateTime expiresAt = null;
        if (rs.getTimestamp("expires_at") != null) {
            expiresAt = rs.getTimestamp("expires_at").toLocalDateTime();
        }
        
        // Create a LegalCase with just the ID
        LegalCase legalCase = LegalCase.builder()
                .id(caseId)
                .build();
        
        // Create a User with just the ID
        User user = User.builder()
                .id(userId)
                .build();
        
        // Get the full Role object
        Role role = roleRepository.getRoleById(roleId);
        
        // Build and return the CaseRoleAssignment
        return CaseRoleAssignment.builder()
                .id(id)
                .legalCase(legalCase)
                .user(user)
                .role(role)
                .expiresAt(expiresAt)
                .build();
    }
} 