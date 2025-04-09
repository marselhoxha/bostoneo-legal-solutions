package com.***REMOVED***.***REMOVED***solutions.service.implementation;

import com.***REMOVED***.***REMOVED***solutions.model.Role;
import com.***REMOVED***.***REMOVED***solutions.repository.RoleRepository;
import com.***REMOVED***.***REMOVED***solutions.service.RoleService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Collection;

@Service
@RequiredArgsConstructor
public class RoleServiceImpl implements RoleService {

    private final RoleRepository<Role> roleRoleRepository;
    @Override
    public Role getRoleByUserId(Long id) {
        return roleRoleRepository.getRoleByUserId(id);
    }

    @Override
    public Collection<Role> getRoles() {
        return roleRoleRepository.list();
    }
}
