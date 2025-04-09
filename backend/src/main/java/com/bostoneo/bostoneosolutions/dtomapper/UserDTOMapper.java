package com.***REMOVED***.***REMOVED***solutions.dtomapper;

import com.***REMOVED***.***REMOVED***solutions.dto.UserDTO;
import com.***REMOVED***.***REMOVED***solutions.model.Role;
import com.***REMOVED***.***REMOVED***solutions.model.User;
import org.springframework.beans.BeanUtils;


public class UserDTOMapper {

    public static UserDTO fromUser(User user) {
        UserDTO userDTO = new UserDTO();
        BeanUtils.copyProperties(user, userDTO);

        // Logging to debug
        System.out.println("User Entity: " + user);
        System.out.println("UserDTO: " + userDTO);

        return userDTO;
    }

    public static UserDTO fromUser(User user, Role role) {
        UserDTO userDTO = new UserDTO();
        BeanUtils.copyProperties(user, userDTO);
        userDTO.setRoleName(role.getName());
        userDTO.setPermissions(role.getPermission());

        // Logging to debug
        System.out.println("User Entity: " + user);
        System.out.println("Role Entity: " + role);
        System.out.println("UserDTO: " + userDTO);

        return userDTO;
    }

    public static User toUser(UserDTO userDTO) {
        User user = new User();
        BeanUtils.copyProperties(userDTO, user);

        // Logging to debug
        System.out.println("UserDTO: " + userDTO);
        System.out.println("User Entity: " + user);

        return user;
    }
}
