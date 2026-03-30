package com.bostoneo.bostoneosolutions.repository.implementation;

import com.bostoneo.bostoneosolutions.exception.ApiException;
import com.bostoneo.bostoneosolutions.model.CaseRoleAssignment;
import com.bostoneo.bostoneosolutions.model.LegalCase;
import com.bostoneo.bostoneosolutions.model.Role;
import com.bostoneo.bostoneosolutions.model.User;
import com.bostoneo.bostoneosolutions.multitenancy.TenantContext;
import com.bostoneo.bostoneosolutions.repository.CaseRoleAssignmentRepository;
import com.bostoneo.bostoneosolutions.repository.RoleRepository;
import com.bostoneo.bostoneosolutions.rowmapper.CaseRoleAssignmentRowMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static java.util.Map.of;
import static java.util.Objects.requireNonNull;

@Repository
@RequiredArgsConstructor
@Slf4j
public class CaseRoleAssignmentRepositoryImpl implements CaseRoleAssignmentRepository<CaseRoleAssignment> {

    private final NamedParameterJdbcTemplate jdbc;
    private final RoleRepository<Role> roleRepository;

    // SQL queries
    private static final String SAVE_CASE_ROLE_ASSIGNMENT = 
        "INSERT INTO case_role_assignments (case_id, user_id, role_id, expires_at) VALUES (:caseId, :userId, :roleId, :expiresAt)";
    // Unfiltered queries (for SUPERADMIN with null org context)
    private static final String FIND_BY_ID_UNFILTERED =
        "SELECT * FROM case_role_assignments WHERE id = :id";
    private static final String FIND_BY_USER_ID_UNFILTERED =
        "SELECT * FROM case_role_assignments WHERE user_id = :userId";
    private static final String FIND_BY_CASE_ID_UNFILTERED =
        "SELECT * FROM case_role_assignments WHERE case_id = :caseId";
    private static final String DELETE_BY_ID_UNFILTERED =
        "DELETE FROM case_role_assignments WHERE id = :id";
    private static final String DELETE_BY_CASE_AND_USER_UNFILTERED =
        "DELETE FROM case_role_assignments WHERE case_id = :caseId AND user_id = :userId";
    // SECURITY: Tenant-isolated queries for regular users
    private static final String FIND_BY_ID_FILTERED =
        "SELECT cra.* FROM case_role_assignments cra JOIN legal_cases lc ON cra.case_id = lc.id WHERE cra.id = :id AND lc.organization_id = :organizationId";
    private static final String FIND_BY_USER_ID_FILTERED =
        "SELECT cra.* FROM case_role_assignments cra JOIN legal_cases lc ON cra.case_id = lc.id WHERE cra.user_id = :userId AND lc.organization_id = :organizationId";
    private static final String FIND_BY_CASE_ID_FILTERED =
        "SELECT cra.* FROM case_role_assignments cra JOIN legal_cases lc ON cra.case_id = lc.id WHERE cra.case_id = :caseId AND lc.organization_id = :organizationId";
    private static final String DELETE_BY_ID_FILTERED =
        "DELETE FROM case_role_assignments WHERE id = :id AND case_id IN (SELECT id FROM legal_cases WHERE organization_id = :organizationId)";
    private static final String DELETE_BY_CASE_AND_USER_FILTERED =
        "DELETE FROM case_role_assignments WHERE case_id = :caseId AND user_id = :userId AND case_id IN (SELECT id FROM legal_cases WHERE organization_id = :organizationId)";
    private static final String CHECK_USER_CASE_ACCESS_QUERY = 
        "SELECT COUNT(*) > 0 FROM case_role_assignments WHERE user_id = :userId AND case_id = :caseId " +
        "AND (expires_at IS NULL OR expires_at > NOW())";

    @Override
    public CaseRoleAssignment save(CaseRoleAssignment assignment) {
        log.info("Saving case role assignment");
        try {
            KeyHolder keyHolder = new GeneratedKeyHolder();
            MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("caseId", assignment.getLegalCase().getId())
                .addValue("userId", assignment.getUser().getId())
                .addValue("roleId", assignment.getRole().getId())
                .addValue("expiresAt", assignment.getExpiresAt());

            jdbc.update(SAVE_CASE_ROLE_ASSIGNMENT, params, keyHolder, new String[]{"id"});
            assignment.setId(keyHolder.getKey().longValue());
            return assignment;
        } catch (Exception e) {
            log.error("Error saving case role assignment: {}", e.getMessage());
            throw new ApiException("Error saving case role assignment");
        }
    }

    @Override
    public Optional<CaseRoleAssignment> findById(Long id) {
        log.info("Finding case role assignment by id: {}", id);
        try {
            Long orgId = TenantContext.getCurrentTenant();
            // SUPERADMIN has null org — allow unfiltered access; regular users get tenant-filtered
            CaseRoleAssignment assignment = orgId != null
                ? jdbc.queryForObject(FIND_BY_ID_FILTERED, of("id", id, "organizationId", orgId), new CaseRoleAssignmentRowMapper(roleRepository))
                : jdbc.queryForObject(FIND_BY_ID_UNFILTERED, of("id", id), new CaseRoleAssignmentRowMapper(roleRepository));
            return Optional.ofNullable(assignment);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        } catch (Exception e) {
            log.error("Error finding case role assignment: {}", e.getMessage());
            throw new ApiException("Error finding case role assignment");
        }
    }

