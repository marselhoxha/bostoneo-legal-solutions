package com.bostoneo.bostoneosolutions.resource;

import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.service.InvoiceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.*;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
@Slf4j
public class DashboardResource {

    private final InvoiceService invoiceService;
    private final TenantService tenantService;
    private final JdbcTemplate jdbcTemplate;

    private Long getRequiredOrganizationId() {
        return tenantService.getCurrentOrganizationId()
                .orElseThrow(() -> new RuntimeException("Organization context required"));
    }

    // All role-specific endpoints return the same org-wide metrics.
    // The frontend selects the endpoint based on hierarchyLevel,
    // but for now the data is identical — ready for future differentiation.

    @GetMapping("/full")
    public Map<String, Object> getFullMetrics() {
        return buildMetrics();
    }

    @GetMapping("/financial")
    public Map<String, Object> getFinancialMetrics() {
        return buildMetrics();
    }

    @GetMapping("/department")
    public Map<String, Object> getDepartmentMetrics() {
        return buildMetrics();
    }

    @GetMapping("/personal")
    public Map<String, Object> getPersonalMetrics() {
        return buildMetrics();
    }

    @GetMapping("/support")
    public Map<String, Object> getSupportMetrics() {
        return buildMetrics();
    }

    @GetMapping("/client")
    public Map<String, Object> getClientMetrics() {
        return buildMetrics();
    }

    private Map<String, Object> buildMetrics() {
        Long orgId = getRequiredOrganizationId();
        log.debug("Building dashboard metrics for org: {}", orgId);

        Map<String, Object> metrics = new LinkedHashMap<>();
        metrics.put("revenue", buildRevenueMetrics(orgId));
        metrics.put("clients", buildClientMetrics(orgId));
        metrics.put("cases", buildCaseMetrics(orgId));
        metrics.put("staff", buildStaffMetrics(orgId));
        metrics.put("financial", buildFinancialMetrics(orgId));
        return metrics;
    }

    // ==================== Revenue ====================

    private Map<String, Object> buildRevenueMetrics(Long orgId) {
        Map<String, Object> revenue = new LinkedHashMap<>();

        double totalRevenue = invoiceService.calculateTotalEarnings();
        revenue.put("totalRevenue", totalRevenue);
        revenue.put("monthlyRevenue", getMonthlyRevenue(orgId));
        revenue.put("quarterlyRevenue", getQuarterlyRevenue(orgId));
        revenue.put("yearlyRevenue", totalRevenue);
        revenue.put("revenueGrowth", 0);
        revenue.put("revenueByPracticeArea", getRevenueByPracticeArea(orgId));

        return revenue;
    }

    private double getMonthlyRevenue(Long orgId) {
        try {
            String sql = "SELECT COALESCE(SUM(total_amount), 0) FROM invoices " +
                    "WHERE status = 'PAID' AND organization_id = ? " +
                    "AND EXTRACT(MONTH FROM issue_date) = EXTRACT(MONTH FROM CURRENT_DATE) " +
                    "AND EXTRACT(YEAR FROM issue_date) = EXTRACT(YEAR FROM CURRENT_DATE)";
            Double result = jdbcTemplate.queryForObject(sql, Double.class, orgId);
            return result != null ? result : 0;
        } catch (Exception e) {
            log.warn("Error calculating monthly revenue for org {}", orgId, e);
            return 0;
        }
    }

    private double getQuarterlyRevenue(Long orgId) {
        try {
            String sql = "SELECT COALESCE(SUM(total_amount), 0) FROM invoices " +
                    "WHERE status = 'PAID' AND organization_id = ? " +
                    "AND EXTRACT(QUARTER FROM issue_date) = EXTRACT(QUARTER FROM CURRENT_DATE) " +
                    "AND EXTRACT(YEAR FROM issue_date) = EXTRACT(YEAR FROM CURRENT_DATE)";
            Double result = jdbcTemplate.queryForObject(sql, Double.class, orgId);
            return result != null ? result : 0;
        } catch (Exception e) {
            log.warn("Error calculating quarterly revenue for org {}", orgId, e);
            return 0;
        }
    }

