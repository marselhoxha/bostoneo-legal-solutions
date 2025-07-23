package com.***REMOVED***.***REMOVED***solutions.controller;

import com.***REMOVED***.***REMOVED***solutions.model.User;
import com.***REMOVED***.***REMOVED***solutions.repository.UserRepository;
import com.***REMOVED***.***REMOVED***solutions.repository.RoleRepository;
import com.***REMOVED***.***REMOVED***solutions.model.Role;
import java.util.Set;
import java.util.List;
import java.util.Collection;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.GetMapping;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.HashMap;

@RestController
@RequestMapping("/api/test")
@RequiredArgsConstructor
public class TestUserController {
    
    private final UserRepository<User> userRepository;
    private final BCryptPasswordEncoder passwordEncoder;
    private final UserDetailsService userDetailsService;
    private final RoleRepository<Role> roleRepository;
    
    @PostMapping("/create-test-user")
    public Map<String, String> createTestUser() {
        try {
            // Check if user already exists
            User existingUser = null;
            try {
                existingUser = userRepository.getUserByEmail("marsel.hox@gmail.com");
            } catch (Exception e) {
                // User doesn't exist, will create new one
            }
            
            if (existingUser != null) {
                // Update password
                existingUser.setPassword(passwordEncoder.encode("1234"));
                existingUser.setEnabled(true);
                existingUser.setNotLocked(true);
                userRepository.update(existingUser);
                return Map.of("message", "User password updated", "email", "marsel.hox@gmail.com");
            }
            
            // Create new user
            User user = new User();
            user.setEmail("marsel.hox@gmail.com");
            user.setFirstName("Marsel");
            user.setLastName("Hox");
            user.setPassword(passwordEncoder.encode("1234"));
            user.setPhone("1234567890");
            user.setAddress("Test Address");
            user.setTitle("Developer");
            user.setImageUrl("/path/to/image.jpg");
            user.setEnabled(true);
            user.setNotLocked(true);
            user.setUsingMFA(false);
            user.setCreatedAt(LocalDateTime.now());
            
            userRepository.create(user);
            
            return Map.of(
                "message", "Test user created successfully",
                "email", user.getEmail(),
                "encodedPassword", user.getPassword()
            );
        } catch (Exception e) {
            return Map.of("error", e.getMessage());
        }
    }
    
    @PostMapping("/test-auth")
    public Map<String, Object> testAuth() {
        try {
            String email = "marsel.hox@gmail.com";
            String password = "1234";
            
            User user = userRepository.getUserByEmail(email);
            if (user == null) {
                return Map.of("error", "User not found");
            }
            
            boolean passwordMatches = passwordEncoder.matches(password, user.getPassword());
            
            // Generate a fresh hash for comparison
            String freshHash = passwordEncoder.encode(password);
            boolean freshMatches = passwordEncoder.matches(password, freshHash);
            
            Map<String, Object> result = new HashMap<>();
            result.put("email", email);
            result.put("userExists", true);
            result.put("passwordMatches", passwordMatches);
            result.put("userEnabled", user.isEnabled());
            result.put("userNotLocked", user.isNotLocked());
            result.put("usingMFA", user.isUsingMFA());
            result.put("userId", user.getId());
            result.put("storedPassword", user.getPassword());
            result.put("freshHash", freshHash);
            result.put("freshMatches", freshMatches);
            result.put("passwordLength", user.getPassword().length());
            result.put("startsWithBCrypt", user.getPassword().startsWith("$2a$"));
            return result;
        } catch (Exception e) {
            return Map.of("error", e.getMessage(), "stackTrace", e.getStackTrace()[0].toString());
        }
    }
    
    @PostMapping("/generate-hash")
    public Map<String, String> generateHash() {
        String password = "1234";
        String hash = passwordEncoder.encode(password);
        boolean matches = passwordEncoder.matches(password, hash);
        
        return Map.of(
            "password", password,
            "hash", hash,
            "matches", String.valueOf(matches)
        );
    }
    
    @PostMapping("/test-userdetails")
    public Map<String, Object> testUserDetails() {
        try {
            String email = "marsel.hox@gmail.com";
            
            UserDetails userDetails = userDetailsService.loadUserByUsername(email);
            
            Map<String, Object> result = new HashMap<>();
            result.put("email", email);
            result.put("username", userDetails.getUsername());
            result.put("enabled", userDetails.isEnabled());
            result.put("accountNonLocked", userDetails.isAccountNonLocked());
            result.put("accountNonExpired", userDetails.isAccountNonExpired());
            result.put("credentialsNonExpired", userDetails.isCredentialsNonExpired());
            result.put("authorities", userDetails.getAuthorities().stream()
                .map(auth -> auth.getAuthority())
                .collect(java.util.stream.Collectors.toList()));
            result.put("passwordLength", userDetails.getPassword().length());
            result.put("passwordStart", userDetails.getPassword().substring(0, 10));
            
            return result;
        } catch (Exception e) {
            return Map.of("error", e.getMessage(), "stackTrace", e.getStackTrace()[0].toString());
        }
    }
    
