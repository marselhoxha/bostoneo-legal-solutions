package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.model.Role;

import java.util.Collection;

public interface RoleService {
    Role getRoleByUserId(Long id);
    Collection<Role> getRoles();
}