    private Map<String, Double> getRevenueByPracticeArea(Long orgId) {
        Map<String, Double> revenueByArea = new LinkedHashMap<>();
        try {
            String sql = "SELECT COALESCE(lc.practice_area, lc.type) as practice_area, COALESCE(SUM(i.total_amount), 0) as revenue " +
                    "FROM invoices i " +
                    "JOIN legal_cases lc ON i.legal_case_id = lc.id AND lc.organization_id = ? " +
                    "WHERE i.status = 'PAID' AND i.organization_id = ? " +
                    "GROUP BY COALESCE(lc.practice_area, lc.type) " +
                    "ORDER BY revenue DESC";
            List<Map<String, Object>> results = jdbcTemplate.queryForList(sql, orgId, orgId);
            for (Map<String, Object> row : results) {
                String type = (String) row.get("practice_area");
                if (type != null) {
                    String displayName = formatCaseType(type);
                    double rev = ((Number) row.get("revenue")).doubleValue();
                    revenueByArea.merge(displayName, rev, Double::sum);
                }
            }
        } catch (Exception e) {
            log.warn("Error calculating revenue by practice area for org {}", orgId, e);
        }
        return revenueByArea;
    }

    private String formatCaseType(String type) {
        if (type == null || type.isEmpty()) return "Other";
        return switch (type.toUpperCase()) {
            case "PERSONAL_INJURY" -> "Personal Injury";
            case "FAMILY" -> "Family";
            case "CRIMINAL" -> "Criminal Defense";
            case "BUSINESS" -> "Business";
            case "CONTRACT" -> "Contract";
            case "REAL_ESTATE" -> "Real Estate";
            case "ESTATE_PLANNING" -> "Estate Planning";
            case "IMMIGRATION" -> "Immigration";
            case "BANKRUPTCY" -> "Bankruptcy";
            case "EMPLOYMENT_LITIGATION" -> "Employment";
            case "INTELLECTUAL_PROPERTY" -> "Intellectual Property";
            case "CLASS_ACTION" -> "Class Action";
            case "ENVIRONMENTAL" -> "Environmental";
            case "TAX" -> "Tax";
            default -> type.substring(0, 1).toUpperCase() +
                    type.substring(1).toLowerCase().replace('_', ' ');
        };
    }

    // ==================== Clients ====================

    private Map<String, Object> buildClientMetrics(Long orgId) {
        Map<String, Object> clients = new LinkedHashMap<>();
        try {
            int totalClients = getClientCount(orgId);
            clients.put("totalClients", totalClients);
            clients.put("activeClients", totalClients);
            clients.put("newClientsThisMonth", getNewClientsThisMonth(orgId));
            clients.put("clientRetentionRate", 0);
            clients.put("clientSatisfactionScore", 0);
        } catch (Exception e) {
            log.warn("Error building client metrics for org {}", orgId, e);
            clients.put("totalClients", 0);
            clients.put("activeClients", 0);
            clients.put("newClientsThisMonth", 0);
            clients.put("clientRetentionRate", 0);
            clients.put("clientSatisfactionScore", 0);
        }
        return clients;
    }

    private int getClientCount(Long orgId) {
        try {
            String sql = "SELECT COUNT(*) FROM clients WHERE organization_id = ?";
            Integer count = jdbcTemplate.queryForObject(sql, Integer.class, orgId);
            return count != null ? count : 0;
        } catch (Exception e) {
            log.warn("Error counting clients for org {}", orgId, e);
            return 0;
        }
    }

    private int getNewClientsThisMonth(Long orgId) {
        try {
            String sql = "SELECT COUNT(*) FROM clients " +
                    "WHERE organization_id = ? " +
                    "AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE) " +
                    "AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE)";
            Integer count = jdbcTemplate.queryForObject(sql, Integer.class, orgId);
            return count != null ? count : 0;
        } catch (Exception e) {
            log.warn("Error counting new clients this month for org {}", orgId, e);
            return 0;
        }
    }

    // ==================== Cases ====================