    @GetMapping("/check-roles")
    public Map<String, Object> checkRoles() {
        try {
            String email = "marsel.hox@gmail.com";
            User user = userRepository.getUserByEmail(email);
            
            if (user == null) {
                return Map.of("error", "User not found");
            }
            
            // Get all available roles
            Collection<Role> allRoles = roleRepository.list();
            
            // Get user's current roles
            Set<Role> userRoles = roleRepository.getRolesByUserId(user.getId());
            
            Map<String, Object> result = new HashMap<>();
            result.put("userId", user.getId());
            result.put("email", user.getEmail());
            result.put("userRolesCount", userRoles.size());
            result.put("userRoles", userRoles.stream()
                .map(role -> Map.of("id", role.getId(), "name", role.getName(), "permission", role.getPermission()))
                .collect(Collectors.toList()));
            result.put("allRolesCount", allRoles.size());
            result.put("allRoles", allRoles.stream()
                .map(role -> Map.of("id", role.getId(), "name", role.getName(), "permission", role.getPermission()))
                .collect(Collectors.toList()));
            
            return result;
        } catch (Exception e) {
            return Map.of("error", e.getMessage(), "stackTrace", e.getStackTrace()[0].toString());
        }
    }
    
    @PostMapping("/assign-admin-roles")
    public Map<String, Object> assignAdminRoles() {
        try {
            String email = "marsel.hox@gmail.com";
            User user = userRepository.getUserByEmail(email);
            
            if (user == null) {
                return Map.of("error", "User not found");
            }
            
            // Get all available roles
            Collection<Role> allRoles = roleRepository.list();
            
            // Filter admin roles (containing ADMIN, SUPER, MANAGER, etc.)
            List<Role> adminRoles = allRoles.stream()
                .filter(role -> 
                    role.getName().contains("ADMIN") || 
                    role.getName().contains("SUPER") || 
                    role.getName().contains("MANAGER") ||
                    role.getName().contains("SUPERVISOR") ||
                    role.getPermission().contains("ADMIN") ||
                    role.getPermission().contains("ALL")
                )
                .collect(Collectors.toList());
            
            // Also add basic USER role
            adminRoles.addAll(allRoles.stream()
                .filter(role -> role.getName().equals("ROLE_USER") || role.getName().equals("USER"))
                .collect(Collectors.toList()));
            
            // Assign roles to user
            int assignedCount = 0;
            for (Role role : adminRoles) {
                try {
                    roleRepository.addRoleToUser(user.getId(), role.getName());
                    assignedCount++;
                } catch (Exception e) {
                    // Role might already be assigned, continue
                }
            }
            
            // Get updated user roles
            Set<Role> updatedUserRoles = roleRepository.getRolesByUserId(user.getId());
            
            Map<String, Object> result = new HashMap<>();
            result.put("userId", user.getId());
            result.put("email", user.getEmail());
            result.put("rolesAssigned", assignedCount);
            result.put("totalUserRoles", updatedUserRoles.size());
            result.put("userRoles", updatedUserRoles.stream()
                .map(role -> Map.of("id", role.getId(), "name", role.getName(), "permission", role.getPermission()))
                .collect(Collectors.toList()));
            
            return result;
        } catch (Exception e) {
            return Map.of("error", e.getMessage(), "stackTrace", e.getStackTrace()[0].toString());
        }
    }
    
    @GetMapping("/test-file-star/{fileId}")
    public Map<String, Object> testFileStar(@org.springframework.web.bind.annotation.PathVariable Long fileId) {
        try {
            Map<String, Object> result = new HashMap<>();
            result.put("fileId", fileId);
            result.put("testMessage", "File star test endpoint is working");
            result.put("timestamp", java.time.LocalDateTime.now().toString());
            
            // This is a simple test endpoint to verify the star toggle issue
            // The actual star toggle is handled by FileManagerService.toggleFileStar()
            
            return result;
        } catch (Exception e) {
            return Map.of("error", e.getMessage(), "stackTrace", e.getStackTrace()[0].toString());
        }
    }
}