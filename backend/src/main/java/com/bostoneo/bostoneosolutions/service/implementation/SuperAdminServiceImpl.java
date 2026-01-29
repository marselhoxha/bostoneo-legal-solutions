package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.dto.superadmin.*;
import com.bostoneo.bostoneosolutions.enumeration.CaseStatus;
import com.bostoneo.bostoneosolutions.enumeration.InvoiceStatus;
import com.bostoneo.bostoneosolutions.enumeration.VerificationType;
import com.bostoneo.bostoneosolutions.exception.ApiException;
import com.bostoneo.bostoneosolutions.model.*;
import com.bostoneo.bostoneosolutions.repository.*;
import com.bostoneo.bostoneosolutions.rowmapper.UserRowMapper;
import com.bostoneo.bostoneosolutions.service.EmailService;
import com.bostoneo.bostoneosolutions.service.NotificationService;
import com.bostoneo.bostoneosolutions.service.SuperAdminService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
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
    private final NamedParameterJdbcTemplate jdbc;
    private final RoleRepository<Role> roleRepository;
    private final EmailService emailService;
    private final NotificationService notificationService;
    private final BCryptPasswordEncoder passwordEncoder;

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

        Page<Organization> orgsPage = organizationRepository.findAll(pageable);

        List<OrganizationWithStatsDTO> orgsWithStats = orgsPage.getContent().stream()
            .map(this::mapToOrganizationWithStats)
            .collect(Collectors.toList());

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

        // Error counts
        LocalDateTime oneHourAgo = now.minusHours(1);
        LocalDateTime oneDayAgo = now.minusDays(1);

        // Count errors (simplified - in production would query error logs)
        int errorCountLastHour = 0;
        int errorCountLast24Hours = 0;

        // Active sessions (count recent activity)
        Integer activeSessions = jdbc.queryForObject(
            "SELECT COUNT(DISTINCT user_id) FROM audit_log WHERE timestamp >= :since",
            new MapSqlParameterSource().addValue("since", oneHourAgo),
            Integer.class
        );

        return SystemHealthDTO.builder()
            .overallStatus(overallStatus)
            .checkedAt(now)
            .database(dbHealth)
            .application(appHealth)
            .memory(memoryInfo)
            .errorCountLastHour(errorCountLastHour)
            .errorCountLast24Hours(errorCountLast24Hours)
            .activeSessions(activeSessions != null ? activeSessions : 0)
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

        // Top orgs by cases
        List<PlatformAnalyticsDTO.OrgMetric> topOrgsByCases = getTopOrganizations(
            "SELECT o.id, o.name, COUNT(c.id) as value FROM organizations o LEFT JOIN legal_cases c ON c.organization_id = o.id GROUP BY o.id, o.name ORDER BY value DESC LIMIT 5"
        );

        // Cases by status
        Map<String, Long> casesByStatus = new HashMap<>();
        for (CaseStatus status : CaseStatus.values()) {
            long count = legalCaseRepository.findByStatus(status).size();
            casesByStatus.put(status.name(), count);
        }

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
            .topOrgsByCases(topOrgsByCases)
            .casesByStatus(casesByStatus)
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

        // Create admin user for the organization
        String tempPassword = UUID.randomUUID().toString().substring(0, 8);
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

        // Get the created user's ID
        Long userId = jdbc.queryForObject(
            "SELECT id FROM users WHERE email = :email",
            new MapSqlParameterSource().addValue("email", dto.getAdminEmail()),
            Long.class
        );

        // Assign ADMIN role to the user
        if (userId != null) {
            jdbc.update(
                "INSERT INTO user_roles (user_id, role_id) SELECT :userId, id FROM roles WHERE name = 'ROLE_ADMIN'",
                new MapSqlParameterSource().addValue("userId", userId)
            );
        }

        // Send welcome email with invitation to set password
        try {
            String inviteUrl = "https://app.bostoneo.com/login?email=" + dto.getAdminEmail() + "&temp=" + tempPassword;
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
            String resetUrl = "https://app.bostoneo.com/reset-password?token=" + resetToken;
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
        String verificationUrl = "https://app.bostoneo.com/verify?token=" + UUID.randomUUID().toString();

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
            "SELECT a.*, u.email as user_email, u.first_name, u.last_name, o.name as org_name " +
            "FROM audit_log a " +
            "LEFT JOIN users u ON a.user_id = u.id " +
            "LEFT JOIN organizations o ON a.organization_id = o.id " +
            "WHERE 1=1 "
        );

        StringBuilder countSql = new StringBuilder(
            "SELECT COUNT(*) FROM audit_log a WHERE 1=1 "
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

        List<AuditLogEntryDTO> logs = jdbc.query(sql.toString(), params, (rs, rowNum) ->
            AuditLogEntryDTO.builder()
                .id(rs.getLong("id"))
                .action(rs.getString("action"))
                .entityType(rs.getString("entity_type"))
                .entityId(rs.getLong("entity_id"))
                .description(rs.getString("description"))
                .userId(rs.getLong("user_id"))
                .userEmail(rs.getString("user_email"))
                .userName(rs.getString("first_name") + " " + rs.getString("last_name"))
                .organizationId(rs.getLong("organization_id"))
                .organizationName(rs.getString("org_name"))
                .createdAt(rs.getTimestamp("timestamp") != null ?
                    rs.getTimestamp("timestamp").toLocalDateTime() : null)
                .build()
        );

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

        // Send notification to each user
        for (Long userId : targetUserIds) {
            try {
                Map<String, Object> notificationData = new HashMap<>();
                notificationData.put("type", announcement.getType());
                notificationData.put("announcementId", UUID.randomUUID().toString());

                notificationService.sendCrmNotification(
                    announcement.getTitle(),
                    announcement.getMessage(),
                    userId,
                    "PLATFORM_ANNOUNCEMENT",
                    notificationData
                );
            } catch (Exception e) {
                log.error("Failed to send announcement to user {}: {}", userId, e.getMessage());
            }
        }

        log.info("SUPERADMIN: Announcement sent to {} users", targetUserIds.size());
    }
}