    private Map<String, Object> buildCaseMetrics(Long orgId) {
        Map<String, Object> cases = new LinkedHashMap<>();
        try {
            String sql = "SELECT status, COUNT(*) as cnt FROM legal_cases " +
                    "WHERE organization_id = ? GROUP BY status";
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, orgId);

            Map<String, Long> statusCounts = new HashMap<>();
            long totalCases = 0;
            for (Map<String, Object> row : rows) {
                String status = (String) row.get("status");
                long count = ((Number) row.get("cnt")).longValue();
                if (status != null) {
                    statusCounts.put(status, count);
                }
                totalCases += count;
            }

            long activeCases = statusCounts.getOrDefault("OPEN", 0L)
                    + statusCounts.getOrDefault("IN_PROGRESS", 0L)
                    + statusCounts.getOrDefault("ACTIVE", 0L);
            long closedCases = statusCounts.getOrDefault("CLOSED", 0L);
            double successRate = totalCases > 0 ? ((double) closedCases / totalCases) * 100 : 0;

            cases.put("totalCases", totalCases);
            cases.put("activeCases", activeCases);
            cases.put("closedCases", closedCases);
            cases.put("successRate", Math.round(successRate * 10.0) / 10.0);
            cases.put("upcomingDeadlines", getUpcomingDeadlines(orgId));

            // Build display-friendly status map
            Map<String, Long> displayStatusCounts = new LinkedHashMap<>();
            displayStatusCounts.put("Open", statusCounts.getOrDefault("OPEN", 0L));
            displayStatusCounts.put("In Progress", statusCounts.getOrDefault("IN_PROGRESS", 0L));
            displayStatusCounts.put("Active", statusCounts.getOrDefault("ACTIVE", 0L));
            displayStatusCounts.put("Pending", statusCounts.getOrDefault("PENDING", 0L));
            displayStatusCounts.put("Closed", statusCounts.getOrDefault("CLOSED", 0L));
            displayStatusCounts.put("On Hold", statusCounts.getOrDefault("ARCHIVED", 0L));
            displayStatusCounts.entrySet().removeIf(entry -> entry.getValue() == 0);
            cases.put("casesByStatus", displayStatusCounts);

        } catch (Exception e) {
            log.warn("Error building case metrics for org {}", orgId, e);
            cases.put("totalCases", 0);
            cases.put("activeCases", 0);
            cases.put("closedCases", 0);
            cases.put("successRate", 0);
            cases.put("upcomingDeadlines", 0);
            cases.put("casesByStatus", Collections.emptyMap());
        }
        return cases;
    }

    private int getUpcomingDeadlines(Long orgId) {
        try {
            String sql = "SELECT COUNT(*) FROM legal_cases " +
                    "WHERE organization_id = ? " +
                    "AND status NOT IN ('CLOSED', 'ARCHIVED') " +
                    "AND (next_hearing >= CURRENT_DATE OR trial_date >= CURRENT_DATE)";
            Integer count = jdbcTemplate.queryForObject(sql, Integer.class, orgId);
            return count != null ? count : 0;
        } catch (Exception e) {
            log.warn("Error counting upcoming deadlines for org {}", orgId, e);
            return 0;
        }
    }

    // ==================== Staff ====================

    private Map<String, Object> buildStaffMetrics(Long orgId) {
        Map<String, Object> staff = new LinkedHashMap<>();
        try {
            staff.put("totalStaff", getStaffCount(orgId));
            staff.put("attorneys", 0);
            staff.put("paralegals", 0);
            staff.put("supportStaff", 0);
            staff.put("utilizationRate", getUtilizationRate(orgId));
            staff.put("billableHours", getBillableHours(orgId));
        } catch (Exception e) {
            log.warn("Error building staff metrics for org {}", orgId, e);
            staff.put("totalStaff", 0);
            staff.put("attorneys", 0);
            staff.put("paralegals", 0);
            staff.put("supportStaff", 0);
            staff.put("utilizationRate", 0);
            staff.put("billableHours", 0);
        }
        return staff;
    }

    private int getStaffCount(Long orgId) {
        try {
            String sql = "SELECT COUNT(*) FROM users WHERE organization_id = ?";
            Integer count = jdbcTemplate.queryForObject(sql, Integer.class, orgId);
            return count != null ? count : 0;
        } catch (Exception e) {
            log.warn("Error counting staff for org {}", orgId, e);
            return 0;
        }
    }

    private double getBillableHours(Long orgId) {
        try {
            String sql = "SELECT COALESCE(SUM(hours), 0) FROM time_entries " +
                    "WHERE organization_id = ? AND billable = true";
            Double result = jdbcTemplate.queryForObject(sql, Double.class, orgId);
            return result != null ? result : 0;
        } catch (Exception e) {
            log.warn("Error calculating billable hours for org {}", orgId, e);
            return 0;
        }
    }

    private double getUtilizationRate(Long orgId) {
        try {
            String sql = "SELECT " +
                    "CASE WHEN COALESCE(SUM(hours), 0) = 0 THEN 0 " +
                    "ELSE ROUND((SUM(CASE WHEN billable = true THEN hours ELSE 0 END) / SUM(hours)) * 100, 1) " +
                    "END " +
                    "FROM time_entries WHERE organization_id = ?";
            Double result = jdbcTemplate.queryForObject(sql, Double.class, orgId);
            return result != null ? result : 0;
        } catch (Exception e) {
            log.warn("Error calculating utilization rate for org {}", orgId, e);
            return 0;
        }
    }

    // ==================== Financial ====================

    private Map<String, Object> buildFinancialMetrics(Long orgId) {
        Map<String, Object> financial = new LinkedHashMap<>();
        try {
            // Calculate financials excluding DRAFT invoices (not yet sent to clients)
            String sql = "SELECT " +
                    "COALESCE(SUM(CASE WHEN status != 'DRAFT' THEN total_amount ELSE 0 END), 0) AS total_billed, " +
                    "COALESCE(SUM(CASE WHEN status = 'PAID' THEN total_amount ELSE 0 END), 0) AS total_collected, " +
                    "COALESCE(SUM(CASE WHEN status NOT IN ('PAID', 'DRAFT', 'CANCELLED') THEN total_amount ELSE 0 END), 0) AS total_outstanding " +
                    "FROM invoices WHERE organization_id = ?";
            Map<String, Object> row = jdbcTemplate.queryForMap(sql, orgId);
            double totalBilled = ((Number) row.get("total_billed")).doubleValue();
            double totalCollected = ((Number) row.get("total_collected")).doubleValue();
            double totalOutstanding = ((Number) row.get("total_outstanding")).doubleValue();
            double collectionRate = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;

            financial.put("totalBilled", Math.round(totalBilled * 100.0) / 100.0);
            financial.put("totalCollected", Math.round(totalCollected * 100.0) / 100.0);
            financial.put("cashFlow", 0);
            financial.put("accountsReceivable", Math.round(totalOutstanding * 100.0) / 100.0);
            financial.put("accountsPayable", 0);
            financial.put("workInProgress", 0);
            financial.put("operatingExpenses", 0);
            financial.put("grossMargin", Math.round(collectionRate * 10.0) / 10.0);
            financial.put("netMargin", 0);
            financial.put("ebitda", 0);
            financial.put("collectionRate", Math.round(collectionRate * 10.0) / 10.0);
            financial.put("averageCollectionDays", 0);
            financial.put("overdueInvoices", invoiceService.countOverdueInvoices());
        } catch (Exception e) {
            log.warn("Error building financial metrics for org {}", orgId, e);
            financial.put("totalBilled", 0);
            financial.put("totalCollected", 0);
            financial.put("cashFlow", 0);
            financial.put("accountsReceivable", 0);
            financial.put("accountsPayable", 0);
            financial.put("workInProgress", 0);
            financial.put("operatingExpenses", 0);
            financial.put("grossMargin", 0);
            financial.put("netMargin", 0);
            financial.put("ebitda", 0);
            financial.put("collectionRate", 0);
            financial.put("averageCollectionDays", 0);
            financial.put("overdueInvoices", 0);
        }
        return financial;
    }

    // ==================== Attorney Performance ====================

    @GetMapping("/attorney-performance")
    public List<Map<String, Object>> getAttorneyPerformance() {
        Long orgId = getRequiredOrganizationId();
        log.debug("Loading attorney performance for org: {}", orgId);

        try {
            String sql = """
                SELECT
                  u.id, u.first_name, u.last_name, u.image_url,
                  best_role.role_name,
                  COUNT(DISTINCT ca.case_id) AS active_cases,
                  COALESCE(te.billable_hours, 0) AS billable_hours,
                  COALESCE(te.total_hours, 0) AS total_hours,
                  COALESCE(te.revenue, 0) AS revenue
                FROM users u
                INNER JOIN (
                  SELECT DISTINCT ON (ur2.user_id) ur2.user_id, r2.name AS role_name
                  FROM user_roles ur2
                  INNER JOIN roles r2 ON ur2.role_id = r2.id
                  WHERE r2.name IN ('ROLE_ATTORNEY', 'SENIOR_ASSOCIATE', 'ASSOCIATE',
                    'OF_COUNSEL', 'EQUITY_PARTNER', 'SENIOR_PARTNER', 'MANAGING_PARTNER')
                  ORDER BY ur2.user_id,
                    CASE r2.name
                      WHEN 'MANAGING_PARTNER' THEN 1 WHEN 'SENIOR_PARTNER' THEN 2
                      WHEN 'EQUITY_PARTNER' THEN 3 WHEN 'OF_COUNSEL' THEN 4
                      WHEN 'SENIOR_ASSOCIATE' THEN 5 WHEN 'ASSOCIATE' THEN 6
                      ELSE 7
                    END
                ) best_role ON best_role.user_id = u.id
                LEFT JOIN case_assignments ca ON ca.user_id = u.id
                  AND ca.organization_id = ?
                  AND ca.is_active = true
                  AND (ca.effective_to IS NULL OR ca.effective_to >= CURRENT_DATE)
                LEFT JOIN (
                  SELECT user_id,
                    SUM(CASE WHEN billable = true THEN hours ELSE 0 END) AS billable_hours,
                    SUM(hours) AS total_hours,
                    SUM(hours * rate) AS revenue
                  FROM time_entries
                  WHERE organization_id = ?
                  GROUP BY user_id
                ) te ON te.user_id = u.id
                WHERE u.enabled = true AND u.non_locked = true
                AND u.organization_id = ?
                GROUP BY u.id, u.first_name, u.last_name, u.image_url, best_role.role_name,
                  te.billable_hours, te.total_hours, te.revenue
                ORDER BY COALESCE(te.revenue, 0) DESC
                LIMIT 6
                """;

            List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, orgId, orgId, orgId);
            List<Map<String, Object>> result = new ArrayList<>();

            for (Map<String, Object> row : rows) {
                Map<String, Object> attorney = new LinkedHashMap<>();
                attorney.put("id", row.get("id"));
                attorney.put("firstName", row.get("first_name"));
                attorney.put("lastName", row.get("last_name"));
                attorney.put("imageUrl", row.get("image_url"));
                attorney.put("roleName", row.get("role_name"));
                attorney.put("activeCases", ((Number) row.get("active_cases")).intValue());

                double billableHours = ((Number) row.get("billable_hours")).doubleValue();
                double totalHours = ((Number) row.get("total_hours")).doubleValue();
                double revenue = ((Number) row.get("revenue")).doubleValue();
                double utilization = totalHours > 0 ? (billableHours / totalHours) * 100 : 0;

                attorney.put("billableHours", Math.round(billableHours * 10.0) / 10.0);
                attorney.put("utilization", Math.round(utilization * 10.0) / 10.0);
                attorney.put("revenue", Math.round(revenue * 100.0) / 100.0);
                result.add(attorney);
            }

            return result;
        } catch (Exception e) {
            log.warn("Error loading attorney performance for org {}", orgId, e);
            return Collections.emptyList();
        }
    }
}
