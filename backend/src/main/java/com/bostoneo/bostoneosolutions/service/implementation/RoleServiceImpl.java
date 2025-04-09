package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.model.Role;
import com.bostoneo.bostoneosolutions.repository.RoleRepository;
import com.bostoneo.bostoneosolutions.service.RoleService;
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
