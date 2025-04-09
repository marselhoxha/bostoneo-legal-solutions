package com.bostoneo.bostoneosolutions.repository;


import com.bostoneo.bostoneosolutions.model.Role;

import java.util.Collection;

public interface RoleRepository <T extends Role> {
    /* Basic CRUD Operations */
    T create(T data);
    Collection<T> list ();
    T get(Long id);
    T update(T data);
    Boolean delete(Long id); //boolean to determine if the operation was successful

    /* More Complex Operations */
    void addRoleToUser(Long userId, String roleName);
    Role getRoleByUserId(Long userId);
    Role getRoleByEmail(String email);
    void updateUserRole(Long userId, String roleName);

}
