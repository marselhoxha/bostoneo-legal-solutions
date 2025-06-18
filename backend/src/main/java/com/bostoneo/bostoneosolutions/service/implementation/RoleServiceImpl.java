package com.***REMOVED***.***REMOVED***solutions.service.implementation;

import com.***REMOVED***.***REMOVED***solutions.model.CaseRoleAssignment;
import com.***REMOVED***.***REMOVED***solutions.model.Permission;
import com.***REMOVED***.***REMOVED***solutions.model.Role;
import com.***REMOVED***.***REMOVED***solutions.model.User;
import com.***REMOVED***.***REMOVED***solutions.repository.CaseRoleAssignmentRepository;
import com.***REMOVED***.***REMOVED***solutions.repository.PermissionRepository;
import com.***REMOVED***.***REMOVED***solutions.repository.RoleRepository;
import com.***REMOVED***.***REMOVED***solutions.repository.UserRepository;
import com.***REMOVED***.***REMOVED***solutions.service.RoleService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class RoleServiceImpl implements RoleService {

    private final RoleRepository<Role> roleRepository;
    private final CaseRoleAssignmentRepository<CaseRoleAssignment> caseRoleRepository;
    private final PermissionRepository<Permission> permissionRepository;
    private final UserRepository<User> userRepository;
    
    @Override
    public Role getRoleByUserId(Long id) {
        return roleRepository.getRoleByUserId(id);
    }

    @Override
    public Collection<Role> getRoles() {
        return roleRepository.list();
    }

    @Override
    public Role getRoleById(Long id) {
        return roleRepository.getRoleById(id);
    }

    @Override
    public Role getRoleByName(String name) {
        return roleRepository.getRoleByName(name);
    }

    @Override
    public Role createRole(Role role) {
        return roleRepository.create(role);
    }

    @Override
    public Role updateRole(Role role) {
        return roleRepository.update(role);
    }

    @Override
    public void deleteRole(Long id) {
        roleRepository.delete(id);
    }

    @Override
    public Set<Role> getRolesByUserId(Long userId) {
        return roleRepository.getRolesByUserId(userId);
    }

    @Override
    public void assignRoleToUser(Long userId, Long roleId) {
        Role role = getRoleById(roleId);
        if (role != null) {
            roleRepository.addRoleToUser(userId, role.getName());
        }
    }

    @Override
    public void removeRoleFromUser(Long userId, Long roleId) {
        roleRepository.removeRoleFromUser(userId, roleId);
    }

    @Override
    public Set<Permission> getPermissionsByRoleId(Long roleId) {
        return roleRepository.getPermissionsByRoleId(roleId);
    }

    @Override
    public void assignPermissionsToRole(Long roleId, List<Long> permissionIds) {
        roleRepository.assignPermissionsToRole(roleId, permissionIds);
    }

    @Override
    public void removePermissionFromRole(Long roleId, Long permissionId) {
        roleRepository.removePermissionFromRole(roleId, permissionId);
    }

    @Override
    public Set<CaseRoleAssignment> getCaseRoleAssignments(Long userId) {
        return caseRoleRepository.getCaseRoleAssignments(userId);
    }

    @Override
    public CaseRoleAssignment assignCaseRole(Long caseId, Long userId, Long roleId, LocalDateTime expiresAt) {
        return caseRoleRepository.assignCaseRole(caseId, userId, roleId, expiresAt);
    }

    @Override
    public void removeCaseRole(Long assignmentId) {
        caseRoleRepository.removeCaseRole(assignmentId);
    }

    @Override
    public Set<CaseRoleAssignment> getCaseRoleAssignmentsByCase(Long caseId) {
        return caseRoleRepository.getCaseRoleAssignmentsByCase(caseId);
    }
    
    @Override
    public List<Permission> getAllPermissions() {
        Collection<Permission> permissions = permissionRepository.findAll();
        return new ArrayList<>(permissions);
    }
    
    @Override
    public List<User> getUsersByRoleId(Long roleId) {
        return roleRepository.getUsersByRoleId(roleId);
    }
    
    @Override
    public void setPrimaryRole(Long userId, Long roleId) {
        roleRepository.setPrimaryRole(userId, roleId);
    }
    
    @Override
    public void setRoleExpiration(Long userId, Long roleId, LocalDateTime expiresAt) {
        roleRepository.setRoleExpiration(userId, roleId, expiresAt);
    }

    @Override
    public Set<Long> getUserCaseIds(Long userId) {
        Set<CaseRoleAssignment> assignments = getCaseRoleAssignments(userId);
        return assignments.stream()
            .filter(CaseRoleAssignment::isActive)
            .map(assignment -> assignment.getLegalCase().getId())
            .collect(Collectors.toSet());
    }
}
