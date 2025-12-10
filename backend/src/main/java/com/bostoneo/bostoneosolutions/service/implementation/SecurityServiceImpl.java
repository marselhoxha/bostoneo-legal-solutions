package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.model.CaseAssignment;
import com.bostoneo.bostoneosolutions.model.CaseTask;
import com.bostoneo.bostoneosolutions.model.User;
import com.bostoneo.bostoneosolutions.repository.CaseAssignmentRepository;
import com.bostoneo.bostoneosolutions.repository.CaseTaskRepository;
import com.bostoneo.bostoneosolutions.repository.UserRepository;
import com.bostoneo.bostoneosolutions.service.SecurityService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service("securityService")
@RequiredArgsConstructor
@Slf4j
public class SecurityServiceImpl implements SecurityService {
    
    private final UserRepository userRepository;
    private final CaseAssignmentRepository caseAssignmentRepository;
    private final CaseTaskRepository caseTaskRepository;
    
    @Override
    public boolean isCurrentUser(Long userId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getPrincipal() == null) {
            return false;
        }
        
        if (auth.getPrincipal() instanceof UserDTO) {
            UserDTO currentUser = (UserDTO) auth.getPrincipal();
            return currentUser.getId().equals(userId);
        }
        
        return false;
    }
    
    @Override
    public boolean hasAccessToCase(Long caseId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getPrincipal() == null) {
            return false;
        }
        
        // Check if user has general case access permission
        if (auth.getAuthorities().contains(new SimpleGrantedAuthority("case:read:all"))) {
            return true;
        }
        
        if (auth.getPrincipal() instanceof UserDTO) {
            UserDTO currentUser = (UserDTO) auth.getPrincipal();

            // Check if user is assigned to the case
            return !caseAssignmentRepository
                .findAllByCaseIdAndUserIdAndActive(caseId, currentUser.getId(), true)
                .isEmpty();
        }
        
        return false;
    }
    
    @Override
    public boolean hasAccessToTask(Long taskId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getPrincipal() == null) {
            return false;
        }
        
        // Check if user has general task access permission
        if (auth.getAuthorities().contains(new SimpleGrantedAuthority("task:read:all"))) {
            return true;
        }
        
        Optional<CaseTask> taskOpt = caseTaskRepository.findById(taskId);
        if (taskOpt.isEmpty()) {
            return false;
        }
        
        CaseTask task = taskOpt.get();
        
        if (auth.getPrincipal() instanceof UserDTO) {
            UserDTO currentUser = (UserDTO) auth.getPrincipal();
            
            // Check if user is the task assignee
            if (task.getAssignedTo() != null && task.getAssignedTo().getId().equals(currentUser.getId())) {
                return true;
            }
            
            // Check if user has access to the case
            return hasAccessToCase(task.getLegalCase().getId());
        }
        
        return false;
    }
    
    @Override
    public boolean isTaskAssignee(Long taskId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getPrincipal() == null) {
            return false;
        }
        
        Optional<CaseTask> taskOpt = caseTaskRepository.findById(taskId);
        if (taskOpt.isEmpty()) {
            return false;
        }
        
        CaseTask task = taskOpt.get();
        
        if (auth.getPrincipal() instanceof UserDTO) {
            UserDTO currentUser = (UserDTO) auth.getPrincipal();
            return task.getAssignedTo() != null && task.getAssignedTo().getId().equals(currentUser.getId());
        }
        
        return false;
    }
    
    @Override
    public boolean canManageAssignments(Long caseId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) {
            return false;
        }
        
        // Check for manager role or specific permission
        return auth.getAuthorities().stream()
            .anyMatch(authority -> 
                authority.getAuthority().equals("ROLE_MANAGER") ||
                authority.getAuthority().equals("ROLE_SENIOR_PARTNER") ||
                authority.getAuthority().equals("ROLE_MANAGING_PARTNER") ||
                authority.getAuthority().equals("case:assign")
            );
    }
    
    @Override
    public boolean canApproveTransfers() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) {
            return false;
        }
        
        // Check for manager role or specific permission
        return auth.getAuthorities().stream()
            .anyMatch(authority -> 
                authority.getAuthority().equals("ROLE_MANAGER") ||
                authority.getAuthority().equals("ROLE_SENIOR_PARTNER") ||
                authority.getAuthority().equals("ROLE_MANAGING_PARTNER") ||
                authority.getAuthority().equals("transfer:approve")
            );
    }
}