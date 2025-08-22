package com.***REMOVED***.***REMOVED***solutions.service.implementation;

import com.***REMOVED***.***REMOVED***solutions.dto.UserDTO;
import com.***REMOVED***.***REMOVED***solutions.dtomapper.UserDTOMapper;
import com.***REMOVED***.***REMOVED***solutions.exception.ApiException;
import com.***REMOVED***.***REMOVED***solutions.form.UpdateForm;
import com.***REMOVED***.***REMOVED***solutions.model.Permission;
import com.***REMOVED***.***REMOVED***solutions.model.Role;
import com.***REMOVED***.***REMOVED***solutions.model.User;
import com.***REMOVED***.***REMOVED***solutions.repository.RoleRepository;
import com.***REMOVED***.***REMOVED***solutions.repository.UserRepository;
import com.***REMOVED***.***REMOVED***solutions.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.util.Collection;
import java.util.HashSet;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {
    private final UserRepository<User> userRepository;
    private final RoleRepository<Role> roleRepository;

    @Override
    public UserDTO createUser(User user) {
        return mapToUserDTO(userRepository.create(user));
    }

    @Override
    public UserDTO getUserByEmail(String email) {
        return mapToUserDTO(userRepository.getUserByEmail(email));
    }

    @Override
    public void sendVerificationCode(UserDTO user) {
        userRepository.sendVerificationCode(user);
    }

    @Override
    public UserDTO verifyCode(String email, String code) {
        return mapToUserDTO(userRepository.verifyCode(email, code));
    }

    @Override
    public void resetPassword(String email) {
        userRepository.resetPassword(email);
    }

    @Override
    public UserDTO verifyPasswordKey(String key) {
        return mapToUserDTO(userRepository.verifyPasswordKey(key));
    }

    @Override
    public void updatePassword(Long userId, String password, String confirmPassword) {
        userRepository.renewPassword(userId, password, confirmPassword);
    }

    @Override
    public UserDTO verifyAccountKey(String key) {
        return mapToUserDTO(userRepository.verifyAccountKey(key));
    }

    @Override
    public UserDTO updateUserDetails(UpdateForm user) {
        return mapToUserDTO(userRepository.updateUserDetails(user));
    }

    @Override
    public UserDTO getUserById(Long userId) {
        return mapToUserDTO(userRepository.findByIdWithRoles(userId));
    }

    @Override
    public void updatePassword(Long id, String currentPassword, String newPassword, String confirmNewPassword) {
        userRepository.updatePassword(id, currentPassword, newPassword, confirmNewPassword);
    }

    @Override
    public void updateUserRole(Long userId, String roleName) {
        roleRepository.updateUserRole(userId, roleName);
    }

    @Override
    public void updateAccountSettings(Long userId, Boolean enabled, Boolean notLocked) {
        userRepository.updateAccountSettings(userId, enabled, notLocked);
    }

    @Override
    public UserDTO toggleMfa(String email) {
        return mapToUserDTO(userRepository.toggleMfa(email));
    }

    @Override
    public void updateImage(UserDTO user, MultipartFile image) {
        userRepository.updateImage(user, image);
    }

    /**
     * Get a list of users with pagination
     */
    public Collection<User> getUsers(int page, int pageSize) {
        return userRepository.list(page, pageSize);
    }

    @Override
    public void deleteUser(Long userId) {
        // Check if user exists before deletion
        User user = userRepository.get(userId);
        if (user == null) {
            throw new ApiException("User not found with ID: " + userId);
        }
        
        // Delete the user
        userRepository.delete(userId);
    }

    private UserDTO mapToUserDTO(User user) {
        // Get roles for this user
        Set<Role> roles = roleRepository.getRolesByUserId(user.getId());
        
        // Get permissions for all roles
        Set<Permission> permissions = new HashSet<>();
        for (Role role : roles) {
            permissions.addAll(roleRepository.getPermissionsByRoleId(role.getId()));
        }
        
        return UserDTOMapper.fromUser(user, roles, permissions);
    }
}