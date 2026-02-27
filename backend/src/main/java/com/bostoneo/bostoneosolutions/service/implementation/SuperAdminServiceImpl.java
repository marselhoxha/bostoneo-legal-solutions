package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.dto.superadmin.*;
import com.bostoneo.bostoneosolutions.enumeration.CaseStatus;
import com.bostoneo.bostoneosolutions.enumeration.InvoiceStatus;
import com.bostoneo.bostoneosolutions.enumeration.VerificationType;
import com.bostoneo.bostoneosolutions.exception.ApiException;
import com.bostoneo.bostoneosolutions.model.*;
import com.bostoneo.bostoneosolutions.model.PlatformAnnouncement;
import com.bostoneo.bostoneosolutions.repository.*;
import com.bostoneo.bostoneosolutions.rowmapper.UserRowMapper;
import com.bostoneo.bostoneosolutions.service.EmailService;
import com.bostoneo.bostoneosolutions.service.NotificationService;
import com.bostoneo.bostoneosolutions.service.SuperAdminService;
import com.bostoneo.bostoneosolutions.service.TokenBlacklistService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Implementation of SuperAdminService.
 * Provides cross-organization data access for SUPERADMIN users.
 * IMPORTANT: This service bypasses tenant filtering intentionally.
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class SuperAdminServiceImpl implements SuperAdminService {

    private final OrganizationRepository organizationRepository;
    private final LegalCaseRepository legalCaseRepository;
    private final ClientRepository clientRepository;
    private final InvoiceRepository invoiceRepository;
    private final AuditLogRepository auditLogRepository;
    private final PlatformAnnouncementRepository platformAnnouncementRepository;
    private final NamedParameterJdbcTemplate jdbc;
    private final RoleRepository<Role> roleRepository;
    private final EmailService emailService;
    private final NotificationService notificationService;
    private final BCryptPasswordEncoder passwordEncoder;
    private final TokenBlacklistService tokenBlacklistService;

    @Value("${UI_APP_URL:http://localhost:4200}")
    private String frontendBaseUrl;

    // SQL queries for cross-organization user access
    private static final String SELECT_ALL_USERS_PAGINATED =
        "SELECT * FROM users ORDER BY id LIMIT :pageSize OFFSET :offset";
    private static final String COUNT_ALL_USERS =
        "SELECT COUNT(*) FROM users";
    private static final String SELECT_USERS_BY_ORG_PAGINATED =
        "SELECT * FROM users WHERE organization_id = :organizationId ORDER BY id LIMIT :pageSize OFFSET :offset";
    private static final String COUNT_USERS_BY_ORG =
        "SELECT COUNT(*) FROM users WHERE organization_id = :organizationId";
    private static final String SEARCH_USERS_QUERY =
        "SELECT * FROM users WHERE LOWER(first_name) LIKE LOWER(:query) OR LOWER(last_name) LIKE LOWER(:query) OR LOWER(email) LIKE LOWER(:query) ORDER BY id LIMIT :pageSize OFFSET :offset";
    private static final String COUNT_SEARCH_USERS =
        "SELECT COUNT(*) FROM users WHERE LOWER(first_name) LIKE LOWER(:query) OR LOWER(last_name) LIKE LOWER(:query) OR LOWER(email) LIKE LOWER(:query)";
    private static final String COUNT_ACTIVE_USERS_LAST_N_DAYS =
        "SELECT COUNT(DISTINCT user_id) FROM audit_log WHERE timestamp >= :since AND user_id IS NOT NULL";

    @Override
    public PlatformStatsDTO getPlatformStats() {
        log.info("SUPERADMIN: Fetching platform-wide statistics");

        // Organization counts
        List<Organization> allOrgs = organizationRepository.findAll();
        int totalOrgs = allOrgs.size();
        int activeOrgs = (int) allOrgs.stream()
            .filter(o -> o.getStatus() == Organization.OrganizationStatus.ACTIVE)
            .count();
        int suspendedOrgs = (int) allOrgs.stream()
            .filter(o -> o.getStatus() == Organization.OrganizationStatus.SUSPENDED)
            .count();

        // User counts
        Integer totalUsers = jdbc.queryForObject(COUNT_ALL_USERS, new MapSqlParameterSource(), Integer.class);

        // Active users in last 7 days
        LocalDateTime sevenDaysAgo = LocalDateTime.now().minusDays(7);
        Integer activeUsersLast7Days = jdbc.queryForObject(COUNT_ACTIVE_USERS_LAST_N_DAYS,
            new MapSqlParameterSource().addValue("since", sevenDaysAgo), Integer.class);

        // Active users in last 30 days
        LocalDateTime thirtyDaysAgo = LocalDateTime.now().minusDays(30);
        Integer activeUsersLast30Days = jdbc.queryForObject(COUNT_ACTIVE_USERS_LAST_N_DAYS,
            new MapSqlParameterSource().addValue("since", thirtyDaysAgo), Integer.class);

        // Case counts (across all orgs)
        long totalCases = legalCaseRepository.count();
        long activeCases = legalCaseRepository.findByStatus(CaseStatus.ACTIVE).size();
        long closedCases = legalCaseRepository.findByStatus(CaseStatus.CLOSED).size();

        // Client counts
        long totalClients = clientRepository.count();

        // Invoice counts and revenue
        long totalInvoices = invoiceRepository.count();
        Double paidRevenue = invoiceRepository.sumTotalAmountByStatus(InvoiceStatus.PAID);
        BigDecimal totalRevenue = paidRevenue != null ? BigDecimal.valueOf(paidRevenue) : BigDecimal.ZERO;

        // Recent activity (last 10 across all orgs)
        LocalDateTime oneDayAgo = LocalDateTime.now().minusDays(1);
        List<AuditLog> recentLogs = auditLogRepository.findRecentActivitiesForDashboard(
            oneDayAgo, PageRequest.of(0, 10));

        List<PlatformStatsDTO.RecentActivityDTO> recentActivity = recentLogs.stream()
            .map(this::mapToRecentActivity)
            .collect(Collectors.toList());

        // Build alerts
        List<PlatformStatsDTO.AlertDTO> alerts = buildAlerts(allOrgs);

        return PlatformStatsDTO.builder()
            .totalOrganizations(totalOrgs)
            .activeOrganizations(activeOrgs)
            .suspendedOrganizations(suspendedOrgs)
            .totalUsers(totalUsers != null ? totalUsers : 0)
            .activeUsersLast7Days(activeUsersLast7Days != null ? activeUsersLast7Days : 0)
            .activeUsersLast30Days(activeUsersLast30Days != null ? activeUsersLast30Days : 0)
            .totalCases((int) totalCases)
            .activeCases((int) activeCases)
            .closedCases((int) closedCases)
            .totalClients((int) totalClients)
            .totalInvoices((int) totalInvoices)
            .totalRevenue(totalRevenue)
            .systemHealth("HEALTHY")
            .recentActivity(recentActivity)
            .alerts(alerts)
            .build();
    }

    @Override
    public Page<OrganizationWithStatsDTO> getAllOrganizationsWithStats(Pageable pageable) {
        log.info("SUPERADMIN: Fetching all organizations with stats");

        // Check if sorting by a computed field (not a DB column)
        boolean sortByUserCount = pageable.getSort().stream()
            .anyMatch(order -> "userCount".equals(order.getProperty()));
        Sort.Direction sortDirection = pageable.getSort().stream()
            .filter(order -> "userCount".equals(order.getProperty()))
            .map(Sort.Order::getDirection)
            .findFirst().orElse(Sort.Direction.ASC);

        // Strip non-column sort fields — use default sort for DB query
        Pageable dbPageable = sortByUserCount
            ? PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), Sort.by("id").ascending())
            : pageable;

        Page<Organization> orgsPage = organizationRepository.findAll(dbPageable);

        List<OrganizationWithStatsDTO> orgsWithStats = orgsPage.getContent().stream()
            .map(this::mapToOrganizationWithStats)
            .collect(Collectors.toList());

        // Sort by computed userCount in-memory if requested
        if (sortByUserCount) {
            orgsWithStats.sort((a, b) -> sortDirection == Sort.Direction.DESC
                ? Integer.compare(b.getUserCount(), a.getUserCount())
                : Integer.compare(a.getUserCount(), b.getUserCount()));
        }

        return new PageImpl<>(orgsWithStats, pageable, orgsPage.getTotalElements());
    }

    @Override
    public OrganizationDetailDTO getOrganizationDetails(Long organizationId) {
        log.info("SUPERADMIN: Fetching details for organization ID: {}", organizationId);

        Organization org = organizationRepository.findById(organizationId)
            .orElseThrow(() -> new ApiException("Organization not found with ID: " + organizationId));

        // Get stats
        Integer userCount = organizationRepository.countUsersByOrganizationId(organizationId);
        Integer caseCount = organizationRepository.countCasesByOrganizationId(organizationId);
        Integer clientCount = organizationRepository.countClientsByOrganizationId(organizationId);
        Integer documentCount = organizationRepository.countDocumentsByOrganizationId(organizationId);
        long invoiceCount = invoiceRepository.countByOrganizationId(organizationId);

        // Revenue
        Double paidRevenue = invoiceRepository.sumTotalAmountByOrganizationAndStatus(organizationId, InvoiceStatus.PAID);
        BigDecimal totalRevenue = paidRevenue != null ? BigDecimal.valueOf(paidRevenue) : BigDecimal.ZERO;

        // Recent users
        List<UserDTO> recentUsers = getOrganizationUsers(organizationId, PageRequest.of(0, 5)).getContent();

        // Recent activity
        LocalDateTime oneDayAgo = LocalDateTime.now().minusDays(1);
        List<AuditLog> recentLogs = auditLogRepository.findRecentActivitiesForDashboardByOrganization(
            organizationId, oneDayAgo, PageRequest.of(0, 10));

        List<PlatformStatsDTO.RecentActivityDTO> recentActivity = recentLogs.stream()
            .map(this::mapToRecentActivity)
            .collect(Collectors.toList());

        // Calculate quota percentages
        Double userQuotaPercent = calculateQuotaPercent(userCount, org.getMaxUsers());
        Double caseQuotaPercent = calculateQuotaPercent(caseCount, org.getMaxCases());
        Double storageQuotaPercent = calculateStorageQuotaPercent(0L, org.getMaxStorageBytes());

        OrganizationDetailDTO.OrganizationStatsInfo stats = OrganizationDetailDTO.OrganizationStatsInfo.builder()
            .userCount(userCount != null ? userCount : 0)
            .caseCount(caseCount != null ? caseCount : 0)
            .clientCount(clientCount != null ? clientCount : 0)
            .invoiceCount((int) invoiceCount)
            .documentCount(documentCount != null ? documentCount : 0)
            .totalRevenue(totalRevenue)
            .maxUsers(org.getMaxUsers())
            .maxCases(org.getMaxCases())
            .maxStorageBytes(org.getMaxStorageBytes())
            .userQuotaPercent(userQuotaPercent)
            .caseQuotaPercent(caseQuotaPercent)
            .storageQuotaPercent(storageQuotaPercent)
            .build();

        return OrganizationDetailDTO.builder()
            .id(org.getId())
            .name(org.getName())
            .slug(org.getSlug())
            .email(org.getEmail())
            .phone(org.getPhone())
            .address(org.getAddress())
            .website(org.getWebsite())
            .logoUrl(org.getLogoUrl())
            .planType(org.getPlanType() != null ? org.getPlanType().name() : null)
            .status(org.getStatus() != null ? org.getStatus().name() : null)
            .smsEnabled(org.getSmsEnabled())
            .whatsappEnabled(org.getWhatsappEnabled())
            .emailEnabled(org.getEmailEnabled())
            .twilioEnabled(org.getTwilioEnabled())
            .createdAt(org.getCreatedAt())
            .updatedAt(org.getUpdatedAt())
            .stats(stats)
            .recentUsers(recentUsers)
            .recentActivity(recentActivity)
            .build();
    }

    @Override
    public Page<UserDTO> getOrganizationUsers(Long organizationId, Pageable pageable) {
        log.info("SUPERADMIN: Fetching users for organization ID: {}", organizationId);

        int offset = (int) pageable.getOffset();
        int pageSize = pageable.getPageSize();

        MapSqlParameterSource params = new MapSqlParameterSource()
            .addValue("organizationId", organizationId)
            .addValue("pageSize", pageSize)
            .addValue("offset", offset);

        List<User> users = jdbc.query(SELECT_USERS_BY_ORG_PAGINATED, params, new UserRowMapper());
        Integer total = jdbc.queryForObject(COUNT_USERS_BY_ORG,
            new MapSqlParameterSource().addValue("organizationId", organizationId), Integer.class);

        // Load roles for each user and map to DTO
        List<UserDTO> userDTOs = users.stream()
            .map(user -> {
                Set<Role> roles = roleRepository.getRolesByUserId(user.getId());
                return mapToUserDTO(user, roles);
            })
            .collect(Collectors.toList());

        return new PageImpl<>(userDTOs, pageable, total != null ? total : 0);
    }

    @Override
    @Transactional
    public void suspendOrganization(Long organizationId) {
        log.info("SUPERADMIN: Suspending organization ID: {}", organizationId);

        Organization org = organizationRepository.findById(organizationId)
            .orElseThrow(() -> new ApiException("Organization not found with ID: " + organizationId));

        org.setStatus(Organization.OrganizationStatus.SUSPENDED);
        organizationRepository.save(org);

        log.info("SUPERADMIN: Organization {} has been suspended", org.getName());
    }

    @Override
    @Transactional
    public void activateOrganization(Long organizationId) {
        log.info("SUPERADMIN: Activating organization ID: {}", organizationId);

        Organization org = organizationRepository.findById(organizationId)
            .orElseThrow(() -> new ApiException("Organization not found with ID: " + organizationId));

        org.setStatus(Organization.OrganizationStatus.ACTIVE);
        organizationRepository.save(org);

        log.info("SUPERADMIN: Organization {} has been activated", org.getName());
    }

    @Override
    @Transactional
    public void deleteOrganization(Long organizationId) {
        log.info("SUPERADMIN: Deleting (soft) organization ID: {}", organizationId);

        // Prevent deleting default organization
        if (organizationId == 1L) {
            throw new ApiException("Cannot delete the default organization");
        }

        Organization org = organizationRepository.findById(organizationId)
            .orElseThrow(() -> new ApiException("Organization not found with ID: " + organizationId));

        // Set status to DELETED
        jdbc.update(
            "UPDATE organizations SET status = 'DELETED', updated_at = :now WHERE id = :id",
            new MapSqlParameterSource()
                .addValue("id", organizationId)
                .addValue("now", LocalDateTime.now())
        );

        // Disable all users in the organization
        int disabledCount = jdbc.update(
            "UPDATE users SET enabled = false WHERE organization_id = :orgId",
            new MapSqlParameterSource().addValue("orgId", organizationId)
        );

        log.info("SUPERADMIN: Organization '{}' soft-deleted. {} users disabled.", org.getName(), disabledCount);
    }

    @Override
    public Page<OrganizationWithStatsDTO> searchOrganizations(String query, Pageable pageable) {
        log.info("SUPERADMIN: Searching organizations with query: {}", query);

        List<Organization> matchingOrgs = organizationRepository.searchOrganizations(query);

        // Apply pagination manually
        int start = (int) pageable.getOffset();
        int end = Math.min(start + pageable.getPageSize(), matchingOrgs.size());

        List<OrganizationWithStatsDTO> pagedOrgs = matchingOrgs.subList(start, end).stream()
            .map(this::mapToOrganizationWithStats)
            .collect(Collectors.toList());

        return new PageImpl<>(pagedOrgs, pageable, matchingOrgs.size());
    }

    @Override
    public Page<UserDTO> getAllUsers(Pageable pageable) {
        log.info("SUPERADMIN: Fetching all users across all organizations");

        int offset = (int) pageable.getOffset();
        int pageSize = pageable.getPageSize();

        MapSqlParameterSource params = new MapSqlParameterSource()
            .addValue("pageSize", pageSize)
            .addValue("offset", offset);

        List<User> users = jdbc.query(SELECT_ALL_USERS_PAGINATED, params, new UserRowMapper());
        Integer total = jdbc.queryForObject(COUNT_ALL_USERS, new MapSqlParameterSource(), Integer.class);

        List<UserDTO> userDTOs = users.stream()
            .map(user -> {
                Set<Role> roles = roleRepository.getRolesByUserId(user.getId());
                return mapToUserDTO(user, roles);
            })
            .collect(Collectors.toList());

        return new PageImpl<>(userDTOs, pageable, total != null ? total : 0);
    }

    @Override
    public Page<UserDTO> searchUsers(String query, Pageable pageable) {
        log.info("SUPERADMIN: Searching users with query: {}", query);

        int offset = (int) pageable.getOffset();
        int pageSize = pageable.getPageSize();
        String searchQuery = "%" + query + "%";

        MapSqlParameterSource params = new MapSqlParameterSource()
            .addValue("query", searchQuery)
            .addValue("pageSize", pageSize)
            .addValue("offset", offset);

        List<User> users = jdbc.query(SEARCH_USERS_QUERY, params, new UserRowMapper());
        Integer total = jdbc.queryForObject(COUNT_SEARCH_USERS,
            new MapSqlParameterSource().addValue("query", searchQuery), Integer.class);

        List<UserDTO> userDTOs = users.stream()
            .map(user -> {
                Set<Role> roles = roleRepository.getRolesByUserId(user.getId());
                return mapToUserDTO(user, roles);
            })
            .collect(Collectors.toList());

        return new PageImpl<>(userDTOs, pageable, total != null ? total : 0);
    }

    // ==================== HELPER METHODS ====================

    private OrganizationWithStatsDTO mapToOrganizationWithStats(Organization org) {
        Integer userCount = organizationRepository.countUsersByOrganizationId(org.getId());
        Integer caseCount = organizationRepository.countCasesByOrganizationId(org.getId());
        Integer clientCount = organizationRepository.countClientsByOrganizationId(org.getId());
        long invoiceCount = invoiceRepository.countByOrganizationId(org.getId());

        // Calculate quota percentages
        Double userQuotaPercent = calculateQuotaPercent(userCount, org.getMaxUsers());
        Double caseQuotaPercent = calculateQuotaPercent(caseCount, org.getMaxCases());
        Double storageQuotaPercent = calculateStorageQuotaPercent(0L, org.getMaxStorageBytes());

        return OrganizationWithStatsDTO.builder()
            .id(org.getId())
            .name(org.getName())
            .slug(org.getSlug())
            .planType(org.getPlanType() != null ? org.getPlanType().name() : null)
            .status(org.getStatus() != null ? org.getStatus().name() : null)
            .email(org.getEmail())
            .phone(org.getPhone())
            .userCount(userCount != null ? userCount : 0)
            .caseCount(caseCount != null ? caseCount : 0)
            .clientCount(clientCount != null ? clientCount : 0)
            .invoiceCount((int) invoiceCount)
            .createdAt(org.getCreatedAt())
            .userQuotaPercent(userQuotaPercent)
            .caseQuotaPercent(caseQuotaPercent)
            .storageQuotaPercent(storageQuotaPercent)
            .build();
    }

    private PlatformStatsDTO.RecentActivityDTO mapToRecentActivity(AuditLog log) {
        return PlatformStatsDTO.RecentActivityDTO.builder()
            .id(log.getId())
            .action(log.getAction() != null ? log.getAction().name() : null)
            .entityType(log.getEntityType() != null ? log.getEntityType().name() : null)
            .entityName(log.getDescription())
            .userName(log.getUserId() != null ? "User #" + log.getUserId() : "System")
            .timestamp(log.getTimestamp() != null ? log.getTimestamp().toString() : null)
            .build();
    }

    private UserDTO mapToUserDTO(User user, Set<Role> roles) {
        String roleName = roles.stream()
            .findFirst()
            .map(Role::getName)
            .orElse("ROLE_USER");

        UserDTO dto = new UserDTO();
        dto.setId(user.getId());
        dto.setFirstName(user.getFirstName());
        dto.setLastName(user.getLastName());
        dto.setEmail(user.getEmail());
        dto.setPhone(user.getPhone());
        dto.setAddress(user.getAddress());
        dto.setTitle(user.getTitle());
        dto.setBio(user.getBio());
        dto.setImageUrl(user.getImageUrl());
        dto.setEnabled(user.isEnabled());
        dto.setNotLocked(user.isNotLocked());
        dto.setUsingMFA(user.isUsingMFA());
        dto.setCreatedAt(user.getCreatedAt());
        dto.setRoleName(roleName);
        dto.setOrganizationId(user.getOrganizationId());
        return dto;
    }

    private Double calculateQuotaPercent(Integer used, Integer max) {
        if (used == null || max == null || max == 0) {
            return 0.0;
        }
        return (used.doubleValue() / max.doubleValue()) * 100.0;
    }

    private Double calculateStorageQuotaPercent(Long usedBytes, Long maxBytes) {
        if (usedBytes == null || maxBytes == null || maxBytes == 0) {
            return 0.0;
        }
        return (usedBytes.doubleValue() / maxBytes.doubleValue()) * 100.0;
    }

    private List<PlatformStatsDTO.AlertDTO> buildAlerts(List<Organization> organizations) {
        List<PlatformStatsDTO.AlertDTO> alerts = new ArrayList<>();

        for (Organization org : organizations) {
            // Check for quota warnings (>80% usage)
            Integer userCount = organizationRepository.countUsersByOrganizationId(org.getId());
            if (userCount != null && org.getMaxUsers() != null && org.getMaxUsers() > 0) {
                double userPercent = (userCount.doubleValue() / org.getMaxUsers()) * 100;
                if (userPercent >= 80) {
                    alerts.add(PlatformStatsDTO.AlertDTO.builder()
                        .type("WARNING")
                        .message(String.format("User quota at %.0f%% (%d/%d)", userPercent, userCount, org.getMaxUsers()))
                        .organizationName(org.getName())
                        .timestamp(LocalDateTime.now().toString())
                        .build());
                }
            }

            // Check for suspended organizations
            if (org.getStatus() == Organization.OrganizationStatus.SUSPENDED) {
                alerts.add(PlatformStatsDTO.AlertDTO.builder()
                    .type("INFO")
                    .message("Organization is suspended")
                    .organizationName(org.getName())
                    .timestamp(LocalDateTime.now().toString())
                    .build());
            }
        }

        return alerts;
    }

    // ==================== SYSTEM HEALTH ====================

    @Override
    public SystemHealthDTO getSystemHealth() {
        log.info("SUPERADMIN: Checking system health");

        LocalDateTime now = LocalDateTime.now();
        String overallStatus = "HEALTHY";

        // Check database
        SystemHealthDTO.ComponentHealth dbHealth;
        long dbStart = System.currentTimeMillis();
        try {
            jdbc.queryForObject("SELECT 1", new MapSqlParameterSource(), Integer.class);
            long dbTime = System.currentTimeMillis() - dbStart;
            dbHealth = SystemHealthDTO.ComponentHealth.builder()
                .status("UP")
                .message("Database connection OK")
                .responseTimeMs(dbTime)
                .build();
        } catch (Exception e) {
            dbHealth = SystemHealthDTO.ComponentHealth.builder()
                .status("DOWN")
                .message("Database error: " + e.getMessage())
                .responseTimeMs(0)
                .build();
            overallStatus = "UNHEALTHY";
        }

        // Application health
        SystemHealthDTO.ComponentHealth appHealth = SystemHealthDTO.ComponentHealth.builder()
            .status("UP")
            .message("Application running")
            .responseTimeMs(0)
            .build();

        // Memory info
        Runtime runtime = Runtime.getRuntime();
        long totalMemory = runtime.totalMemory();
        long freeMemory = runtime.freeMemory();
        long usedMemory = totalMemory - freeMemory;
        double memoryPercent = (usedMemory * 100.0) / totalMemory;

        SystemHealthDTO.MemoryInfo memoryInfo = SystemHealthDTO.MemoryInfo.builder()
            .totalBytes(totalMemory)
            .usedBytes(usedMemory)
            .freeBytes(freeMemory)
            .usagePercent(Math.round(memoryPercent * 100.0) / 100.0)
            .build();

        if (memoryPercent > 90) {
            overallStatus = "DEGRADED";
        }

        // Time ranges
        LocalDateTime oneHourAgo = now.minusHours(1);
        LocalDateTime oneDayAgo = now.minusDays(1);

        // Error counts from user_events (failed login attempts as error proxy)
        Integer errorCountLastHour = jdbc.queryForObject(
            "SELECT COUNT(*) FROM user_events ue JOIN events e ON ue.event_id = e.id " +
            "WHERE e.type = 'LOGIN_ATTEMPT_FAILURE' AND ue.created_at >= :since",
            new MapSqlParameterSource().addValue("since", oneHourAgo),
            Integer.class
        );

        Integer errorCountLast24Hours = jdbc.queryForObject(
            "SELECT COUNT(*) FROM user_events ue JOIN events e ON ue.event_id = e.id " +
            "WHERE e.type = 'LOGIN_ATTEMPT_FAILURE' AND ue.created_at >= :since",
            new MapSqlParameterSource().addValue("since", oneDayAgo),
            Integer.class
        );

        // Active sessions: distinct users with successful logins in last 24h
        Integer activeSessions = jdbc.queryForObject(
            "SELECT COUNT(DISTINCT ue.user_id) FROM user_events ue " +
            "JOIN events e ON ue.event_id = e.id " +
            "WHERE e.type = 'LOGIN_ATTEMPT_SUCCESS' AND ue.created_at >= :since",
            new MapSqlParameterSource().addValue("since", oneDayAgo),
            Integer.class
        );

        // API metrics from audit_log
        Integer totalRequestsLastHour = jdbc.queryForObject(
            "SELECT COUNT(*) FROM audit_log WHERE timestamp >= :since",
            new MapSqlParameterSource().addValue("since", oneHourAgo),
            Integer.class
        );

        // Use DB response time as a baseline for API performance
        SystemHealthDTO.ApiMetrics apiMetrics = SystemHealthDTO.ApiMetrics.builder()
            .totalRequestsLastHour(totalRequestsLastHour != null ? totalRequestsLastHour : 0)
            .avgResponseTimeMs(dbHealth.getResponseTimeMs())
            .p95ResponseTimeMs(0)
            .p99ResponseTimeMs(0)
            .build();

        return SystemHealthDTO.builder()
            .overallStatus(overallStatus)
            .checkedAt(now)
            .database(dbHealth)
            .application(appHealth)
            .memory(memoryInfo)
            .errorCountLastHour(errorCountLastHour != null ? errorCountLastHour : 0)
            .errorCountLast24Hours(errorCountLast24Hours != null ? errorCountLast24Hours : 0)
            .activeSessions(activeSessions != null ? activeSessions : 0)
            .apiMetrics(apiMetrics)
            .build();
    }

    // ==================== PLATFORM ANALYTICS ====================

    @Override
    public PlatformAnalyticsDTO getPlatformAnalytics(String period) {
        log.info("SUPERADMIN: Fetching platform analytics for period: {}", period);

        int days = "year".equals(period) ? 365 : "month".equals(period) ? 30 : 7;
        LocalDate endDate = LocalDate.now();
        LocalDate startDate = endDate.minusDays(days);

        // Organization growth
        List<PlatformAnalyticsDTO.TimeSeriesData> orgGrowth = getTimeSeriesData(
            "SELECT DATE(created_at) as date, COUNT(*) as count FROM organizations WHERE created_at >= :start GROUP BY DATE(created_at) ORDER BY date",
            startDate
        );

        // User growth
        List<PlatformAnalyticsDTO.TimeSeriesData> userGrowth = getTimeSeriesData(
            "SELECT DATE(created_at) as date, COUNT(*) as count FROM users WHERE created_at >= :start GROUP BY DATE(created_at) ORDER BY date",
            startDate
        );

        // Case growth
        List<PlatformAnalyticsDTO.TimeSeriesData> caseGrowth = getTimeSeriesData(
            "SELECT DATE(created_at) as date, COUNT(*) as count FROM legal_cases WHERE created_at >= :start GROUP BY DATE(created_at) ORDER BY date",
            startDate
        );

        // Top orgs by users
        List<PlatformAnalyticsDTO.OrgMetric> topOrgsByUsers = getTopOrganizations(
            "SELECT o.id, o.name, COUNT(u.id) as value FROM organizations o LEFT JOIN users u ON u.organization_id = o.id GROUP BY o.id, o.name ORDER BY value DESC LIMIT 5"
        );

        // Users by role
        Map<String, Long> usersByRole = new HashMap<>();
        try {
            jdbc.query(
                "SELECT r.name, COUNT(ur.user_id) as cnt FROM roles r LEFT JOIN user_roles ur ON ur.role_id = r.id WHERE r.name != 'ROLE_SUPERADMIN' GROUP BY r.name ORDER BY cnt DESC",
                new MapSqlParameterSource(),
                (rs, rowNum) -> {
                    usersByRole.put(rs.getString("name").replace("ROLE_", ""), rs.getLong("cnt"));
                    return null;
                }
            );
        } catch (Exception e) {
            log.warn("Error fetching users by role: {}", e.getMessage());
        }

        // Top orgs by revenue
        List<PlatformAnalyticsDTO.OrgMetric> topOrgsByRevenue = getTopOrganizations(
            "SELECT o.id, o.name, COALESCE(SUM(i.total_amount), 0) as value FROM organizations o LEFT JOIN invoices i ON i.organization_id = o.id AND i.status = 'PAID' GROUP BY o.id, o.name HAVING COALESCE(SUM(i.total_amount), 0) > 0 ORDER BY value DESC LIMIT 5"
        );

        // Plan distribution
        Map<String, Long> orgsByPlan = new HashMap<>();
        List<Organization> allOrgs = organizationRepository.findAll();
        for (Organization org : allOrgs) {
            String plan = org.getPlanType() != null ? org.getPlanType().name() : "NONE";
            orgsByPlan.merge(plan, 1L, Long::sum);
        }

        // Active users
        LocalDateTime sevenDaysAgo = LocalDateTime.now().minusDays(7);
        LocalDateTime thirtyDaysAgo = LocalDateTime.now().minusDays(30);

        Integer dau = jdbc.queryForObject(COUNT_ACTIVE_USERS_LAST_N_DAYS,
            new MapSqlParameterSource().addValue("since", LocalDateTime.now().minusDays(1)), Integer.class);
        Integer wau = jdbc.queryForObject(COUNT_ACTIVE_USERS_LAST_N_DAYS,
            new MapSqlParameterSource().addValue("since", sevenDaysAgo), Integer.class);
        Integer mau = jdbc.queryForObject(COUNT_ACTIVE_USERS_LAST_N_DAYS,
            new MapSqlParameterSource().addValue("since", thirtyDaysAgo), Integer.class);

        return PlatformAnalyticsDTO.builder()
            .organizationGrowth(orgGrowth)
            .userGrowth(userGrowth)
            .caseGrowth(caseGrowth)
            .topOrgsByUsers(topOrgsByUsers)
            .topOrgsByRevenue(topOrgsByRevenue)
            .usersByRole(usersByRole)
            .organizationsByPlan(orgsByPlan)
            .dailyActiveUsers(dau != null ? dau : 0)
            .weeklyActiveUsers(wau != null ? wau : 0)
            .monthlyActiveUsers(mau != null ? mau : 0)
            .build();
    }

    private List<PlatformAnalyticsDTO.TimeSeriesData> getTimeSeriesData(String sql, LocalDate startDate) {
        try {
            return jdbc.query(sql,
                new MapSqlParameterSource().addValue("start", startDate.atStartOfDay()),
                (rs, rowNum) -> PlatformAnalyticsDTO.TimeSeriesData.builder()
                    .date(rs.getDate("date").toLocalDate())
                    .value(rs.getLong("count"))
                    .build()
            );
        } catch (Exception e) {
            log.warn("Error fetching time series data: {}", e.getMessage());
            return new ArrayList<>();
        }
    }

    private List<PlatformAnalyticsDTO.OrgMetric> getTopOrganizations(String sql) {
        try {
            return jdbc.query(sql,
                new MapSqlParameterSource(),
                (rs, rowNum) -> PlatformAnalyticsDTO.OrgMetric.builder()
                    .organizationId(rs.getLong("id"))
                    .organizationName(rs.getString("name"))
                    .value(rs.getLong("value"))
                    .build()
            );
        } catch (Exception e) {
            log.warn("Error fetching top organizations: {}", e.getMessage());
            return new ArrayList<>();
        }
    }

    // ==================== ORGANIZATION CRUD ====================

    @Override
    @Transactional
    public Organization createOrganization(CreateOrganizationDTO dto) {
        log.info("SUPERADMIN: Creating new organization: {}", dto.getName());

        // Check if slug already exists
        if (organizationRepository.findBySlug(dto.getSlug()).isPresent()) {
            throw new ApiException("Organization with slug '" + dto.getSlug() + "' already exists");
        }

        // Create organization
        Organization org = Organization.builder()
            .name(dto.getName())
            .slug(dto.getSlug())
            .planType(dto.getPlanType() != null ?
                Organization.PlanType.valueOf(dto.getPlanType()) : Organization.PlanType.STARTER)
            .status(Organization.OrganizationStatus.ACTIVE)
            .phone(dto.getPhone())
            .address(dto.getAddress())
            .website(dto.getWebsite())
            .maxUsers(dto.getMaxUsers() != null ? dto.getMaxUsers() : 5)
            .maxCases(dto.getMaxCases() != null ? dto.getMaxCases() : 100)
            .maxStorageBytes(dto.getMaxStorageBytes() != null ? dto.getMaxStorageBytes() : 5368709120L)
            .emailEnabled(true)
            .smsEnabled(false)
            .whatsappEnabled(false)
            .twilioEnabled(false)
            .build();

        org = organizationRepository.save(org);

        // Check if admin email already exists
        Long userId = null;
        String tempPassword = UUID.randomUUID().toString().substring(0, 8);
        try {
            userId = jdbc.queryForObject(
                "SELECT id FROM users WHERE email = :email",
                new MapSqlParameterSource().addValue("email", dto.getAdminEmail()),
                Long.class
            );
            log.info("Admin email {} already exists (userId={}), skipping user creation", dto.getAdminEmail(), userId);
        } catch (org.springframework.dao.EmptyResultDataAccessException ignored) {
            // Email not found — create new user
            String encodedPassword = passwordEncoder.encode(tempPassword);

            jdbc.update(
                "INSERT INTO users (first_name, last_name, email, password, organization_id, enabled, non_locked, using_mfa, created_at) " +
                "VALUES (:firstName, :lastName, :email, :password, :orgId, true, true, false, :createdAt)",
                new MapSqlParameterSource()
                    .addValue("firstName", dto.getAdminFirstName())
                    .addValue("lastName", dto.getAdminLastName())
                    .addValue("email", dto.getAdminEmail())
                    .addValue("password", encodedPassword)
                    .addValue("orgId", org.getId())
                    .addValue("createdAt", LocalDateTime.now())
            );

            userId = jdbc.queryForObject(
                "SELECT id FROM users WHERE email = :email",
                new MapSqlParameterSource().addValue("email", dto.getAdminEmail()),
                Long.class
            );

            // Assign ADMIN role to the new user
            if (userId != null) {
                jdbc.update(
                    "INSERT INTO user_roles (user_id, role_id) SELECT :userId, id FROM roles WHERE name = 'ROLE_ADMIN'",
                    new MapSqlParameterSource().addValue("userId", userId)
                );
            }
        }

        // Generate a one-time setup token so the user can set their own password
        if (userId == null) {
            throw new ApiException("Failed to create admin user - could not retrieve user ID");
        }
        String setupToken = UUID.randomUUID().toString();
        jdbc.update(
            "DELETE FROM reset_password_verifications WHERE user_id = :userId",
            new MapSqlParameterSource().addValue("userId", userId)
        );
        jdbc.update(
            "INSERT INTO reset_password_verifications (user_id, url, expiration_date) VALUES (:userId, :url, :expirationDate)",
            new MapSqlParameterSource()
                .addValue("userId", userId)
                .addValue("url", setupToken)
                .addValue("expirationDate", LocalDateTime.now().plusDays(7))
        );

        // Send welcome email with invitation to set password
        try {
            String inviteUrl = frontendBaseUrl + "/user/verify/password/" + setupToken;
            emailService.sendInvitationEmail(
                dto.getAdminEmail(),
                org.getName(),
                "Administrator",
                inviteUrl,
                7 // 7 days to accept
            );
        } catch (Exception e) {
            log.error("Failed to send welcome email: {}", e.getMessage());
        }

        log.info("SUPERADMIN: Organization {} created with admin user {}", org.getName(), dto.getAdminEmail());
        return org;
    }

    @Override
    @Transactional
    public Organization updateOrganization(Long organizationId, UpdateOrganizationDTO dto) {
        log.info("SUPERADMIN: Updating organization ID: {}", organizationId);

        Organization org = organizationRepository.findById(organizationId)
            .orElseThrow(() -> new ApiException("Organization not found with ID: " + organizationId));

        if (dto.getName() != null) org.setName(dto.getName());
        if (dto.getSlug() != null) {
            // Check if new slug is unique
            organizationRepository.findBySlug(dto.getSlug())
                .filter(o -> !o.getId().equals(organizationId))
                .ifPresent(o -> {
                    throw new ApiException("Slug '" + dto.getSlug() + "' is already in use");
                });
            org.setSlug(dto.getSlug());
        }
        if (dto.getPlanType() != null) org.setPlanType(Organization.PlanType.valueOf(dto.getPlanType()));
        if (dto.getStatus() != null) org.setStatus(Organization.OrganizationStatus.valueOf(dto.getStatus()));
        if (dto.getPhone() != null) org.setPhone(dto.getPhone());
        if (dto.getAddress() != null) org.setAddress(dto.getAddress());
        if (dto.getWebsite() != null) org.setWebsite(dto.getWebsite());
        if (dto.getMaxUsers() != null) org.setMaxUsers(dto.getMaxUsers());
        if (dto.getMaxCases() != null) org.setMaxCases(dto.getMaxCases());
        if (dto.getMaxStorageBytes() != null) org.setMaxStorageBytes(dto.getMaxStorageBytes());

        return organizationRepository.save(org);
    }

    // ==================== USER MANAGEMENT ====================

    @Override
    public UserDetailDTO getUserDetails(Long userId) {
        log.info("SUPERADMIN: Fetching details for user ID: {}", userId);

        User user = jdbc.queryForObject(
            "SELECT * FROM users WHERE id = :userId",
            new MapSqlParameterSource().addValue("userId", userId),
            new UserRowMapper()
        );

        if (user == null) {
            throw new ApiException("User not found with ID: " + userId);
        }

        Set<Role> roles = roleRepository.getRolesByUserId(userId);
        String roleName = roles.stream().findFirst().map(Role::getName).orElse("ROLE_USER");

        // Get organization info
        Organization org = null;
        if (user.getOrganizationId() != null) {
            org = organizationRepository.findById(user.getOrganizationId()).orElse(null);
        }

        // Get activity stats
        Integer casesAssigned = jdbc.queryForObject(
            "SELECT COUNT(*) FROM case_team_assignments WHERE user_id = :userId",
            new MapSqlParameterSource().addValue("userId", userId),
            Integer.class
        );

        // Recent activity
        List<AuditLog> recentLogs = auditLogRepository.findRecentActivitiesForDashboard(
            LocalDateTime.now().minusDays(30), PageRequest.of(0, 10));

        List<UserDetailDTO.ActivityItem> recentActivity = recentLogs.stream()
            .filter(l -> l.getUserId() != null && l.getUserId().equals(userId))
            .map(l -> UserDetailDTO.ActivityItem.builder()
                .action(l.getAction() != null ? l.getAction().name() : null)
                .entityType(l.getEntityType() != null ? l.getEntityType().name() : null)
                .description(l.getDescription())
                .timestamp(l.getTimestamp())
                .build())
            .limit(10)
            .collect(Collectors.toList());

        return UserDetailDTO.builder()
            .id(user.getId())
            .firstName(user.getFirstName())
            .lastName(user.getLastName())
            .email(user.getEmail())
            .phone(user.getPhone())
            .imageUrl(user.getImageUrl())
            .roleName(roleName)
            .organizationId(user.getOrganizationId())
            .organizationName(org != null ? org.getName() : null)
            .organizationSlug(org != null ? org.getSlug() : null)
            .enabled(user.isEnabled())
            .accountNonLocked(user.isNotLocked())
            .usingMfa(user.isUsingMFA())
            .createdAt(user.getCreatedAt())
            .casesAssigned(casesAssigned != null ? casesAssigned : 0)
            .recentActivity(recentActivity)
            .build();
    }

    @Override
    @Transactional
    public void resetUserPassword(Long userId) {
        log.info("SUPERADMIN: Resetting password for user ID: {}", userId);

        User user = jdbc.queryForObject(
            "SELECT * FROM users WHERE id = :userId",
            new MapSqlParameterSource().addValue("userId", userId),
            new UserRowMapper()
        );

        if (user == null) {
            throw new ApiException("User not found with ID: " + userId);
        }

        // Generate reset token and send email
        String resetToken = UUID.randomUUID().toString();

        // Store reset token (simplified - in production use a proper token table)
        jdbc.update(
            "UPDATE users SET password = :token WHERE id = :userId",
            new MapSqlParameterSource()
                .addValue("token", passwordEncoder.encode(resetToken))
                .addValue("userId", userId)
        );

        // Send reset email
        try {
            String resetUrl = frontendBaseUrl + "/reset-password?token=" + resetToken;
            emailService.sendVerificationEmail(user.getFirstName(), user.getEmail(), resetUrl, VerificationType.PASSWORD);
            log.info("SUPERADMIN: Password reset email sent to {}", user.getEmail());
        } catch (Exception e) {
            log.error("Failed to send password reset email: {}", e.getMessage());
            throw new ApiException("Failed to send password reset email");
        }
    }

    @Override
    @Transactional
    public void toggleUserStatus(Long userId, boolean enabled) {
        log.info("SUPERADMIN: Setting user {} enabled status to: {}", userId, enabled);

        int updated = jdbc.update(
            "UPDATE users SET enabled = :enabled WHERE id = :userId",
            new MapSqlParameterSource()
                .addValue("enabled", enabled)
                .addValue("userId", userId)
        );

        if (updated == 0) {
            throw new ApiException("User not found with ID: " + userId);
        }
    }

    @Override
    @Transactional
    public void resendVerificationEmail(Long userId) {
        log.info("SUPERADMIN: Resending verification email for user ID: {}", userId);

        User user = jdbc.queryForObject(
            "SELECT * FROM users WHERE id = :userId",
            new MapSqlParameterSource().addValue("userId", userId),
            new UserRowMapper()
        );

        if (user == null) {
            throw new ApiException("User not found with ID: " + userId);
        }

        // Generate verification URL and send email
        String verificationUrl = frontendBaseUrl + "/verify?token=" + UUID.randomUUID().toString();

        try {
            emailService.sendVerificationEmail(user.getFirstName(), user.getEmail(), verificationUrl, VerificationType.ACCOUNT);
            log.info("SUPERADMIN: Verification email sent to {}", user.getEmail());
        } catch (Exception e) {
            log.error("Failed to send verification email: {}", e.getMessage());
            throw new ApiException("Failed to send verification email");
        }
    }

    // ==================== AUDIT LOGS ====================

    @Override
    public Page<AuditLogEntryDTO> getAuditLogs(Long organizationId, Long userId, String action,
                                                String entityType, String startDate, String endDate,
                                                Pageable pageable) {
        log.info("SUPERADMIN: Fetching audit logs with filters");

        StringBuilder sql = new StringBuilder(
            "SELECT a.*, u.email as user_email, u.first_name, u.last_name, o.name as org_name, " +
            "CASE " +
            "  WHEN a.entity_type = 'USER' AND a.entity_id IS NOT NULL THEN " +
            "    (SELECT COALESCE(NULLIF(TRIM(COALESCE(eu.first_name,'') || ' ' || COALESCE(eu.last_name,'')), ''), eu.email) FROM users eu WHERE eu.id = a.entity_id) " +
            "  WHEN a.entity_type = 'ORGANIZATION' AND a.entity_id IS NOT NULL THEN " +
            "    (SELECT eo.name FROM organizations eo WHERE eo.id = a.entity_id) " +
            "  WHEN a.entity_type IN ('CLIENT', 'CUSTOMER') AND a.entity_id IS NOT NULL THEN " +
            "    (SELECT ec.name FROM clients ec WHERE ec.id = a.entity_id) " +
            "  WHEN a.entity_type IN ('LEGAL_CASE', 'CASE') AND a.entity_id IS NOT NULL THEN " +
            "    (SELECT el.title FROM legal_cases el WHERE el.id = a.entity_id) " +
            "  WHEN a.entity_type = 'DOCUMENT' AND a.entity_id IS NOT NULL THEN " +
            "    (SELECT ed.title FROM documents ed WHERE ed.id = a.entity_id) " +
            "  WHEN a.entity_type = 'INVOICE' AND a.entity_id IS NOT NULL THEN " +
            "    (SELECT ei.invoice_number FROM invoices ei WHERE ei.id = a.entity_id) " +
            "  ELSE NULL " +
            "END as entity_name " +
            "FROM audit_log a " +
            "LEFT JOIN users u ON a.user_id = u.id " +
            "LEFT JOIN organizations o ON a.organization_id = o.id " +
            "WHERE a.user_id IS NOT NULL "
        );

        StringBuilder countSql = new StringBuilder(
            "SELECT COUNT(*) FROM audit_log a WHERE a.user_id IS NOT NULL "
        );

        MapSqlParameterSource params = new MapSqlParameterSource();

        if (organizationId != null) {
            sql.append("AND a.organization_id = :orgId ");
            countSql.append("AND a.organization_id = :orgId ");
            params.addValue("orgId", organizationId);
        }

        if (userId != null) {
            sql.append("AND a.user_id = :userId ");
            countSql.append("AND a.user_id = :userId ");
            params.addValue("userId", userId);
        }

        if (action != null && !action.isEmpty()) {
            sql.append("AND a.action = :action ");
            countSql.append("AND a.action = :action ");
            params.addValue("action", action);
        }

        if (entityType != null && !entityType.isEmpty()) {
            sql.append("AND a.entity_type = :entityType ");
            countSql.append("AND a.entity_type = :entityType ");
            params.addValue("entityType", entityType);
        }

        if (startDate != null && !startDate.isEmpty()) {
            LocalDateTime start = LocalDate.parse(startDate).atStartOfDay();
            sql.append("AND a.timestamp >= :startDate ");
            countSql.append("AND a.timestamp >= :startDate ");
            params.addValue("startDate", start);
        }

        if (endDate != null && !endDate.isEmpty()) {
            LocalDateTime end = LocalDate.parse(endDate).plusDays(1).atStartOfDay();
            sql.append("AND a.timestamp < :endDate ");
            countSql.append("AND a.timestamp < :endDate ");
            params.addValue("endDate", end);
        }

        sql.append("ORDER BY a.timestamp DESC LIMIT :limit OFFSET :offset");
        params.addValue("limit", pageable.getPageSize());
        params.addValue("offset", pageable.getOffset());

        List<AuditLogEntryDTO> logs = jdbc.query(sql.toString(), params, (rs, rowNum) -> {
            String firstName = rs.getString("first_name");
            String lastName = rs.getString("last_name");
            String userName = null;
            if (firstName != null || lastName != null) {
                String full = ((firstName != null ? firstName : "") + " " + (lastName != null ? lastName : "")).trim();
                if (!full.isEmpty()) {
                    userName = full;
                }
            }
            return AuditLogEntryDTO.builder()
                .id(rs.getLong("id"))
                .action(rs.getString("action"))
                .entityType(rs.getString("entity_type"))
                .entityId(rs.getObject("entity_id") != null ? rs.getLong("entity_id") : null)
                .entityName(rs.getString("entity_name"))
                .description(rs.getString("description"))
                .userId(rs.getObject("user_id") != null ? rs.getLong("user_id") : null)
                .userEmail(rs.getString("user_email"))
                .userName(userName)
                .organizationId(rs.getObject("organization_id") != null ? rs.getLong("organization_id") : null)
                .organizationName(rs.getString("org_name"))
                .ipAddress(rs.getString("ip_address"))
                .userAgent(rs.getString("user_agent"))
                .createdAt(rs.getTimestamp("timestamp") != null ?
                    rs.getTimestamp("timestamp").toLocalDateTime() : null)
                .build();
        });

        Integer total = jdbc.queryForObject(countSql.toString(), params, Integer.class);

        return new PageImpl<>(logs, pageable, total != null ? total : 0);
    }

    // ==================== ANNOUNCEMENTS ====================

    @Override
    @Transactional
    public void sendAnnouncement(AnnouncementDTO announcement) {
        log.info("SUPERADMIN: Sending announcement: {}", announcement.getTitle());

        List<Long> targetUserIds = new ArrayList<>();

        if (announcement.isSendToAll()) {
            // Get all users
            List<Long> allUserIds = jdbc.queryForList(
                "SELECT id FROM users WHERE enabled = true",
                new MapSqlParameterSource(),
                Long.class
            );
            targetUserIds.addAll(allUserIds);
        } else if (announcement.getTargetOrganizationIds() != null && !announcement.getTargetOrganizationIds().isEmpty()) {
            // Get users from specific organizations
            List<Long> orgUserIds = jdbc.queryForList(
                "SELECT id FROM users WHERE organization_id IN (:orgIds) AND enabled = true",
                new MapSqlParameterSource().addValue("orgIds", announcement.getTargetOrganizationIds()),
                Long.class
            );
            targetUserIds.addAll(orgUserIds);
        } else if (announcement.getTargetUserIds() != null) {
            targetUserIds.addAll(announcement.getTargetUserIds());
        }

        // Save announcement to database
        PlatformAnnouncement savedAnnouncement = PlatformAnnouncement.builder()
            .title(announcement.getTitle())
            .message(announcement.getMessage())
            .type(announcement.getType() != null ? announcement.getType() : "INFO")
            .sendToAll(announcement.isSendToAll())
            .targetOrganizationIds(announcement.getTargetOrganizationIds() != null ?
                announcement.getTargetOrganizationIds().stream()
                    .map(String::valueOf)
                    .collect(Collectors.joining(",")) : null)
            .targetUserIds(announcement.getTargetUserIds() != null ?
                announcement.getTargetUserIds().stream()
                    .map(String::valueOf)
                    .collect(Collectors.joining(",")) : null)
            .recipientsCount(targetUserIds.size())
            .sentAt(LocalDateTime.now())
            .scheduledAt(announcement.getScheduledAt() != null ?
                LocalDateTime.parse(announcement.getScheduledAt()) : null)
            .build();

        platformAnnouncementRepository.save(savedAnnouncement);
        platformAnnouncementRepository.flush(); // Ensure it's persisted

        // Send notifications - create in-app notifications directly via JDBC
        int successCount = 0;
        for (Long userId : targetUserIds) {
            try {
                // Get user's organization_id
                Long orgId = jdbc.queryForObject(
                    "SELECT organization_id FROM users WHERE id = :userId",
                    new MapSqlParameterSource().addValue("userId", userId),
                    Long.class
                );

                // Create in-app notification directly via JDBC
                jdbc.update(
                    "INSERT INTO user_notifications (user_id, organization_id, title, message, type, priority, read, created_at) " +
                    "VALUES (:userId, :orgId, :title, :message, 'PLATFORM_ANNOUNCEMENT', 'NORMAL', false, :createdAt)",
                    new MapSqlParameterSource()
                        .addValue("userId", userId)
                        .addValue("orgId", orgId != null ? orgId : 1L)
                        .addValue("title", announcement.getTitle())
                        .addValue("message", announcement.getMessage())
                        .addValue("createdAt", LocalDateTime.now())
                );
                successCount++;
            } catch (Exception e) {
                log.warn("Failed to create notification for user {}: {}", userId, e.getMessage());
            }
        }

        log.info("SUPERADMIN: Announcement saved. Notifications created for {}/{} users", successCount, targetUserIds.size());
    }

    @Override
    public Page<AnnouncementSummaryDTO> getAnnouncements(Pageable pageable) {
        log.info("SUPERADMIN: Fetching announcements");

        Page<PlatformAnnouncement> announcementsPage = platformAnnouncementRepository
            .findAllByOrderByCreatedAtDesc(pageable);

        List<AnnouncementSummaryDTO> announcements = announcementsPage.getContent().stream()
            .map(this::mapToAnnouncementSummary)
            .collect(Collectors.toList());

        return new PageImpl<>(announcements, pageable, announcementsPage.getTotalElements());
    }

    @Override
    @Transactional
    public void deleteAnnouncement(Long announcementId) {
        log.info("SUPERADMIN: Deleting announcement ID: {}", announcementId);

        if (!platformAnnouncementRepository.existsById(announcementId)) {
            throw new ApiException("Announcement not found with ID: " + announcementId);
        }

        platformAnnouncementRepository.deleteById(announcementId);
        log.info("SUPERADMIN: Announcement {} deleted", announcementId);
    }

    // ==================== INTEGRATIONS ====================

    @Override
    public List<IntegrationStatusDTO> getIntegrationStatus() {
        log.info("SUPERADMIN: Fetching integration status for all organizations");

        List<Organization> organizations = organizationRepository.findAll();

        return organizations.stream()
            .map(this::mapToIntegrationStatus)
            .collect(Collectors.toList());
    }

    // ==================== SECURITY ====================

    @Override
    public SecurityOverviewDTO getSecurityOverview() {
        log.info("SUPERADMIN: Fetching security overview");

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime last24h = now.minusDays(1);
        LocalDateTime last7d = now.minusDays(7);
        LocalDateTime last30d = now.minusDays(30);

        // Count total failed logins (all-time)
        Integer totalFailed = jdbc.queryForObject(
            "SELECT COUNT(*) FROM user_events ue " +
            "JOIN events e ON ue.event_id = e.id " +
            "WHERE e.type = 'LOGIN_ATTEMPT_FAILURE'",
            new MapSqlParameterSource(),
            Integer.class
        );

        // Count failed logins by time window
        Integer failedLast24h = jdbc.queryForObject(
            "SELECT COUNT(*) FROM user_events ue " +
            "JOIN events e ON ue.event_id = e.id " +
            "WHERE e.type = 'LOGIN_ATTEMPT_FAILURE' AND ue.created_at >= :since",
            new MapSqlParameterSource().addValue("since", last24h),
            Integer.class
        );

        Integer failedLast7d = jdbc.queryForObject(
            "SELECT COUNT(*) FROM user_events ue " +
            "JOIN events e ON ue.event_id = e.id " +
            "WHERE e.type = 'LOGIN_ATTEMPT_FAILURE' AND ue.created_at >= :since",
            new MapSqlParameterSource().addValue("since", last7d),
            Integer.class
        );

        Integer failedLast30d = jdbc.queryForObject(
            "SELECT COUNT(*) FROM user_events ue " +
            "JOIN events e ON ue.event_id = e.id " +
            "WHERE e.type = 'LOGIN_ATTEMPT_FAILURE' AND ue.created_at >= :since",
            new MapSqlParameterSource().addValue("since", last30d),
            Integer.class
        );

        // Count account lockouts (users with non_locked = false)
        Integer accountLockouts = jdbc.queryForObject(
            "SELECT COUNT(*) FROM users WHERE non_locked = false",
            new MapSqlParameterSource(),
            Integer.class
        );

        // Suspicious activity - IPs with 5+ failed logins (all-time)
        Integer suspiciousCount = jdbc.queryForObject(
            "SELECT COUNT(DISTINCT ip_address) FROM (" +
            "  SELECT ip_address, COUNT(*) as cnt FROM user_events ue " +
            "  JOIN events e ON ue.event_id = e.id " +
            "  WHERE e.type = 'LOGIN_ATTEMPT_FAILURE' " +
            "  GROUP BY ip_address HAVING COUNT(*) >= 5" +
            ") suspicious",
            new MapSqlParameterSource(),
            Integer.class
        );

        // Recent security events (last 10, no time filter — KPIs handle time windows)
        List<SecurityOverviewDTO.SecurityEventDTO> recentEvents = jdbc.query(
            "SELECT ue.id, e.type, u.email, o.name as org_name, ue.ip_address, e.description, ue.created_at " +
            "FROM user_events ue " +
            "JOIN events e ON ue.event_id = e.id " +
            "LEFT JOIN users u ON ue.user_id = u.id " +
            "LEFT JOIN organizations o ON ue.organization_id = o.id " +
            "WHERE e.type IN ('LOGIN_ATTEMPT_FAILURE', 'PASSWORD_UPDATE', 'MFA_UPDATE') " +
            "ORDER BY ue.created_at DESC LIMIT 10",
            new MapSqlParameterSource(),
            (rs, rowNum) -> SecurityOverviewDTO.SecurityEventDTO.builder()
                .id(rs.getLong("id"))
                .eventType(mapEventType(rs.getString("type")))
                .userEmail(rs.getString("email"))
                .organizationName(rs.getString("org_name"))
                .ipAddress(rs.getString("ip_address"))
                .description(rs.getString("description"))
                .timestamp(rs.getTimestamp("created_at") != null ?
                    rs.getTimestamp("created_at").toLocalDateTime() : null)
                .build()
        );

        return SecurityOverviewDTO.builder()
            .totalFailedLogins(totalFailed != null ? totalFailed : 0)
            .failedLoginsLast24h(failedLast24h != null ? failedLast24h : 0)
            .failedLoginsLast7d(failedLast7d != null ? failedLast7d : 0)
            .failedLoginsLast30d(failedLast30d != null ? failedLast30d : 0)
            .accountLockouts(accountLockouts != null ? accountLockouts : 0)
            .suspiciousActivityCount(suspiciousCount != null ? suspiciousCount : 0)
            .recentSecurityEvents(recentEvents)
            .build();
    }

    @Override
    public Page<FailedLoginDTO> getFailedLogins(Pageable pageable) {
        log.info("SUPERADMIN: Fetching failed logins");

        int offset = (int) pageable.getOffset();
        int pageSize = pageable.getPageSize();

        List<FailedLoginDTO> logins = jdbc.query(
            "SELECT ue.id, u.email, u.first_name, u.last_name, ue.organization_id, " +
            "o.name as org_name, ue.ip_address, ue.device, ue.created_at " +
            "FROM user_events ue " +
            "JOIN events e ON ue.event_id = e.id " +
            "LEFT JOIN users u ON ue.user_id = u.id " +
            "LEFT JOIN organizations o ON ue.organization_id = o.id " +
            "WHERE e.type = 'LOGIN_ATTEMPT_FAILURE' " +
            "ORDER BY ue.created_at DESC LIMIT :limit OFFSET :offset",
            new MapSqlParameterSource()
                .addValue("limit", pageSize)
                .addValue("offset", offset),
            (rs, rowNum) -> {
                String firstName = rs.getString("first_name");
                String lastName = rs.getString("last_name");
                String userName = firstName != null || lastName != null ?
                    ((firstName != null ? firstName : "") + " " + (lastName != null ? lastName : "")).trim() :
                    null;

                return FailedLoginDTO.builder()
                    .id(rs.getLong("id"))
                    .userEmail(rs.getString("email"))
                    .userName(userName)
                    .organizationId(rs.getLong("organization_id"))
                    .organizationName(rs.getString("org_name"))
                    .ipAddress(rs.getString("ip_address"))
                    .userAgent(rs.getString("device"))
                    .timestamp(rs.getTimestamp("created_at") != null ?
                        rs.getTimestamp("created_at").toLocalDateTime() : null)
                    .build();
            }
        );

        Integer total = jdbc.queryForObject(
            "SELECT COUNT(*) FROM user_events ue " +
            "JOIN events e ON ue.event_id = e.id " +
            "WHERE e.type = 'LOGIN_ATTEMPT_FAILURE'",
            new MapSqlParameterSource(),
            Integer.class
        );

        return new PageImpl<>(logins, pageable, total != null ? total : 0);
    }

    private IntegrationStatusDTO mapToIntegrationStatus(Organization org) {
        boolean hasIssues = false;
        StringBuilder issueDesc = new StringBuilder();

        boolean twilioConfigured = Boolean.TRUE.equals(org.getTwilioEnabled());
        boolean boldSignConfigured = org.getBoldsignApiKeyEncrypted() != null && !org.getBoldsignApiKeyEncrypted().isEmpty();

        // Twilio issue: explicitly enabled but missing phone number
        if (twilioConfigured &&
            (org.getTwilioPhoneNumber() == null || org.getTwilioPhoneNumber().isEmpty())) {
            hasIssues = true;
            issueDesc.append("Twilio enabled but no phone number configured. ");
        }

        return IntegrationStatusDTO.builder()
            .organizationId(org.getId())
            .organizationName(org.getName())
            .organizationSlug(org.getSlug())
            .status(org.getStatus() != null ? org.getStatus().name() : null)
            .twilioEnabled(twilioConfigured)
            .twilioPhoneNumber(org.getTwilioPhoneNumber())
            .boldSignEnabled(boldSignConfigured)
            .boldSignApiConfigured(boldSignConfigured)
            .smsEnabled(org.getSmsEnabled())
            .whatsappEnabled(org.getWhatsappEnabled())
            .emailEnabled(org.getEmailEnabled())
            .hasIssues(hasIssues)
            .issueDescription(hasIssues ? issueDesc.toString().trim() : null)
            .build();
    }

    // ==================== ORGANIZATION FEATURES ====================

    @Override
    public OrganizationFeaturesDTO getOrganizationFeatures(Long organizationId) {
        log.info("SUPERADMIN: Fetching features for organization ID: {}", organizationId);

        Organization org = organizationRepository.findById(organizationId)
            .orElseThrow(() -> new ApiException("Organization not found with ID: " + organizationId));

        return mapToOrganizationFeatures(org);
    }

    @Override
    @Transactional
    public OrganizationFeaturesDTO updateOrganizationFeatures(Long organizationId, OrganizationFeaturesDTO features) {
        log.info("SUPERADMIN: Updating features for organization ID: {}", organizationId);

        Organization org = organizationRepository.findById(organizationId)
            .orElseThrow(() -> new ApiException("Organization not found with ID: " + organizationId));

        // Update communication features
        if (features.getSmsEnabled() != null) org.setSmsEnabled(features.getSmsEnabled());
        if (features.getWhatsappEnabled() != null) org.setWhatsappEnabled(features.getWhatsappEnabled());
        if (features.getEmailEnabled() != null) org.setEmailEnabled(features.getEmailEnabled());

        // Update integration features
        if (features.getTwilioEnabled() != null) org.setTwilioEnabled(features.getTwilioEnabled());
        if (features.getBoldSignEnabled() != null) org.setBoldsignEnabled(features.getBoldSignEnabled());

        // Update quotas
        if (features.getMaxUsers() != null) org.setMaxUsers(features.getMaxUsers());
        if (features.getMaxCases() != null) org.setMaxCases(features.getMaxCases());
        if (features.getMaxStorageBytes() != null) org.setMaxStorageBytes(features.getMaxStorageBytes());

        // Update plan
        if (features.getPlanType() != null) {
            org.setPlanType(Organization.PlanType.valueOf(features.getPlanType()));
        }

        organizationRepository.save(org);

        return mapToOrganizationFeatures(org);
    }

    private OrganizationFeaturesDTO mapToOrganizationFeatures(Organization org) {
        return OrganizationFeaturesDTO.builder()
            .organizationId(org.getId())
            .smsEnabled(org.getSmsEnabled())
            .whatsappEnabled(org.getWhatsappEnabled())
            .emailEnabled(org.getEmailEnabled())
            .twilioEnabled(org.getTwilioEnabled())
            .boldSignEnabled(org.getBoldsignEnabled())
            .maxUsers(org.getMaxUsers())
            .maxCases(org.getMaxCases())
            .maxStorageBytes(org.getMaxStorageBytes())
            .planType(org.getPlanType() != null ? org.getPlanType().name() : null)
            .build();
    }

    private AnnouncementSummaryDTO mapToAnnouncementSummary(PlatformAnnouncement announcement) {
        // Parse comma-separated IDs back to lists
        List<Long> orgIds = null;
        if (announcement.getTargetOrganizationIds() != null && !announcement.getTargetOrganizationIds().isEmpty()) {
            orgIds = Arrays.stream(announcement.getTargetOrganizationIds().split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(Long::parseLong)
                .collect(Collectors.toList());
        }

        List<Long> userIds = null;
        if (announcement.getTargetUserIds() != null && !announcement.getTargetUserIds().isEmpty()) {
            userIds = Arrays.stream(announcement.getTargetUserIds().split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(Long::parseLong)
                .collect(Collectors.toList());
        }

        // Get creator name if available
        String createdByName = null;
        if (announcement.getCreatedBy() != null) {
            try {
                createdByName = jdbc.queryForObject(
                    "SELECT CONCAT(first_name, ' ', last_name) FROM users WHERE id = :id",
                    new MapSqlParameterSource().addValue("id", announcement.getCreatedBy()),
                    String.class
                );
            } catch (Exception e) {
                createdByName = "Unknown";
            }
        }

        return AnnouncementSummaryDTO.builder()
            .id(announcement.getId())
            .title(announcement.getTitle())
            .message(announcement.getMessage())
            .type(announcement.getType())
            .sendToAll(announcement.getSendToAll())
            .targetOrganizationIds(orgIds)
            .targetUserIds(userIds)
            .recipientsCount(announcement.getRecipientsCount())
            .scheduledAt(announcement.getScheduledAt())
            .sentAt(announcement.getSentAt())
            .createdBy(announcement.getCreatedBy())
            .createdByName(createdByName)
            .createdAt(announcement.getCreatedAt())
            .build();
    }

    // ==================== ADD USER TO ORGANIZATION ====================

    @Override
    @Transactional
    public Map<String, Object> addUserToOrganization(Long organizationId, CreateUserForOrgDTO dto) {
        log.info("SUPERADMIN: Adding user {} to organization ID: {}", dto.getEmail(), organizationId);

        // 1. Validate org exists and is ACTIVE
        Organization org = organizationRepository.findById(organizationId)
            .orElseThrow(() -> new ApiException("Organization not found with ID: " + organizationId));

        if (org.getStatus() != Organization.OrganizationStatus.ACTIVE) {
            throw new ApiException("Cannot add users to a non-active organization (status: " + org.getStatus() + ")");
        }

        // 2. Check email not already in use
        try {
            jdbc.queryForObject(
                "SELECT id FROM users WHERE email = :email",
                new MapSqlParameterSource().addValue("email", dto.getEmail()),
                Long.class
            );
            throw new ApiException("A user with email '" + dto.getEmail() + "' already exists");
        } catch (org.springframework.dao.EmptyResultDataAccessException ignored) {
            // Good - email is available
        }

        // 3. Check user quota not exceeded
        Integer currentUserCount = jdbc.queryForObject(
            "SELECT COUNT(*) FROM users WHERE organization_id = :orgId",
            new MapSqlParameterSource().addValue("orgId", organizationId),
            Integer.class
        );
        if (currentUserCount != null && currentUserCount >= org.getMaxUsers()) {
            throw new ApiException("Organization has reached its maximum user limit (" + org.getMaxUsers() + ")");
        }

        // 4. Generate temp password and encode
        String tempPassword = UUID.randomUUID().toString().substring(0, 8);
        String encodedPassword = passwordEncoder.encode(tempPassword);

        // 5. Insert user
        jdbc.update(
            "INSERT INTO users (first_name, last_name, email, password, organization_id, enabled, non_locked, using_mfa, created_at) " +
            "VALUES (:firstName, :lastName, :email, :password, :orgId, true, true, false, :createdAt)",
            new MapSqlParameterSource()
                .addValue("firstName", dto.getFirstName())
                .addValue("lastName", dto.getLastName())
                .addValue("email", dto.getEmail())
                .addValue("password", encodedPassword)
                .addValue("orgId", organizationId)
                .addValue("createdAt", LocalDateTime.now())
        );

        // Get the created user's ID
        Long userId = jdbc.queryForObject(
            "SELECT id FROM users WHERE email = :email",
            new MapSqlParameterSource().addValue("email", dto.getEmail()),
            Long.class
        );

        // 6. Look up role and assign (use exact name from roles table — no prefix manipulation)
        String roleName = dto.getRoleName();
        if (userId != null) {
            int rowsInserted = jdbc.update(
                "INSERT INTO user_roles (user_id, role_id) SELECT :userId, id FROM roles WHERE name = :roleName",
                new MapSqlParameterSource()
                    .addValue("userId", userId)
                    .addValue("roleName", roleName)
            );
            if (rowsInserted == 0) {
                throw new ApiException("Role '" + roleName.replace("ROLE_", "") + "' not found. User was not created.");
            }
        }

        // 7. Generate a one-time setup token so the user can set their own password
        if (userId == null) {
            throw new ApiException("Failed to create user - could not retrieve user ID");
        }
        String setupToken = UUID.randomUUID().toString();
        jdbc.update(
            "DELETE FROM reset_password_verifications WHERE user_id = :userId",
            new MapSqlParameterSource().addValue("userId", userId)
        );
        jdbc.update(
            "INSERT INTO reset_password_verifications (user_id, url, expiration_date) VALUES (:userId, :url, :expirationDate)",
            new MapSqlParameterSource()
                .addValue("userId", userId)
                .addValue("url", setupToken)
                .addValue("expirationDate", LocalDateTime.now().plusDays(7))
        );

        // 8. Send invitation email
        try {
            String inviteUrl = frontendBaseUrl + "/user/verify/password/" + setupToken;
            emailService.sendInvitationEmail(
                dto.getEmail(),
                org.getName(),
                roleName.replace("ROLE_", ""),
                inviteUrl,
                7
            );
        } catch (Exception e) {
            log.error("Failed to send invitation email to {}: {}", dto.getEmail(), e.getMessage());
        }

        // 9. Build and return UserDTO
        UserDTO userDTO = new UserDTO();
        userDTO.setId(userId);
        userDTO.setOrganizationId(organizationId);
        userDTO.setFirstName(dto.getFirstName());
        userDTO.setLastName(dto.getLastName());
        userDTO.setEmail(dto.getEmail());
        userDTO.setEnabled(true);
        userDTO.setNotLocked(true);
        userDTO.setUsingMFA(false);
        userDTO.setRoleName(roleName);
        userDTO.setRoles(List.of(roleName));
        userDTO.setCreatedAt(LocalDateTime.now());

        log.info("SUPERADMIN: User {} added to organization {} with role {}", dto.getEmail(), org.getName(), roleName);

        Map<String, Object> result = new HashMap<>();
        result.put("user", userDTO);
        return result;
    }

    @Override
    @Transactional
    public void resendInvitation(Long organizationId, Long userId) {
        log.info("SUPERADMIN: Resending invitation for user {} in organization {}", userId, organizationId);

        // Verify org exists and is active
        Organization org = organizationRepository.findById(organizationId)
            .orElseThrow(() -> new ApiException("Organization not found with ID: " + organizationId));

        if (org.getStatus() != Organization.OrganizationStatus.ACTIVE) {
            throw new ApiException("Cannot resend invitations for a non-active organization (status: " + org.getStatus() + ")");
        }

        // Verify user exists AND belongs to this organization
        Map<String, Object> userRow;
        try {
            userRow = jdbc.queryForMap(
                "SELECT id, email, first_name, last_name FROM users WHERE id = :userId AND organization_id = :orgId",
                new MapSqlParameterSource()
                    .addValue("userId", userId)
                    .addValue("orgId", organizationId)
            );
        } catch (org.springframework.dao.EmptyResultDataAccessException e) {
            throw new ApiException("User not found in this organization");
        }

        String email = (String) userRow.get("email");

        // Get user's role for the email
        String roleName = "User";
        try {
            roleName = jdbc.queryForObject(
                "SELECT r.name FROM roles r JOIN user_roles ur ON r.id = ur.role_id WHERE ur.user_id = :userId LIMIT 1",
                new MapSqlParameterSource().addValue("userId", userId),
                String.class
            );
            roleName = roleName.replace("ROLE_", "");
        } catch (org.springframework.dao.EmptyResultDataAccessException e) {
            log.debug("No role found for user {}, using default 'User' in email", userId);
        } catch (Exception e) {
            log.warn("Error fetching role for user {}: {}", userId, e.getMessage());
        }

        // Generate new setup token
        String setupToken = UUID.randomUUID().toString();
        jdbc.update(
            "DELETE FROM reset_password_verifications WHERE user_id = :userId",
            new MapSqlParameterSource().addValue("userId", userId)
        );
        jdbc.update(
            "INSERT INTO reset_password_verifications (user_id, url, expiration_date) VALUES (:userId, :url, :expirationDate)",
            new MapSqlParameterSource()
                .addValue("userId", userId)
                .addValue("url", setupToken)
                .addValue("expirationDate", LocalDateTime.now().plusDays(7))
        );

        // Send invitation email
        try {
            String inviteUrl = frontendBaseUrl + "/user/verify/password/" + setupToken;
            emailService.sendInvitationEmail(email, org.getName(), roleName, inviteUrl, 7);
        } catch (Exception e) {
            log.error("Failed to send invitation email to {}: {}", email, e.getMessage());
            throw new ApiException("Failed to send invitation email. Please try again.");
        }

        log.info("SUPERADMIN: Invitation resent to {} for organization {}", email, org.getName());
    }

    @Override
    public List<RoleSummaryDTO> getAvailableRoles() {
        log.info("SUPERADMIN: Fetching available roles");
        return jdbc.query(
            "SELECT id, name, display_name, hierarchy_level, is_system_role FROM roles WHERE is_active = true AND name NOT IN ('ROLE_SUPERADMIN', 'ROLE_CLIENT') ORDER BY hierarchy_level DESC",
            new MapSqlParameterSource(),
            (rs, rowNum) -> RoleSummaryDTO.builder()
                .id(rs.getLong("id"))
                .name(rs.getString("name"))
                .displayName(rs.getString("display_name"))
                .hierarchyLevel(rs.getInt("hierarchy_level"))
                .isSystemRole(rs.getBoolean("is_system_role"))
                .build()
        );
    }

    // ==================== CHANGE USER ROLE ====================

    @Override
    @Transactional
    public void changeUserRole(Long userId, String roleName) {
        log.info("SUPERADMIN: Changing role for user {} to {}", userId, roleName);

        // Validate user exists
        Integer userCount = jdbc.queryForObject(
            "SELECT COUNT(*) FROM users WHERE id = :userId",
            new MapSqlParameterSource().addValue("userId", userId),
            Integer.class
        );
        if (userCount == null || userCount == 0) {
            throw new ApiException("User not found with ID: " + userId);
        }

        // Block SUPERADMIN assignment
        if ("ROLE_SUPERADMIN".equalsIgnoreCase(roleName)) {
            throw new ApiException("Cannot assign SUPERADMIN role through this endpoint");
        }

        // Block ROLE_CLIENT assignment — clients must be created through client intake flow
        if ("ROLE_CLIENT".equalsIgnoreCase(roleName)) {
            throw new ApiException("Cannot assign CLIENT role directly. Clients must be created through the client intake process.");
        }

        // Block changing a SUPERADMIN user's role (prevent accidental demotion)
        try {
            Integer isSuperAdmin = jdbc.queryForObject(
                "SELECT COUNT(*) FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = :userId AND r.name = 'ROLE_SUPERADMIN'",
                new MapSqlParameterSource().addValue("userId", userId),
                Integer.class
            );
            if (isSuperAdmin != null && isSuperAdmin > 0) {
                throw new ApiException("Cannot change the role of a SUPERADMIN user");
            }
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error checking SUPERADMIN status for user {}: {}", userId, e.getMessage());
            throw new ApiException("Unable to verify user role status. Please try again.");
        }

        // Validate role exists and is active
        Long roleId;
        try {
            roleId = jdbc.queryForObject(
                "SELECT id FROM roles WHERE name = :roleName AND is_active = true",
                new MapSqlParameterSource().addValue("roleName", roleName),
                Long.class
            );
        } catch (org.springframework.dao.EmptyResultDataAccessException e) {
            throw new ApiException("Role '" + roleName + "' not found or inactive");
        }

        // Get old role for audit trail
        String oldRole = "NONE";
        try {
            oldRole = jdbc.queryForObject(
                "SELECT r.name FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = :userId AND ur.is_primary = true",
                new MapSqlParameterSource().addValue("userId", userId),
                String.class
            );
        } catch (Exception ignored) {}

        // Delete existing roles and assign new one
        jdbc.update(
            "DELETE FROM user_roles WHERE user_id = :userId",
            new MapSqlParameterSource().addValue("userId", userId)
        );

        jdbc.update(
            "INSERT INTO user_roles (user_id, role_id, is_primary) VALUES (:userId, :roleId, true)",
            new MapSqlParameterSource()
                .addValue("userId", userId)
                .addValue("roleId", roleId)
        );

        log.info("SUPERADMIN: Role changed from {} to {} for user {}", oldRole, roleName, userId);
    }

    // ==================== SESSION MANAGEMENT ====================

    @Override
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getUserSessions(Long userId) {
        log.info("SUPERADMIN: Fetching sessions for user {}", userId);

        Integer userCount = jdbc.queryForObject(
            "SELECT COUNT(*) FROM users WHERE id = :userId",
            new MapSqlParameterSource().addValue("userId", userId),
            Integer.class
        );
        if (userCount == null || userCount == 0) {
            throw new ApiException("User not found with ID: " + userId);
        }

        return jdbc.queryForList(
            "SELECT ue.device, ue.ip_address, ue.created_at as login_time, e.type as event_type " +
            "FROM user_events ue " +
            "JOIN events e ON ue.event_id = e.id " +
            "WHERE ue.user_id = :userId AND e.type = 'LOGIN_ATTEMPT_SUCCESS' " +
            "ORDER BY ue.created_at DESC LIMIT 50",
            new MapSqlParameterSource().addValue("userId", userId)
        );
    }

    @Override
    @Transactional
    public void terminateUserSessions(Long userId) {
        log.info("SUPERADMIN: Terminating all sessions for user {}", userId);

        Integer count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM users WHERE id = :userId",
            new MapSqlParameterSource().addValue("userId", userId),
            Integer.class
        );
        if (count == null || count == 0) {
            throw new ApiException("User not found with ID: " + userId);
        }

        tokenBlacklistService.blacklistAllUserTokens(userId);
        log.info("SUPERADMIN: All sessions terminated for user {}", userId);
    }

    // ==================== SYSTEM HEALTH SESSIONS ====================

    @Override
    @Transactional(readOnly = true)
    public List<ActiveSessionDTO> getActiveSessions(String window) {
        log.info("SUPERADMIN: Fetching active sessions for window: {}", window);

        int hours;
        switch (window != null ? window : "1h") {
            case "6h": hours = 6; break;
            case "24h": hours = 24; break;
            default: hours = 1; break;
        }

        String sql = "SELECT DISTINCT ON (ue.user_id) " +
                "ue.user_id, u.first_name, u.last_name, u.email, " +
                "u.organization_id, COALESCE(o.name, 'Platform') as org_name, " +
                "ue.device, ue.ip_address, ue.created_at as login_time " +
                "FROM user_events ue " +
                "JOIN users u ON ue.user_id = u.id " +
                "JOIN events e ON ue.event_id = e.id " +
                "LEFT JOIN organizations o ON u.organization_id = o.id " +
                "WHERE e.type = 'LOGIN_ATTEMPT_SUCCESS' " +
                "AND ue.created_at > NOW() - (:hours * INTERVAL '1 hour') " +
                "ORDER BY ue.user_id, ue.created_at DESC";

        MapSqlParameterSource sessionParams = new MapSqlParameterSource().addValue("hours", hours);

        return jdbc.query(sql, sessionParams, (rs, rowNum) ->
            ActiveSessionDTO.builder()
                .userId(rs.getLong("user_id"))
                .firstName(rs.getString("first_name"))
                .lastName(rs.getString("last_name"))
                .email(rs.getString("email"))
                .organizationId(rs.getObject("organization_id") != null ? rs.getLong("organization_id") : null)
                .organizationName(rs.getString("org_name"))
                .device(rs.getString("device"))
                .ipAddress(rs.getString("ip_address"))
                .loginTime(rs.getTimestamp("login_time") != null ? rs.getTimestamp("login_time").toLocalDateTime() : null)
                .build()
        );
    }

    @Override
    @Transactional(readOnly = true)
    public Page<LoginEventDTO> getLoginEvents(Pageable pageable) {
        log.info("SUPERADMIN: Fetching login events page {} size {}", pageable.getPageNumber(), pageable.getPageSize());

        String countSql = "SELECT COUNT(*) FROM user_events ue " +
                "JOIN events e ON ue.event_id = e.id " +
                "WHERE e.type IN ('LOGIN_ATTEMPT_SUCCESS', 'LOGIN_ATTEMPT_FAILURE')";

        Integer total = jdbc.queryForObject(countSql, new MapSqlParameterSource(), Integer.class);
        if (total == null || total == 0) {
            return new org.springframework.data.domain.PageImpl<>(List.of(), pageable, 0);
        }

        String sql = "SELECT ue.id, ue.user_id, u.email, " +
                "(u.first_name || ' ' || u.last_name) as user_name, " +
                "u.organization_id, COALESCE(o.name, 'Platform') as org_name, " +
                "ue.device, ue.ip_address, e.type as event_type, ue.created_at " +
                "FROM user_events ue " +
                "JOIN users u ON ue.user_id = u.id " +
                "JOIN events e ON ue.event_id = e.id " +
                "LEFT JOIN organizations o ON u.organization_id = o.id " +
                "WHERE e.type IN ('LOGIN_ATTEMPT_SUCCESS', 'LOGIN_ATTEMPT_FAILURE') " +
                "ORDER BY ue.created_at DESC " +
                "LIMIT :limit OFFSET :offset";

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("limit", pageable.getPageSize())
                .addValue("offset", pageable.getOffset());

        List<LoginEventDTO> events = jdbc.query(sql, params, (rs, rowNum) ->
            LoginEventDTO.builder()
                .id(rs.getLong("id"))
                .userId(rs.getLong("user_id"))
                .userEmail(rs.getString("email"))
                .userName(rs.getString("user_name"))
                .organizationId(rs.getObject("organization_id") != null ? rs.getLong("organization_id") : null)
                .organizationName(rs.getString("org_name"))
                .device(rs.getString("device"))
                .ipAddress(rs.getString("ip_address"))
                .eventType(rs.getString("event_type"))
                .timestamp(rs.getTimestamp("created_at") != null ? rs.getTimestamp("created_at").toLocalDateTime() : null)
                .build()
        );

        return new org.springframework.data.domain.PageImpl<>(events, pageable, total);
    }

    // ==================== DASHBOARD DRILL-DOWNS ====================

    @Override
    public List<DashboardDrillDownDTO.OrgActiveUsers> getActiveUsersByOrg() {
        log.info("SUPERADMIN: Fetching active users by organization");
        LocalDateTime since = LocalDateTime.now().minusDays(1);

        return jdbc.query(
            "SELECT o.id as org_id, o.name as org_name, " +
            "  COUNT(DISTINCT CASE WHEN ue.created_at >= :since AND e.type = 'LOGIN_ATTEMPT_SUCCESS' THEN ue.user_id END) as active_users, " +
            "  COUNT(DISTINCT u.id) as total_users " +
            "FROM organizations o " +
            "LEFT JOIN users u ON u.organization_id = o.id " +
            "LEFT JOIN user_events ue ON ue.user_id = u.id " +
            "LEFT JOIN events e ON ue.event_id = e.id " +
            "WHERE o.status != 'DELETED' " +
            "GROUP BY o.id, o.name " +
            "ORDER BY active_users DESC",
            new MapSqlParameterSource().addValue("since", since),
            (rs, rowNum) -> {
                int active = rs.getInt("active_users");
                int total = rs.getInt("total_users");
                return DashboardDrillDownDTO.OrgActiveUsers.builder()
                    .organizationId(rs.getLong("org_id"))
                    .organizationName(rs.getString("org_name"))
                    .activeUsers24h(active)
                    .totalUsers(total)
                    .activityPercent(total > 0 ? Math.round(active * 1000.0 / total) / 10.0 : 0)
                    .build();
            }
        );
    }

    @Override
    public List<DashboardDrillDownDTO.UserActivity> getActiveUsersForOrg(Long orgId) {
        log.info("SUPERADMIN: Fetching active user details for org {}", orgId);
        LocalDateTime since = LocalDateTime.now().minusDays(1);

        return jdbc.query(
            "SELECT u.id, u.first_name, u.last_name, u.email, " +
            "  MAX(ue.created_at) as last_login, " +
            "  COUNT(ue.id) as login_count, " +
            "  (SELECT ue2.device FROM user_events ue2 JOIN events e2 ON ue2.event_id = e2.id " +
            "   WHERE ue2.user_id = u.id AND e2.type = 'LOGIN_ATTEMPT_SUCCESS' " +
            "   ORDER BY ue2.created_at DESC LIMIT 1) as last_device, " +
            "  (SELECT ue3.ip_address FROM user_events ue3 JOIN events e3 ON ue3.event_id = e3.id " +
            "   WHERE ue3.user_id = u.id AND e3.type = 'LOGIN_ATTEMPT_SUCCESS' " +
            "   ORDER BY ue3.created_at DESC LIMIT 1) as last_ip " +
            "FROM users u " +
            "JOIN user_events ue ON ue.user_id = u.id " +
            "JOIN events e ON ue.event_id = e.id " +
            "WHERE u.organization_id = :orgId " +
            "AND e.type = 'LOGIN_ATTEMPT_SUCCESS' " +
            "AND ue.created_at >= :since " +
            "GROUP BY u.id, u.first_name, u.last_name, u.email " +
            "ORDER BY last_login DESC",
            new MapSqlParameterSource()
                .addValue("orgId", orgId)
                .addValue("since", since),
            (rs, rowNum) -> DashboardDrillDownDTO.UserActivity.builder()
                .userId(rs.getLong("id"))
                .firstName(rs.getString("first_name"))
                .lastName(rs.getString("last_name"))
                .email(rs.getString("email"))
                .lastLogin(rs.getTimestamp("last_login") != null ?
                    rs.getTimestamp("last_login").toLocalDateTime() : null)
                .loginCount24h(rs.getInt("login_count"))
                .lastDevice(rs.getString("last_device"))
                .lastIpAddress(rs.getString("last_ip"))
                .build()
        );
    }

    @Override
    public List<DashboardDrillDownDTO.UserSession> getUserSessionsDrillDown(Long orgId, Long userId) {
        log.info("SUPERADMIN: Fetching sessions for user {} in org {}", userId, orgId);

        return jdbc.query(
            "SELECT ue.created_at, ue.device, ue.ip_address, e.type " +
            "FROM user_events ue " +
            "JOIN events e ON ue.event_id = e.id " +
            "WHERE ue.user_id = :userId " +
            "AND (ue.organization_id = :orgId OR ue.organization_id IS NULL) " +
            "AND e.type IN ('LOGIN_ATTEMPT_SUCCESS', 'LOGIN_ATTEMPT_FAILURE') " +
            "ORDER BY ue.created_at DESC LIMIT 20",
            new MapSqlParameterSource()
                .addValue("userId", userId)
                .addValue("orgId", orgId),
            (rs, rowNum) -> DashboardDrillDownDTO.UserSession.builder()
                .loginTime(rs.getTimestamp("created_at") != null ?
                    rs.getTimestamp("created_at").toLocalDateTime() : null)
                .device(rs.getString("device"))
                .ipAddress(rs.getString("ip_address"))
                .eventType(rs.getString("type").contains("SUCCESS") ? "SUCCESS" : "FAILURE")
                .build()
        );
    }

    @Override
    public List<DashboardDrillDownDTO.OrgApiRequests> getRequestsByOrg(String timeWindow) {
        log.info("SUPERADMIN: Fetching API requests by org, window={}", timeWindow);
        LocalDateTime since = getTimeWindowStart(timeWindow);

        return jdbc.query(
            "SELECT COALESCE(al.organization_id, 0) as org_id, " +
            "  COALESCE(o.name, 'Platform / System') as org_name, " +
            "  COUNT(*) as request_count " +
            "FROM audit_log al " +
            "LEFT JOIN organizations o ON al.organization_id = o.id " +
            "WHERE al.timestamp >= :since " +
            "GROUP BY COALESCE(al.organization_id, 0), COALESCE(o.name, 'Platform / System') " +
            "ORDER BY request_count DESC",
            new MapSqlParameterSource().addValue("since", since),
            (rs, rowNum) -> {
                long orgIdVal = rs.getLong("org_id");
                return DashboardDrillDownDTO.OrgApiRequests.builder()
                    .organizationId(orgIdVal == 0 ? null : orgIdVal)
                    .organizationName(rs.getString("org_name"))
                    .requestCount(rs.getInt("request_count"))
                    .topAction(null) // populated via breakdown endpoint
                    .build();
            }
        );
    }

    @Override
    public List<DashboardDrillDownDTO.EndpointBreakdown> getRequestBreakdownForOrg(Long orgId, String timeWindow) {
        log.info("SUPERADMIN: Fetching request breakdown for org {}", orgId);
        LocalDateTime since = getTimeWindowStart(timeWindow);

        // Treat orgId=0 as null (Platform/System requests have no org)
        Long effectiveOrgId = (orgId != null && orgId == 0L) ? null : orgId;
        String orgFilter = effectiveOrgId != null ? "al.organization_id = :orgId" : "al.organization_id IS NULL";
        MapSqlParameterSource params = new MapSqlParameterSource().addValue("since", since);
        if (effectiveOrgId != null) params.addValue("orgId", effectiveOrgId);

        return jdbc.query(
            "SELECT al.action, al.entity_type, COUNT(*) as cnt, MAX(al.timestamp) as last_hit " +
            "FROM audit_log al " +
            "WHERE " + orgFilter + " AND al.timestamp >= :since " +
            "GROUP BY al.action, al.entity_type " +
            "ORDER BY cnt DESC",
            params,
            (rs, rowNum) -> DashboardDrillDownDTO.EndpointBreakdown.builder()
                .action(rs.getString("action"))
                .entityType(rs.getString("entity_type"))
                .count(rs.getInt("cnt"))
                .lastHit(rs.getTimestamp("last_hit") != null ?
                    rs.getTimestamp("last_hit").toLocalDateTime() : null)
                .build()
        );
    }

    @Override
    public List<DashboardDrillDownDTO.OrgStorage> getStorageByOrg() {
        log.info("SUPERADMIN: Fetching storage usage by org");

        return jdbc.query(
            "SELECT o.id as org_id, o.name as org_name, " +
            "  COALESCE((SELECT SUM(d.file_size) FROM documents d WHERE d.organization_id = o.id), 0) as storage_used, " +
            "  (SELECT COUNT(*) FROM documents d WHERE d.organization_id = o.id) as doc_count, " +
            "  (SELECT COUNT(*) FROM legal_cases lc WHERE lc.organization_id = o.id) + " +
            "  (SELECT COUNT(*) FROM clients c WHERE c.organization_id = o.id) + " +
            "  (SELECT COUNT(*) FROM documents d WHERE d.organization_id = o.id) + " +
            "  (SELECT COUNT(*) FROM invoices i WHERE i.organization_id = o.id) as db_rows, " +
            "  CASE WHEN o.max_storage_bytes > 0 THEN " +
            "    ROUND(COALESCE((SELECT SUM(d.file_size) FROM documents d WHERE d.organization_id = o.id), 0) * 100.0 / o.max_storage_bytes, 1) " +
            "  ELSE NULL END as quota_pct " +
            "FROM organizations o " +
            "WHERE o.status != 'DELETED' " +
            "ORDER BY storage_used DESC",
            new MapSqlParameterSource(),
            (rs, rowNum) -> {
                Double quotaPct = rs.getObject("quota_pct") != null ? rs.getDouble("quota_pct") : null;
                return DashboardDrillDownDTO.OrgStorage.builder()
                    .organizationId(rs.getLong("org_id"))
                    .organizationName(rs.getString("org_name"))
                    .storageUsedBytes(rs.getLong("storage_used"))
                    .documentCount(rs.getInt("doc_count"))
                    .dbRows(rs.getInt("db_rows"))
                    .quotaPercent(quotaPct)
                    .build();
            }
        );
    }

    @Override
    public List<DashboardDrillDownDTO.OrgErrors> getErrorsByOrg() {
        log.info("SUPERADMIN: Fetching errors by org");
        LocalDateTime since = LocalDateTime.now().minusDays(1);

        return jdbc.query(
            "SELECT COALESCE(ue.organization_id, 0) as org_id, " +
            "  COALESCE(o.name, 'Unknown') as org_name, " +
            "  COUNT(*) as error_count, " +
            "  MAX(ue.created_at) as last_error " +
            "FROM user_events ue " +
            "JOIN events e ON ue.event_id = e.id " +
            "LEFT JOIN organizations o ON ue.organization_id = o.id " +
            "WHERE e.type = 'LOGIN_ATTEMPT_FAILURE' AND ue.created_at >= :since " +
            "GROUP BY COALESCE(ue.organization_id, 0), COALESCE(o.name, 'Unknown') " +
            "ORDER BY error_count DESC",
            new MapSqlParameterSource().addValue("since", since),
            (rs, rowNum) -> {
                long orgIdVal = rs.getLong("org_id");
                return DashboardDrillDownDTO.OrgErrors.builder()
                    .organizationId(orgIdVal == 0 ? null : orgIdVal)
                    .organizationName(rs.getString("org_name"))
                    .errorCount24h(rs.getInt("error_count"))
                    .lastError(rs.getTimestamp("last_error") != null ?
                        rs.getTimestamp("last_error").toLocalDateTime() : null)
                    .lastErrorType("LOGIN_ATTEMPT_FAILURE")
                    .build();
            }
        );
    }

    @Override
    public List<DashboardDrillDownDTO.OrgSecurity> getSecurityByOrg() {
        log.info("SUPERADMIN: Fetching security metrics by org");

        return jdbc.query(
            "SELECT o.id as org_id, o.name as org_name, " +
            "  (SELECT COUNT(*) FROM user_events ue JOIN events e ON ue.event_id = e.id " +
            "   WHERE e.type = 'LOGIN_ATTEMPT_FAILURE' AND ue.organization_id = o.id) as failed_logins, " +
            "  (SELECT COUNT(*) FROM users u WHERE u.organization_id = o.id AND u.non_locked = false) as lockouts, " +
            "  (SELECT COUNT(DISTINCT ue.ip_address) FROM (" +
            "    SELECT ue.ip_address FROM user_events ue JOIN events e ON ue.event_id = e.id " +
            "    WHERE e.type = 'LOGIN_ATTEMPT_FAILURE' AND ue.organization_id = o.id " +
            "    GROUP BY ue.ip_address HAVING COUNT(*) >= 5" +
            "  ) ue) as suspicious_ips " +
            "FROM organizations o " +
            "WHERE o.status != 'DELETED' " +
            "ORDER BY failed_logins DESC",
            new MapSqlParameterSource(),
            (rs, rowNum) -> DashboardDrillDownDTO.OrgSecurity.builder()
                .organizationId(rs.getLong("org_id"))
                .organizationName(rs.getString("org_name"))
                .failedLogins(rs.getInt("failed_logins"))
                .accountLockouts(rs.getInt("lockouts"))
                .suspiciousIps(rs.getInt("suspicious_ips"))
                .build()
        );
    }

    // ==================== ENGAGEMENT & GROWTH ====================

    @Override
    public DashboardDrillDownDTO.EngagementMetrics getEngagementMetrics() {
        log.info("SUPERADMIN: Fetching engagement metrics");
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime dayAgo = now.minusDays(1);
        LocalDateTime weekAgo = now.minusDays(7);
        LocalDateTime monthAgo = now.minusDays(30);

        String countQuery = "SELECT COUNT(DISTINCT ue.user_id) FROM user_events ue " +
            "JOIN events e ON ue.event_id = e.id " +
            "WHERE e.type = 'LOGIN_ATTEMPT_SUCCESS' AND ue.created_at >= :since";

        Integer dau = jdbc.queryForObject(countQuery,
            new MapSqlParameterSource().addValue("since", dayAgo), Integer.class);
        Integer wau = jdbc.queryForObject(countQuery,
            new MapSqlParameterSource().addValue("since", weekAgo), Integer.class);
        Integer mau = jdbc.queryForObject(countQuery,
            new MapSqlParameterSource().addValue("since", monthAgo), Integer.class);

        int dauVal = dau != null ? dau : 0;
        int wauVal = wau != null ? wau : 0;
        int mauVal = mau != null ? mau : 0;

        Integer totalLoginsToday = jdbc.queryForObject(
            "SELECT COUNT(*) FROM user_events ue JOIN events e ON ue.event_id = e.id " +
            "WHERE e.type = 'LOGIN_ATTEMPT_SUCCESS' AND ue.created_at >= :since",
            new MapSqlParameterSource().addValue("since", dayAgo), Integer.class);
        double avgLogins = dauVal > 0 ?
            Math.round((totalLoginsToday != null ? totalLoginsToday : 0) * 10.0 / dauVal) / 10.0 : 0;

        List<DashboardDrillDownDTO.OrgEngagement> byOrg = jdbc.query(
            "SELECT o.id as org_id, o.name as org_name, " +
            "  COUNT(DISTINCT CASE WHEN ue.created_at >= :dayAgo THEN ue.user_id END) as dau, " +
            "  COUNT(DISTINCT CASE WHEN ue.created_at >= :weekAgo THEN ue.user_id END) as wau, " +
            "  COUNT(DISTINCT CASE WHEN ue.created_at >= :monthAgo THEN ue.user_id END) as mau " +
            "FROM organizations o " +
            "LEFT JOIN users u ON u.organization_id = o.id " +
            "LEFT JOIN user_events ue ON ue.user_id = u.id " +
            "LEFT JOIN events e ON ue.event_id = e.id AND e.type = 'LOGIN_ATTEMPT_SUCCESS' " +
            "WHERE o.status != 'DELETED' " +
            "GROUP BY o.id, o.name ORDER BY dau DESC",
            new MapSqlParameterSource()
                .addValue("dayAgo", dayAgo)
                .addValue("weekAgo", weekAgo)
                .addValue("monthAgo", monthAgo),
            (rs, rowNum) -> DashboardDrillDownDTO.OrgEngagement.builder()
                .organizationId(rs.getLong("org_id"))
                .organizationName(rs.getString("org_name"))
                .dau(rs.getInt("dau"))
                .wau(rs.getInt("wau"))
                .mau(rs.getInt("mau"))
                .build()
        );

        return DashboardDrillDownDTO.EngagementMetrics.builder()
            .dau(dauVal).wau(wauVal).mau(mauVal)
            .dauWauRatio(wauVal > 0 ? Math.round(dauVal * 1000.0 / wauVal) / 1000.0 : 0)
            .avgLoginsPerUserPerDay(avgLogins)
            .byOrganization(byOrg)
            .build();
    }

    @Override
    public DashboardDrillDownDTO.DataGrowth getDataGrowth() {
        log.info("SUPERADMIN: Fetching data growth metrics");
        LocalDate today = LocalDate.now();
        LocalDate thisWeekStart = today.minusDays(7);
        LocalDate lastWeekStart = today.minusDays(14);

        MapSqlParameterSource params = new MapSqlParameterSource()
            .addValue("thisWeekStart", thisWeekStart)
            .addValue("lastWeekStart", lastWeekStart)
            .addValue("lastWeekEnd", thisWeekStart);

        Integer casesThisWeek = jdbc.queryForObject(
            "SELECT COUNT(*) FROM legal_cases WHERE DATE(created_at) >= :thisWeekStart", params, Integer.class);
        Integer casesLastWeek = jdbc.queryForObject(
            "SELECT COUNT(*) FROM legal_cases WHERE DATE(created_at) >= :lastWeekStart AND DATE(created_at) < :lastWeekEnd", params, Integer.class);
        Integer docsThisWeek = jdbc.queryForObject(
            "SELECT COUNT(*) FROM documents WHERE DATE(uploaded_at) >= :thisWeekStart", params, Integer.class);
        Integer docsLastWeek = jdbc.queryForObject(
            "SELECT COUNT(*) FROM documents WHERE DATE(uploaded_at) >= :lastWeekStart AND DATE(uploaded_at) < :lastWeekEnd", params, Integer.class);
        Integer clientsThisWeek = jdbc.queryForObject(
            "SELECT COUNT(*) FROM clients WHERE DATE(created_at) >= :thisWeekStart", params, Integer.class);
        Integer clientsLastWeek = jdbc.queryForObject(
            "SELECT COUNT(*) FROM clients WHERE DATE(created_at) >= :lastWeekStart AND DATE(created_at) < :lastWeekEnd", params, Integer.class);

        List<DashboardDrillDownDTO.OrgDataGrowth> byOrg = jdbc.query(
            "SELECT o.id as org_id, o.name as org_name, " +
            "  (SELECT COUNT(*) FROM legal_cases lc WHERE lc.organization_id = o.id AND DATE(lc.created_at) >= :thisWeekStart) as cases, " +
            "  (SELECT COUNT(*) FROM documents d WHERE d.organization_id = o.id AND DATE(d.uploaded_at) >= :thisWeekStart) as docs, " +
            "  (SELECT COUNT(*) FROM clients c WHERE c.organization_id = o.id AND DATE(c.created_at) >= :thisWeekStart) as clients " +
            "FROM organizations o WHERE o.status != 'DELETED' ORDER BY cases DESC",
            new MapSqlParameterSource().addValue("thisWeekStart", thisWeekStart),
            (rs, rowNum) -> DashboardDrillDownDTO.OrgDataGrowth.builder()
                .organizationId(rs.getLong("org_id"))
                .organizationName(rs.getString("org_name"))
                .casesThisWeek(rs.getInt("cases"))
                .documentsThisWeek(rs.getInt("docs"))
                .clientsThisWeek(rs.getInt("clients"))
                .build()
        );

        return DashboardDrillDownDTO.DataGrowth.builder()
            .casesThisWeek(casesThisWeek != null ? casesThisWeek : 0)
            .casesLastWeek(casesLastWeek != null ? casesLastWeek : 0)
            .documentsThisWeek(docsThisWeek != null ? docsThisWeek : 0)
            .documentsLastWeek(docsLastWeek != null ? docsLastWeek : 0)
            .clientsThisWeek(clientsThisWeek != null ? clientsThisWeek : 0)
            .clientsLastWeek(clientsLastWeek != null ? clientsLastWeek : 0)
            .byOrganization(byOrg)
            .build();
    }

    @Override
    public DashboardDrillDownDTO.FeatureAdoption getFeatureAdoption() {
        log.info("SUPERADMIN: Fetching feature adoption metrics");

        return jdbc.queryForObject(
            "SELECT COUNT(*) as total, " +
            "  COUNT(*) FILTER (WHERE sms_enabled = true) as sms, " +
            "  COUNT(*) FILTER (WHERE whatsapp_enabled = true) as whatsapp, " +
            "  COUNT(*) FILTER (WHERE email_enabled = true) as email, " +
            "  COUNT(*) FILTER (WHERE boldsign_enabled = true) as boldsign, " +
            "  COUNT(*) FILTER (WHERE twilio_enabled = true) as twilio " +
            "FROM organizations WHERE status != 'DELETED'",
            new MapSqlParameterSource(),
            (rs, rowNum) -> DashboardDrillDownDTO.FeatureAdoption.builder()
                .totalOrganizations(rs.getInt("total"))
                .smsEnabled(rs.getInt("sms"))
                .whatsappEnabled(rs.getInt("whatsapp"))
                .emailEnabled(rs.getInt("email"))
                .boldSignEnabled(rs.getInt("boldsign"))
                .twilioEnabled(rs.getInt("twilio"))
                .build()
        );
    }

    /** Map database event types to frontend-expected security event types */
    private String mapEventType(String dbEventType) {
        if (dbEventType == null) return "FAILED_LOGIN";
        switch (dbEventType) {
            case "LOGIN_ATTEMPT_FAILURE": return "FAILED_LOGIN";
            case "PASSWORD_UPDATE": return "PASSWORD_RESET";
            case "MFA_UPDATE": return "PASSWORD_RESET";
            case "ACCOUNT_LOCKED": return "ACCOUNT_LOCKOUT";
            default: return "FAILED_LOGIN";
        }
    }

    private LocalDateTime getTimeWindowStart(String timeWindow) {
        LocalDateTime now = LocalDateTime.now();
        if (timeWindow == null) return now.minusHours(1);
        switch (timeWindow) {
            case "1h": return now.minusHours(1);
            case "24h": return now.minusDays(1);
            case "7d": return now.minusDays(7);
            default: return now.minusHours(1);
        }
    }
}