    @Override
    public Set<CaseRoleAssignment> findByUserId(Long userId) {
        log.info("Finding case role assignments by user id: {}", userId);
        try {
            Long orgId = TenantContext.getCurrentTenant();
            List<CaseRoleAssignment> results = orgId != null
                ? jdbc.query(FIND_BY_USER_ID_FILTERED, of("userId", userId, "organizationId", orgId), new CaseRoleAssignmentRowMapper(roleRepository))
                : jdbc.query(FIND_BY_USER_ID_UNFILTERED, of("userId", userId), new CaseRoleAssignmentRowMapper(roleRepository));
            return new HashSet<>(results);
        } catch (Exception e) {
            log.error("Error finding case role assignments: {}", e.getMessage());
            throw new ApiException("Error finding case role assignments");
        }
    }

    @Override
    public Set<CaseRoleAssignment> findByCaseId(Long caseId) {
        log.info("Finding case role assignments by case id: {}", caseId);
        try {
            Long orgId = TenantContext.getCurrentTenant();
            List<CaseRoleAssignment> results = orgId != null
                ? jdbc.query(FIND_BY_CASE_ID_FILTERED, of("caseId", caseId, "organizationId", orgId), new CaseRoleAssignmentRowMapper(roleRepository))
                : jdbc.query(FIND_BY_CASE_ID_UNFILTERED, of("caseId", caseId), new CaseRoleAssignmentRowMapper(roleRepository));
            return new HashSet<>(results);
        } catch (Exception e) {
            log.error("Error finding case role assignments: {}", e.getMessage());
            throw new ApiException("Error finding case role assignments");
        }
    }

    @Override
    public void deleteById(Long id) {
        log.info("Deleting case role assignment by id: {}", id);
        try {
            Long orgId = TenantContext.getCurrentTenant();
            if (orgId != null) {
                jdbc.update(DELETE_BY_ID_FILTERED, of("id", id, "organizationId", orgId));
            } else {
                jdbc.update(DELETE_BY_ID_UNFILTERED, of("id", id));
            }
        } catch (Exception e) {
            log.error("Error deleting case role assignment: {}", e.getMessage());
            throw new ApiException("Error deleting case role assignment");
        }
    }

    @Override
    public void deleteByCaseIdAndUserId(Long caseId, Long userId) {
        log.info("Deleting case role assignments by case id: {} and user id: {}", caseId, userId);
        try {
            Long orgId = TenantContext.getCurrentTenant();
            if (orgId != null) {
                jdbc.update(DELETE_BY_CASE_AND_USER_FILTERED, of("caseId", caseId, "userId", userId, "organizationId", orgId));
            } else {
                jdbc.update(DELETE_BY_CASE_AND_USER_UNFILTERED, of("caseId", caseId, "userId", userId));
            }
        } catch (Exception e) {
            log.error("Error deleting case role assignments: {}", e.getMessage());
            throw new ApiException("Error deleting case role assignments");
        }
    }

    @Override
    public Set<CaseRoleAssignment> getCaseRoleAssignments(Long userId) {
        return findByUserId(userId);
    }

    @Override
    public CaseRoleAssignment assignCaseRole(Long caseId, Long userId, Long roleId, LocalDateTime expiresAt) {
        log.info("Assigning role id: {} to user id: {} for case id: {}", roleId, userId, caseId);
        try {
            KeyHolder keyHolder = new GeneratedKeyHolder();
            MapSqlParameterSource parameters = new MapSqlParameterSource()
                .addValue("caseId", caseId)
                .addValue("userId", userId)
                .addValue("roleId", roleId)
                .addValue("expiresAt", expiresAt);
            
            jdbc.update(SAVE_CASE_ROLE_ASSIGNMENT, parameters, keyHolder, new String[]{"id"});
            
            // Create proper object structure using builders
            LegalCase legalCase = LegalCase.builder().id(caseId).build();
            User user = User.builder().id(userId).build();
            Role role = roleRepository.getRoleById(roleId);
            
            return CaseRoleAssignment.builder()
                .id(requireNonNull(keyHolder.getKey()).longValue())
                .legalCase(legalCase)
                .user(user)
                .role(role)
                .expiresAt(expiresAt)
                .build();
                
        } catch (Exception e) {
            log.error("Error assigning case role: {}", e.getMessage());
            throw new ApiException("Failed to assign case role: " + e.getMessage());
        }
    }

    @Override
    public void removeCaseRole(Long assignmentId) {
        log.info("Removing case role assignment by id: {}", assignmentId);
        try {
            Long orgId = TenantContext.getCurrentTenant();
            if (orgId != null) {
                jdbc.update(DELETE_BY_ID_FILTERED, of("id", assignmentId, "organizationId", orgId));
            } else {
                jdbc.update(DELETE_BY_ID_UNFILTERED, of("id", assignmentId));
            }
        } catch (Exception e) {
            log.error("Error removing case role: {}", e.getMessage());
            throw new ApiException("Failed to remove case role: " + e.getMessage());
        }
    }

    @Override
    public Set<CaseRoleAssignment> getCaseRoleAssignmentsByCase(Long caseId) {
        return findByCaseId(caseId);
    }

    @Override
    public boolean userHasCaseAccess(Long userId, Long caseId) {
        log.info("Checking user case access for user id: {} and case id: {}", userId, caseId);
        try {
            return Boolean.TRUE.equals(jdbc.queryForObject(
                CHECK_USER_CASE_ACCESS_QUERY,
                Map.of("userId", userId, "caseId", caseId),
                Boolean.class
            ));
        } catch (Exception e) {
            log.error("Error checking user case access: {}", e.getMessage());
            return false;
        }
    }
} 