package com.bostoneo.bostoneosolutions.testbuilder;

import com.bostoneo.bostoneosolutions.model.Role;

public class RoleTestBuilder {
    private Long id = 1L;
    private String name = "ROLE_USER";
    private String permission = "USER:READ";

    public static RoleTestBuilder aRole() {
        return new RoleTestBuilder();
    }

    public RoleTestBuilder withId(Long id) {
        this.id = id;
        return this;
    }

    public RoleTestBuilder withName(String name) {
        this.name = name;
        return this;
    }

    public RoleTestBuilder withPermission(String permission) {
        this.permission = permission;
        return this;
    }

    public Role build() {
        Role role = new Role();
        role.setId(id);
        role.setName(name);
        role.setPermission(permission);
        return role;
    }
}