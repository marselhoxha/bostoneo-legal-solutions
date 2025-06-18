package com.***REMOVED***.***REMOVED***solutions.dtomapper;

import com.***REMOVED***.***REMOVED***solutions.dto.UserDTO;
import com.***REMOVED***.***REMOVED***solutions.model.Permission;
import com.***REMOVED***.***REMOVED***solutions.model.Role;
import com.***REMOVED***.***REMOVED***solutions.model.User;
import com.***REMOVED***.***REMOVED***solutions.model.UserPrincipal;
import org.springframework.beans.BeanUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Set;
import java.util.stream.Collectors;

public class UserDTOMapper {

    private static final Logger log = LoggerFactory.getLogger(UserDTOMapper.class);

    /**
     * Convert User entity to UserDTO with roles and permissions
     */
    public static UserDTO fromUser(User user, Set<Role> roles, Set<Permission> permissions) {
        UserDTO userDTO = new UserDTO();
        BeanUtils.copyProperties(user, userDTO);
        
        // Set primary role name (first role or empty)
        if (!roles.isEmpty()) {
            Role primaryRole = roles.iterator().next();
            userDTO.setRoleName(primaryRole.getName());
            
            // Set all role names
            userDTO.setRoles(roles.stream()
                .map(Role::getName)
                .collect(Collectors.toList()));
            
            // Log the roles being added
            log.info("Setting roles for user {}: {}", user.getEmail(), 
                userDTO.getRoles());
        }
        
        // Set permissions
        userDTO.setPermissions(permissions.stream()
            .map(Permission::getAuthority)
            .collect(Collectors.joining(",")));
            
        return userDTO;
    }
    
    /**
     * Convert User entity to UserDTO (basic version)
     */
    public static UserDTO fromUser(User user) {
        UserDTO userDTO = new UserDTO();
        BeanUtils.copyProperties(user, userDTO);
        return userDTO;
    }

    /**
     * Convert UserPrincipal to UserDTO
     */
    public static UserDTO fromUserPrincipal(UserPrincipal userPrincipal) {
        return fromUser(
            userPrincipal.getUser(), 
            userPrincipal.getRoles(),
            userPrincipal.getPermissions()
        );
    }

    /**
     * Convert UserDTO to User entity
     */
    public static User toUser(UserDTO userDTO) {
        User user = new User();
        BeanUtils.copyProperties(userDTO, user);
        return user;
    }
}

