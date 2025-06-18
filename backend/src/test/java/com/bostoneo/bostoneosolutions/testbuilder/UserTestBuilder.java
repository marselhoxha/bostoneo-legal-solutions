package com.***REMOVED***.***REMOVED***solutions.testbuilder;

import com.***REMOVED***.***REMOVED***solutions.model.Role;
import com.***REMOVED***.***REMOVED***solutions.model.User;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

public class UserTestBuilder {
    private Long id = 1L;
    private String firstName = "John";
    private String lastName = "Doe";
    private String email = "john.doe@example.com";
    private String password = "$2a$10$hashed_password";
    private String address = "123 Main St";
    private String phone = "+1234567890";
    private String title = "Attorney";
    private String bio = "Test bio";
    private String imageUrl = "https://example.com/image.jpg";
    private boolean enabled = true;
    private boolean isNotLocked = true;
    private boolean isUsingMFA = false;
    private LocalDateTime createdAt = LocalDateTime.now();
    private Set<Role> roles = new HashSet<>();

    public static UserTestBuilder aUser() {
        return new UserTestBuilder();
    }

    public UserTestBuilder withId(Long id) {
        this.id = id;
        return this;
    }

    public UserTestBuilder withEmail(String email) {
        this.email = email;
        return this;
    }

    public UserTestBuilder withFirstName(String firstName) {
        this.firstName = firstName;
        return this;
    }

    public UserTestBuilder withLastName(String lastName) {
        this.lastName = lastName;
        return this;
    }

    public UserTestBuilder withPassword(String password) {
        this.password = password;
        return this;
    }

    public UserTestBuilder withRole(Role role) {
        this.roles.add(role);
        return this;
    }

    public UserTestBuilder withRoles(Set<Role> roles) {
        this.roles = roles;
        return this;
    }

    public UserTestBuilder withEnabled(boolean enabled) {
        this.enabled = enabled;
        return this;
    }

    public UserTestBuilder withLocked(boolean isLocked) {
        this.isNotLocked = !isLocked;
        return this;
    }

    public User build() {
        User user = new User();
        user.setId(id);
        user.setFirstName(firstName);
        user.setLastName(lastName);
        user.setEmail(email);
        user.setPassword(password);
        user.setAddress(address);
        user.setPhone(phone);
        user.setTitle(title);
        user.setBio(bio);
        user.setImageUrl(imageUrl);
        user.setEnabled(enabled);
        user.setNotLocked(isNotLocked);
        user.setUsingMFA(isUsingMFA);
        user.setCreatedAt(createdAt);
        user.setRoles(roles);
        return user;
    }
}