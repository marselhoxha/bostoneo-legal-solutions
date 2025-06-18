package com.***REMOVED***.***REMOVED***solutions.resource;

import com.***REMOVED***.***REMOVED***solutions.service.InvoiceService;
import com.***REMOVED***.***REMOVED***solutions.service.LegalCaseService;
import com.***REMOVED***.***REMOVED***solutions.service.ClientService;
import com.***REMOVED***.***REMOVED***solutions.service.UserService;
import com.***REMOVED***.***REMOVED***solutions.repository.InvoiceRepository;
import com.***REMOVED***.***REMOVED***solutions.repository.LegalCaseRepository;
import com.***REMOVED***.***REMOVED***solutions.repository.ClientRepository;
import com.***REMOVED***.***REMOVED***solutions.dto.InvoiceAnalyticsDTO;
import com.***REMOVED***.***REMOVED***solutions.dto.LegalCaseDTO;
import com.***REMOVED***.***REMOVED***solutions.enumeration.CaseStatus;
import com.***REMOVED***.***REMOVED***solutions.model.Client;
import com.***REMOVED***.***REMOVED***solutions.model.User;
import com.***REMOVED***.***REMOVED***solutions.model.Invoice;
import com.***REMOVED***.***REMOVED***solutions.model.LegalCase;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/analytics")
@RequiredArgsConstructor
public class AnalyticsResource {

    private final InvoiceService invoiceService;
    private final LegalCaseService legalCaseService;
    private final ClientService clientService;
    private final UserService userService;
    
    // Direct repository access for analytics queries
    private final InvoiceRepository invoiceRepository;
    private final LegalCaseRepository legalCaseRepository;
    private final ClientRepository clientRepository;
    
    @Autowired
    private JdbcTemplate jdbcTemplate;

    @GetMapping("/total-earnings")
    public double getTotalEarnings() {
        return invoiceService.calculateTotalEarnings();
    }

    @GetMapping("/paid-vs-unpaid")
    public InvoiceAnalyticsDTO getPaidVsUnpaid() {
        return invoiceService.countPaidVsUnpaidInvoices();
    }

    @GetMapping("/overdue")
    public long getOverdueInvoices() {
        return invoiceService.countOverdueInvoices();
    }

    @GetMapping("/cases")
    public Map<String, Object> getCaseAnalytics() {
        Map<String, Object> analytics = new HashMap<>();
        
        // Get all cases (using a large page size to get all)
        Page<LegalCaseDTO> allCasesPage = legalCaseService.getAllCases(0, 1000);
        List<LegalCaseDTO> allCases = allCasesPage.getContent();
        
        analytics.put("totalCases", allCases.size());
        
        // Count by status
        Map<String, Long> statusCounts = allCases.stream()
            .collect(Collectors.groupingBy(
                case_ -> case_.getStatus() != null ? case_.getStatus().toString() : "UNKNOWN",
                Collectors.counting()
            ));
        
        analytics.put("activeCases", statusCounts.getOrDefault("OPEN", 0L) + statusCounts.getOrDefault("IN_PROGRESS", 0L));
        analytics.put("closedCases", statusCounts.getOrDefault("CLOSED", 0L));
        analytics.put("pendingCases", statusCounts.getOrDefault("PENDING", 0L));
        analytics.put("casesByStatus", statusCounts);
        
        // Count by type
        Map<String, Long> typeCounts = allCases.stream()
            .collect(Collectors.groupingBy(
                case_ -> case_.getType() != null ? case_.getType() : "UNKNOWN",
                Collectors.counting()
            ));
        analytics.put("casesByType", typeCounts);
        
        // Revenue by type
        Map<String, Double> revenueByType = allCases.stream()
            .filter(case_ -> case_.getTotalAmount() != null)
            .collect(Collectors.groupingBy(
                case_ -> case_.getType() != null ? case_.getType() : "UNKNOWN",
                Collectors.summingDouble(LegalCaseDTO::getTotalAmount)
            ));
        analytics.put("revenueByType", revenueByType);
        
        return analytics;
    }

    @GetMapping("/geographic")
    public List<Map<String, Object>> getGeographicDistribution() {
        List<Map<String, Object>> geographic = new ArrayList<>();
        
        // Get actual clients and revenue data
        Page<Client> clientsPage = clientService.getClients(0, 1000);
        List<Client> allClients = clientsPage.getContent();
        double totalRevenue = invoiceService.calculateTotalEarnings();
        int totalClients = (int) clientsPage.getTotalElements();
        
        System.out.println("Geographic analysis - Clients: " + totalClients + ", Revenue: " + totalRevenue);
        
        // Try to get actual geographic data from client records
        Map<String, Integer> clientsByRegion = getActualClientLocationData(allClients);
        
        if (!clientsByRegion.isEmpty() && totalRevenue > 0) {
            // Use actual client location data
            for (Map.Entry<String, Integer> entry : clientsByRegion.entrySet()) {
                String region = entry.getKey();
                int clientCount = entry.getValue();
                double percentage = (double) clientCount / totalClients * 100;
                double regionRevenue = totalRevenue * (percentage / 100);
                
                geographic.add(createGeographicEntry(region, (int)Math.round(percentage), clientCount, regionRevenue));
            }
        } else {
            // If no location data available, return empty result
            System.out.println("No geographic location data available in client records");
        }
        
        return geographic;
    }

    private Map<String, Integer> getActualClientLocationData(List<Client> clients) {
        Map<String, Integer> locationCounts = new HashMap<>();
        
        try {
            // Query actual client location data from database
            String sql = "SELECT " +
                        "CASE " +
                        "  WHEN LOWER(address) LIKE '%boston%' OR LOWER(city) LIKE '%boston%' THEN 'Boston Area' " +
                        "  WHEN LOWER(address) LIKE '%massachusetts%' OR LOWER(address) LIKE '%ma%' OR LOWER(state) LIKE '%ma%' THEN 'Massachusetts' " +
                        "  WHEN LOWER(address) LIKE '%new england%' OR LOWER(state) IN ('nh', 'vt', 'me', 'ri', 'ct') THEN 'New England' " +
                        "  WHEN state IS NOT NULL AND state != '' THEN 'Other States' " +
                        "  ELSE 'Unknown' " +
                        "END as region, " +
                        "COUNT(*) as client_count " +
                        "FROM client " +
                        "WHERE address IS NOT NULL OR city IS NOT NULL OR state IS NOT NULL " +
                        "GROUP BY region " +
                        "HAVING region != 'Unknown' " +
                        "ORDER BY client_count DESC";
            
            List<Map<String, Object>> results = jdbcTemplate.queryForList(sql);
            
            for (Map<String, Object> row : results) {
                String region = (String) row.get("region");
                Integer count = ((Number) row.get("client_count")).intValue();
                locationCounts.put(region, count);
            }
            
            System.out.println("Actual client location data: " + locationCounts);
            
        } catch (Exception e) {
            System.err.println("Error querying client location data: " + e.getMessage());
            e.printStackTrace();
        }
        
        return locationCounts;
    }

    @GetMapping("/monthly-trends")
    public List<Map<String, Object>> getMonthlyTrends() {
        List<Map<String, Object>> trends = new ArrayList<>();
        
        // Get real monthly data from database using direct SQL queries
        Map<String, Double> monthlyRevenue = getMonthlyRevenueFromDB();
        Map<String, Integer> monthlyCases = getMonthlyCasesFromDB();
        Map<String, Integer> monthlyUsers = getMonthlyUsersFromDB();
        
        System.out.println("Real monthly revenue data: " + monthlyRevenue);
        System.out.println("Real monthly cases data: " + monthlyCases);
        System.out.println("Real monthly users data: " + monthlyUsers);
        
        // Get all unique months from all data sources
        Set<String> allMonths = new HashSet<>();
        allMonths.addAll(monthlyRevenue.keySet());
        allMonths.addAll(monthlyCases.keySet());
        allMonths.addAll(monthlyUsers.keySet());
        
        // Sort months chronologically
        List<String> sortedMonths = allMonths.stream()
            .sorted()
            .collect(Collectors.toList());
        
        for (String monthKey : sortedMonths) {
            Map<String, Object> monthData = new HashMap<>();
            
            // Convert YYYY-MM to MMM format
            String displayMonth = convertMonthKeyToDisplay(monthKey);
            monthData.put("month", displayMonth);
            
            // Use actual data from database
            double revenue = monthlyRevenue.getOrDefault(monthKey, 0.0);
            int cases = monthlyCases.getOrDefault(monthKey, 0);
            int users = monthlyUsers.getOrDefault(monthKey, 0);
            
            monthData.put("revenue", revenue);
            monthData.put("cases", cases);
            monthData.put("users", users);
            trends.add(monthData);
        }
        
        return trends;
    }

    private String convertMonthKeyToDisplay(String monthKey) {
        try {
            String[] parts = monthKey.split("-");
            int year = Integer.parseInt(parts[0]);
            int month = Integer.parseInt(parts[1]);
            
            String[] monthNames = {"Jan", "Feb", "Mar", "Apr", "May", "Jun", 
                                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"};
            
            return monthNames[month - 1];
        } catch (Exception e) {
            return monthKey; // Fallback to original key
        }
    }

    // Real database query methods using JdbcTemplate
    private Map<String, Double> getMonthlyRevenueFromDB() {
        Map<String, Double> monthlyRevenue = new HashMap<>();
        
        try {
            String sql = "SELECT DATE_FORMAT(date, '%Y-%m') as month, SUM(total) as revenue " +
                        "FROM invoice " +
                        "WHERE date IS NOT NULL " +
                        "GROUP BY DATE_FORMAT(date, '%Y-%m') " +
                        "ORDER BY month";
            
            List<Map<String, Object>> results = jdbcTemplate.queryForList(sql);
            
            for (Map<String, Object> row : results) {
                String month = (String) row.get("month");
                Double revenue = ((Number) row.get("revenue")).doubleValue();
                monthlyRevenue.put(month, revenue);
            }
            
            System.out.println("Retrieved monthly revenue from DB: " + monthlyRevenue);
            
        } catch (Exception e) {
            System.err.println("Error querying monthly revenue: " + e.getMessage());
            e.printStackTrace();
        }
        
        return monthlyRevenue;
    }

    private Map<String, Integer> getMonthlyCasesFromDB() {
        Map<String, Integer> monthlyCases = new HashMap<>();
        
        try {
            String sql = "SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as cases " +
                        "FROM legal_cases " +
                        "WHERE created_at IS NOT NULL " +
                        "GROUP BY DATE_FORMAT(created_at, '%Y-%m') " +
                        "ORDER BY month";
            
            List<Map<String, Object>> results = jdbcTemplate.queryForList(sql);
            
            for (Map<String, Object> row : results) {
                String month = (String) row.get("month");
                Integer cases = ((Number) row.get("cases")).intValue();
                monthlyCases.put(month, cases);
            }
            
            System.out.println("Retrieved monthly cases from DB: " + monthlyCases);
            
        } catch (Exception e) {
            System.err.println("Error querying monthly cases: " + e.getMessage());
            e.printStackTrace();
        }
        
        return monthlyCases;
    }

    private Map<String, Integer> getMonthlyUsersFromDB() {
        Map<String, Integer> monthlyUsers = new HashMap<>();
        
        try {
            String sql = "SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as users " +
                        "FROM users " +
                        "WHERE created_at IS NOT NULL " +
                        "GROUP BY DATE_FORMAT(created_at, '%Y-%m') " +
                        "ORDER BY month";
            
            List<Map<String, Object>> results = jdbcTemplate.queryForList(sql);
            
            for (Map<String, Object> row : results) {
                String month = (String) row.get("month");
                Integer users = ((Number) row.get("users")).intValue();
                monthlyUsers.put(month, users);
            }
            
            System.out.println("Retrieved monthly users from DB: " + monthlyUsers);
            
        } catch (Exception e) {
            System.err.println("Error querying monthly users: " + e.getMessage());
            e.printStackTrace();
        }
        
        return monthlyUsers;
    }

    @GetMapping("/revenue-by-practice")
    public Map<String, Double> getRevenueByPracticeArea() {
        Map<String, Double> revenueData = new HashMap<>();
        
        Page<LegalCaseDTO> allCasesPage = legalCaseService.getAllCases(0, 1000);
        List<LegalCaseDTO> allCases = allCasesPage.getContent();
        
        // Calculate actual revenue by case type
        Map<String, Double> actualRevenue = allCases.stream()
            .filter(case_ -> case_.getTotalAmount() != null && case_.getType() != null)
            .collect(Collectors.groupingBy(
                LegalCaseDTO::getType,
                Collectors.summingDouble(LegalCaseDTO::getTotalAmount)
            ));
        
        System.out.println("Actual revenue by case type: " + actualRevenue);
        
        // Calculate total revenue from all cases
        double totalCaseRevenue = actualRevenue.values().stream().mapToDouble(Double::doubleValue).sum();
        
        if (totalCaseRevenue > 0) {
            // Use real data and map case types to practice areas
            revenueData.put("Personal Injury", 
                actualRevenue.getOrDefault("PERSONAL_INJURY", 0.0));
            
            revenueData.put("Corporate Law", 
                actualRevenue.getOrDefault("BUSINESS", 0.0) + 
                actualRevenue.getOrDefault("CONTRACT", 0.0) +
                actualRevenue.getOrDefault("EMPLOYMENT_LITIGATION", 0.0) +
                actualRevenue.getOrDefault("INTELLECTUAL_PROPERTY", 0.0));
            
            revenueData.put("Family Law", 
                actualRevenue.getOrDefault("FAMILY", 0.0));
            
            revenueData.put("Criminal Defense", 
                actualRevenue.getOrDefault("CRIMINAL", 0.0));
            
            revenueData.put("Real Estate", 
                actualRevenue.getOrDefault("REAL_ESTATE", 0.0) + 
                actualRevenue.getOrDefault("ESTATE_PLANNING", 0.0));
            
            revenueData.put("Immigration Law", 
                actualRevenue.getOrDefault("IMMIGRATION", 0.0));
            
            revenueData.put("Bankruptcy Law", 
                actualRevenue.getOrDefault("BANKRUPTCY", 0.0));
            
            revenueData.put("Other Practice Areas",
                actualRevenue.getOrDefault("CLASS_ACTION", 0.0) +
                actualRevenue.getOrDefault("ENVIRONMENTAL", 0.0) +
                actualRevenue.getOrDefault("TAX", 0.0));
            
            // Remove any zero-value entries for cleaner display
            revenueData.entrySet().removeIf(entry -> entry.getValue() <= 0);
            
            System.out.println("Mapped revenue by practice area: " + revenueData);
            
        } else {
            // If no case revenue data, use actual invoice totals with realistic distribution
            double totalInvoiceRevenue = invoiceService.calculateTotalEarnings();
            System.out.println("Using total invoice revenue for distribution: " + totalInvoiceRevenue);
            
            // Get case type counts from database for proportional distribution
            Map<String, Long> caseTypeCounts = allCases.stream()
                .filter(case_ -> case_.getType() != null)
                .collect(Collectors.groupingBy(
                    LegalCaseDTO::getType,
                    Collectors.counting()
                ));
            
            if (!caseTypeCounts.isEmpty() && totalInvoiceRevenue > 0) {
                double totalCases = caseTypeCounts.values().stream().mapToLong(Long::longValue).sum();
                
                // Distribute revenue proportionally based on actual case counts
                double personalInjuryRevenue = totalInvoiceRevenue * (caseTypeCounts.getOrDefault("PERSONAL_INJURY", 0L) / totalCases);
                if (personalInjuryRevenue > 0) {
                    revenueData.put("Personal Injury", personalInjuryRevenue);
                }
                
                double corporateRevenue = totalInvoiceRevenue * ((caseTypeCounts.getOrDefault("BUSINESS", 0L) + 
                                           caseTypeCounts.getOrDefault("CONTRACT", 0L) + 
                                           caseTypeCounts.getOrDefault("EMPLOYMENT_LITIGATION", 0L) + 
                                           caseTypeCounts.getOrDefault("INTELLECTUAL_PROPERTY", 0L)) / totalCases);
                if (corporateRevenue > 0) {
                    revenueData.put("Corporate Law", corporateRevenue);
                }
                
                double familyRevenue = totalInvoiceRevenue * (caseTypeCounts.getOrDefault("FAMILY", 0L) / totalCases);
                if (familyRevenue > 0) {
                    revenueData.put("Family Law", familyRevenue);
                }
                
                double criminalRevenue = totalInvoiceRevenue * (caseTypeCounts.getOrDefault("CRIMINAL", 0L) / totalCases);
                if (criminalRevenue > 0) {
                    revenueData.put("Criminal Defense", criminalRevenue);
                }
                
                double realEstateRevenue = totalInvoiceRevenue * ((caseTypeCounts.getOrDefault("REAL_ESTATE", 0L) + 
                                            caseTypeCounts.getOrDefault("ESTATE_PLANNING", 0L)) / totalCases);
                if (realEstateRevenue > 0) {
                    revenueData.put("Real Estate", realEstateRevenue);
                }
                
                double immigrationRevenue = totalInvoiceRevenue * (caseTypeCounts.getOrDefault("IMMIGRATION", 0L) / totalCases);
                if (immigrationRevenue > 0) {
                    revenueData.put("Immigration Law", immigrationRevenue);
                }
                
                double bankruptcyRevenue = totalInvoiceRevenue * (caseTypeCounts.getOrDefault("BANKRUPTCY", 0L) / totalCases);
                if (bankruptcyRevenue > 0) {
                    revenueData.put("Bankruptcy Law", bankruptcyRevenue);
                }
                
                double otherRevenue = totalInvoiceRevenue * ((caseTypeCounts.getOrDefault("CLASS_ACTION", 0L) + 
                                       caseTypeCounts.getOrDefault("ENVIRONMENTAL", 0L) + 
                                       caseTypeCounts.getOrDefault("TAX", 0L)) / totalCases);
                if (otherRevenue > 0) {
                    revenueData.put("Other Practice Areas", otherRevenue);
                }
            }
        }
        
        return revenueData;
    }

    @GetMapping("/kpis")
    public Map<String, Object> getPerformanceKPIs() {
        Map<String, Object> kpis = new HashMap<>();
        
        Page<LegalCaseDTO> allCasesPage = legalCaseService.getAllCases(0, 1000);
        List<LegalCaseDTO> allCases = allCasesPage.getContent();
        
        // Calculate case success rate (closed cases / total cases)
        long closedCases = allCases.stream()
            .filter(case_ -> "CLOSED".equals(case_.getStatus() != null ? case_.getStatus().toString() : ""))
            .count();
        double successRate = allCases.isEmpty() ? 0 : (double) closedCases / allCases.size() * 100;
        
        // Calculate client satisfaction based on case completion and payment status
        InvoiceAnalyticsDTO invoiceAnalytics = invoiceService.countPaidVsUnpaidInvoices();
        double totalInvoices = invoiceAnalytics.getPaidInvoices() + invoiceAnalytics.getUnpaidInvoices();
        double paymentRate = totalInvoices > 0 ? (double) invoiceAnalytics.getPaidInvoices() / totalInvoices * 100 : 0;
        
        // System efficiency based on case progression (in progress + closed vs total)
        long progressiveCases = allCases.stream()
            .filter(case_ -> "IN_PROGRESS".equals(case_.getStatus() != null ? case_.getStatus().toString() : "") ||
                           "CLOSED".equals(case_.getStatus() != null ? case_.getStatus().toString() : ""))
            .count();
        double systemEfficiency = allCases.isEmpty() ? 0 : (double) progressiveCases / allCases.size() * 100;
        
        // Calculate average resolution time using real data (simplified)
        double avgResolutionTime = calculateAverageResolutionTimeFromDB();
        
        kpis.put("caseSuccessRate", Math.round(successRate * 100.0) / 100.0);
        kpis.put("clientSatisfactionRate", Math.round(paymentRate * 100.0) / 100.0);
        kpis.put("systemEfficiency", Math.round(systemEfficiency * 100.0) / 100.0);
        kpis.put("averageResolutionTime", avgResolutionTime);
        
        System.out.println("Calculated KPIs from real data: " + kpis);
        
        return kpis;
    }

    private double calculateAverageResolutionTimeFromDB() {
        try {
            String sql = "SELECT AVG(DATEDIFF(updated_at, created_at)) as avg_days " +
                        "FROM legal_cases " +
                        "WHERE status = 'CLOSED' AND created_at IS NOT NULL AND updated_at IS NOT NULL";
            
            Double avgDays = jdbcTemplate.queryForObject(sql, Double.class);
            
            if (avgDays != null && avgDays > 0) {
                // Convert days to months
                double avgMonths = avgDays / 30.0;
                return Math.round(avgMonths * 10.0) / 10.0; // Round to 1 decimal place
            }
        } catch (Exception e) {
            System.err.println("Error calculating average resolution time: " + e.getMessage());
        }
        
        // If no closed cases or error, return 0
        return 0.0;
    }

    @GetMapping("/activity-heatmap")
    public List<Map<String, Object>> getActivityHeatMapData() {
        List<Map<String, Object>> heatmapData = new ArrayList<>();
        
        // Get actual activity data from database
        Map<String, Integer> actualActivity = getRealActivityDataFromDB();
        
        String[] days = {"Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"};
        
        for (int day = 0; day < 7; day++) {
            for (int hour = 0; hour < 24; hour++) {
                Map<String, Object> activity = new HashMap<>();
                activity.put("day", days[day]);
                activity.put("hour", hour);
                activity.put("dayOfWeek", day + 1);
                
                // Get actual activity value for this day/hour combination
                String activityKey = day + "-" + hour;
                int value = actualActivity.getOrDefault(activityKey, 0);
                
                activity.put("value", value);
                heatmapData.add(activity);
            }
        }
        
        return heatmapData;
    }

    private Map<String, Integer> getRealActivityDataFromDB() {
        Map<String, Integer> activityData = new HashMap<>();
        
        try {
            // Query case activity (created and updated)
            String caseActivitySql = "SELECT DAYOFWEEK(created_at) - 2 as day_of_week, " +
                                   "HOUR(created_at) as hour, " +
                                   "COUNT(*) as activity_count " +
                                   "FROM legal_cases " +
                                   "WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) " +
                                   "GROUP BY DAYOFWEEK(created_at), HOUR(created_at)";
            
            List<Map<String, Object>> caseResults = jdbcTemplate.queryForList(caseActivitySql);
            
            for (Map<String, Object> row : caseResults) {
                Integer dayOfWeek = ((Number) row.get("day_of_week")).intValue();
                Integer hour = ((Number) row.get("hour")).intValue();
                Integer count = ((Number) row.get("activity_count")).intValue();
                
                // Adjust day of week (MySQL DAYOFWEEK: 1=Sunday, we want 0=Monday)
                dayOfWeek = (dayOfWeek + 5) % 7; // Convert to 0=Monday, 6=Sunday
                
                String key = dayOfWeek + "-" + hour;
                activityData.put(key, activityData.getOrDefault(key, 0) + count);
            }
            
            // Query invoice activity
            String invoiceActivitySql = "SELECT DAYOFWEEK(date) - 2 as day_of_week, " +
                                      "HOUR(date) as hour, " +
                                      "COUNT(*) as activity_count " +
                                      "FROM invoice " +
                                      "WHERE date >= DATE_SUB(NOW(), INTERVAL 30 DAY) " +
                                      "GROUP BY DAYOFWEEK(date), HOUR(date)";
            
            List<Map<String, Object>> invoiceResults = jdbcTemplate.queryForList(invoiceActivitySql);
            
            for (Map<String, Object> row : invoiceResults) {
                Integer dayOfWeek = ((Number) row.get("day_of_week")).intValue();
                Integer hour = ((Number) row.get("hour")).intValue();
                Integer count = ((Number) row.get("activity_count")).intValue();
                
                // Adjust day of week
                dayOfWeek = (dayOfWeek + 5) % 7;
                
                String key = dayOfWeek + "-" + hour;
                activityData.put(key, activityData.getOrDefault(key, 0) + (count * 2)); // Weight invoices higher
            }
            
            // Query case updates (for ongoing activity)
            String updateActivitySql = "SELECT DAYOFWEEK(updated_at) - 2 as day_of_week, " +
                                     "HOUR(updated_at) as hour, " +
                                     "COUNT(*) as activity_count " +
                                     "FROM legal_cases " +
                                     "WHERE updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) " +
                                     "AND updated_at != created_at " +
                                     "GROUP BY DAYOFWEEK(updated_at), HOUR(updated_at)";
            
            List<Map<String, Object>> updateResults = jdbcTemplate.queryForList(updateActivitySql);
            
            for (Map<String, Object> row : updateResults) {
                Integer dayOfWeek = ((Number) row.get("day_of_week")).intValue();
                Integer hour = ((Number) row.get("hour")).intValue();
                Integer count = ((Number) row.get("activity_count")).intValue();
                
                // Adjust day of week
                dayOfWeek = (dayOfWeek + 5) % 7;
                
                String key = dayOfWeek + "-" + hour;
                activityData.put(key, activityData.getOrDefault(key, 0) + (count * 3)); // Weight updates highest
            }
            
            System.out.println("Real activity data points: " + activityData.size());
            
        } catch (Exception e) {
            System.err.println("Error querying real activity data: " + e.getMessage());
            e.printStackTrace();
        }
        
        return activityData;
    }

    @GetMapping("/case-funnel")
    public List<Map<String, Object>> getCaseProgressionFunnel() {
        List<Map<String, Object>> funnelData = new ArrayList<>();
        
        Page<LegalCaseDTO> allCasesPage = legalCaseService.getAllCases(0, 1000);
        List<LegalCaseDTO> allCases = allCasesPage.getContent();
        
        int totalCases = allCases.size();
        
        if (totalCases > 0) {
            // Calculate actual funnel stages based on real data
            
            // Stage 1: Initial Inquiries (assume total cases represent successful inquiries)
            long inquiries = totalCases;
            
            // Stage 2: Consultations (cases that progressed beyond initial inquiry)
            // Estimate that accepted cases had consultations
            long consultations = allCases.stream()
                .filter(case_ -> !"ARCHIVED".equals(case_.getStatus() != null ? case_.getStatus().toString() : ""))
                .count();
            
            // Stage 3: Cases Accepted (all non-archived cases)
            long casesAccepted = consultations;
            
            // Stage 4: In Progress (actively being worked on)
            long inProgress = allCases.stream()
                .filter(case_ -> "IN_PROGRESS".equals(case_.getStatus() != null ? case_.getStatus().toString() : "") ||
                               "OPEN".equals(case_.getStatus() != null ? case_.getStatus().toString() : ""))
                .count();
            
            // Stage 5: Successfully Resolved (closed cases)
            long casesWon = allCases.stream()
                .filter(case_ -> "CLOSED".equals(case_.getStatus() != null ? case_.getStatus().toString() : ""))
                .count();
            
            funnelData.add(createFunnelStage("Initial Inquiries", (int)inquiries, 100.0));
            funnelData.add(createFunnelStage("Consultations", (int)consultations, (double)consultations/inquiries * 100));
            funnelData.add(createFunnelStage("Cases Accepted", (int)casesAccepted, (double)casesAccepted/inquiries * 100));
            funnelData.add(createFunnelStage("In Progress", (int)inProgress, (double)inProgress/inquiries * 100));
            funnelData.add(createFunnelStage("Successfully Resolved", (int)casesWon, (double)casesWon/inquiries * 100));
        }
        
        System.out.println("Case funnel data based on real cases: " + funnelData);
        
        return funnelData;
    }

    // New Dashboard Metrics Endpoints
    @GetMapping("/dashboard-metrics")
    public Map<String, Object> getDashboardMetrics() {
        Map<String, Object> metrics = new HashMap<>();
        
        // Total clients
        Page<Client> clientsPage = clientService.getClients(0, 1000);
        metrics.put("totalClients", clientsPage.getTotalElements());
        
        // Total invoices (from analytics DTO)
        InvoiceAnalyticsDTO invoiceAnalytics = invoiceService.countPaidVsUnpaidInvoices();
        metrics.put("totalInvoices", invoiceAnalytics.getPaidInvoices() + invoiceAnalytics.getUnpaidInvoices());
        
        // Total billed amount
        metrics.put("totalBilled", invoiceService.calculateTotalEarnings());
        
        // Active cases
        Page<LegalCaseDTO> allCasesPage = legalCaseService.getAllCases(0, 1000);
        List<LegalCaseDTO> allCases = allCasesPage.getContent();
        long activeCases = allCases.stream()
            .filter(case_ -> "OPEN".equals(case_.getStatus() != null ? case_.getStatus().toString() : "") || 
                           "IN_PROGRESS".equals(case_.getStatus() != null ? case_.getStatus().toString() : ""))
            .count();
        metrics.put("activeCases", activeCases);
        
        // Total users (team members)
        Collection<User> users = userService.getUsers(0, 1000);
        metrics.put("teamMembers", users.size());
        
        // Current month revenue
        double currentMonthRevenue = calculateCurrentMonthRevenue();
        metrics.put("monthlyRevenue", Math.round(currentMonthRevenue / 1000)); // Convert to K
        
        // Case completion rate
        long closedCases = allCases.stream()
            .filter(case_ -> "CLOSED".equals(case_.getStatus() != null ? case_.getStatus().toString() : ""))
            .count();
        double completionRate = allCases.isEmpty() ? 0 : (double) closedCases / allCases.size() * 100;
        metrics.put("caseCompletionRate", Math.round(completionRate * 100.0) / 100.0);
        
        // Additional metrics for role-specific dashboards
        metrics.put("upcomingHearings", calculateUpcomingHearings(allCases));
        metrics.put("documentsToReview", calculateDocumentsToReview(allCases));
        metrics.put("pendingTasks", calculatePendingTasks(users));
        metrics.put("todayAppointments", calculateTodayAppointments(users));
        
        return metrics;
    }

    @GetMapping("/client-count")
    public long getClientCount() {
        try {
            Page<Client> clientsPage = clientService.getClients(0, 1);
            return clientsPage.getTotalElements();
        } catch (Exception e) {
            return 0;
        }
    }

    @GetMapping("/total-invoices")
    public long getTotalInvoices() {
        try {
            InvoiceAnalyticsDTO analytics = invoiceService.countPaidVsUnpaidInvoices();
            return analytics.getPaidInvoices() + analytics.getUnpaidInvoices();
        } catch (Exception e) {
            return 0;
        }
    }

    @GetMapping("/active-cases")
    public long getActiveCases() {
        try {
            Page<LegalCaseDTO> allCasesPage = legalCaseService.getAllCases(0, 1000);
            List<LegalCaseDTO> allCases = allCasesPage.getContent();
            
            return allCases.stream()
                .filter(case_ -> "OPEN".equals(case_.getStatus() != null ? case_.getStatus().toString() : "") || 
                               "IN_PROGRESS".equals(case_.getStatus() != null ? case_.getStatus().toString() : ""))
                .count();
        } catch (Exception e) {
            return 0;
        }
    }

    @GetMapping("/team-members")
    public long getTeamMembers() {
        try {
            Collection<User> users = userService.getUsers(0, 1000);
            return users.size();
        } catch (Exception e) {
            return 0;
        }
    }

    @GetMapping("/current-month-revenue")
    public double getCurrentMonthRevenue() {
        return calculateCurrentMonthRevenue();
    }

    // Helper methods for dashboard metrics
    private double calculateCurrentMonthRevenue() {
        try {
            String currentMonth = YearMonth.now().toString();
            String sql = "SELECT COALESCE(SUM(total), 0) as revenue " +
                        "FROM invoice " +
                        "WHERE DATE_FORMAT(date, '%Y-%m') = ? " +
                        "AND status = 'PAID'";
            
            Double revenue = jdbcTemplate.queryForObject(sql, Double.class, currentMonth);
            return revenue != null ? revenue : 0.0;
            
        } catch (Exception e) {
            System.err.println("Error calculating current month revenue: " + e.getMessage());
            return 0.0;
        }
    }

    private int calculateUpcomingHearings(List<LegalCaseDTO> cases) {
        // This would integrate with a calendar/event system
        // For now, return a calculated value based on active cases
        long activeCases = cases.stream()
            .filter(case_ -> "OPEN".equals(case_.getStatus() != null ? case_.getStatus().toString() : "") || 
                           "IN_PROGRESS".equals(case_.getStatus() != null ? case_.getStatus().toString() : ""))
            .count();
        
        // Estimate ~20% of active cases have upcoming hearings
        return Math.max(0, (int) Math.round(activeCases * 0.2));
    }

    private int calculateDocumentsToReview(List<LegalCaseDTO> cases) {
        // This would integrate with a document management system
        // For now, estimate based on active cases
        long activeCases = cases.stream()
            .filter(case_ -> "OPEN".equals(case_.getStatus() != null ? case_.getStatus().toString() : "") || 
                           "IN_PROGRESS".equals(case_.getStatus() != null ? case_.getStatus().toString() : ""))
            .count();
        
        // Estimate ~50% of active cases have documents to review
        return Math.max(0, (int) Math.round(activeCases * 0.5));
    }

    private int calculatePendingTasks(Collection<User> users) {
        // This would integrate with a task management system
        // For now, estimate based on team size
        int teamSize = users.size();
        
        // Estimate ~2 pending tasks per team member
        return Math.max(0, teamSize * 2);
    }

    private int calculateTodayAppointments(Collection<User> users) {
        // This would integrate with a calendar system
        // For now, estimate based on team size
        int teamSize = users.size();
        
        // Estimate ~40% of team has appointments today
        return Math.max(0, (int) Math.round(teamSize * 0.4));
    }

    private Map<String, Object> createGeographicEntry(String region, int percentage, double clientCount, double revenue) {
        Map<String, Object> entry = new HashMap<>();
        entry.put("region", region);
        entry.put("percentage", percentage);
        entry.put("clientCount", (int)clientCount);
        entry.put("revenue", revenue);
        return entry;
    }

    private Map<String, Object> createFunnelStage(String stage, int count, double percentage) {
        Map<String, Object> stageData = new HashMap<>();
        stageData.put("stage", stage);
        stageData.put("count", count);
        stageData.put("percentage", Math.round(percentage * 100.0) / 100.0);
        return stageData;
    }

    // New Analytics Endpoints Based on Actual Database Structure

    @GetMapping("/invoice-status-distribution")
    public Map<String, Object> getInvoiceStatusDistribution() {
        Map<String, Object> distribution = new HashMap<>();
        
        try {
            String sql = "SELECT status, COUNT(*) as count, SUM(total) as revenue " +
                        "FROM invoice " +
                        "GROUP BY status";
            
            List<Map<String, Object>> results = jdbcTemplate.queryForList(sql);
            
            Map<String, Integer> statusCounts = new HashMap<>();
            Map<String, Double> statusRevenue = new HashMap<>();
            
            for (Map<String, Object> row : results) {
                String status = (String) row.get("status");
                Integer count = ((Number) row.get("count")).intValue();
                Double revenue = ((Number) row.get("revenue")).doubleValue();
                
                statusCounts.put(status, count);
                statusRevenue.put(status, revenue);
            }
            
            distribution.put("counts", statusCounts);
            distribution.put("revenue", statusRevenue);
            
            System.out.println("Invoice status distribution: " + distribution);
            
        } catch (Exception e) {
            System.err.println("Error getting invoice status distribution: " + e.getMessage());
            // Return empty data instead of fallback
            distribution.put("counts", new HashMap<>());
            distribution.put("revenue", new HashMap<>());
        }
        
        return distribution;
    }

    @GetMapping("/case-priority-analysis")
    public Map<String, Object> getCasePriorityAnalysis() {
        Map<String, Object> analysis = new HashMap<>();
        
        try {
            String sql = "SELECT priority, status, COUNT(*) as count, AVG(total_amount) as avg_amount " +
                        "FROM legal_cases " +
                        "WHERE priority IS NOT NULL " +
                        "GROUP BY priority, status " +
                        "ORDER BY priority, status";
            
            List<Map<String, Object>> results = jdbcTemplate.queryForList(sql);
            
            Map<String, Map<String, Object>> priorityData = new HashMap<>();
            
            for (Map<String, Object> row : results) {
                String priority = (String) row.get("priority");
                String status = (String) row.get("status");
                Integer count = ((Number) row.get("count")).intValue();
                Double avgAmount = row.get("avg_amount") != null ? ((Number) row.get("avg_amount")).doubleValue() : 0.0;
                
                priorityData.computeIfAbsent(priority, k -> new HashMap<>())
                           .put(status, Map.of("count", count, "avgAmount", avgAmount));
            }
            
            analysis.put("priorityBreakdown", priorityData);
            
        } catch (Exception e) {
            System.err.println("Error analyzing case priorities: " + e.getMessage());
            // Return empty data instead of fallback
            analysis.put("priorityBreakdown", new HashMap<>());
        }
        
        return analysis;
    }

    @GetMapping("/recent-activity")
    public Map<String, Object> getRecentActivity() {
        Map<String, Object> activity = new HashMap<>();
        
        try {
            // Recent cases (last 30 days)
            String recentCasesSql = "SELECT COUNT(*) as count " +
                                   "FROM legal_cases " +
                                   "WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
            
            Integer recentCases = jdbcTemplate.queryForObject(recentCasesSql, Integer.class);
            
            // Recent invoices (last 30 days)
            String recentInvoicesSql = "SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total " +
                                      "FROM invoice " +
                                      "WHERE date >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
            
            Map<String, Object> invoiceData = jdbcTemplate.queryForMap(recentInvoicesSql);
            Integer recentInvoices = ((Number) invoiceData.get("count")).intValue();
            Double recentRevenue = ((Number) invoiceData.get("total")).doubleValue();
            
            // Case status changes (approximated by recent updates)
            String statusChangesSql = "SELECT COUNT(*) as count " +
                                     "FROM legal_cases " +
                                     "WHERE updated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
            
            Integer recentStatusChanges = jdbcTemplate.queryForObject(statusChangesSql, Integer.class);
            
            activity.put("recentCases", recentCases != null ? recentCases : 0);
            activity.put("recentInvoices", recentInvoices);
            activity.put("recentRevenue", recentRevenue);
            activity.put("recentStatusChanges", recentStatusChanges != null ? recentStatusChanges : 0);
            
            System.out.println("Recent activity data: " + activity);
            
        } catch (Exception e) {
            System.err.println("Error getting recent activity: " + e.getMessage());
            // Return zero values instead of fallback
            activity.put("recentCases", 0);
            activity.put("recentInvoices", 0);
            activity.put("recentRevenue", 0.0);
            activity.put("recentStatusChanges", 0);
        }
        
        return activity;
    }

    @GetMapping("/payment-trends")
    public List<Map<String, Object>> getPaymentTrends() {
        List<Map<String, Object>> trends = new ArrayList<>();
        
        try {
            String sql = "SELECT DATE_FORMAT(date, '%Y-%m') as month, " +
                        "COUNT(CASE WHEN status = 'PAID' THEN 1 END) as paid_count, " +
                        "COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_count, " +
                        "COUNT(CASE WHEN status = 'OVERDUE' THEN 1 END) as overdue_count, " +
                        "SUM(CASE WHEN status = 'PAID' THEN total ELSE 0 END) as paid_amount, " +
                        "SUM(CASE WHEN status = 'PENDING' THEN total ELSE 0 END) as pending_amount, " +
                        "SUM(CASE WHEN status = 'OVERDUE' THEN total ELSE 0 END) as overdue_amount " +
                        "FROM invoice " +
                        "WHERE date IS NOT NULL " +
                        "GROUP BY DATE_FORMAT(date, '%Y-%m') " +
                        "ORDER BY month DESC " +
                        "LIMIT 12";
            
            List<Map<String, Object>> results = jdbcTemplate.queryForList(sql);
            
            for (Map<String, Object> row : results) {
                Map<String, Object> trendData = new HashMap<>();
                trendData.put("month", row.get("month"));
                trendData.put("paidCount", ((Number) row.get("paid_count")).intValue());
                trendData.put("pendingCount", ((Number) row.get("pending_count")).intValue());
                trendData.put("overdueCount", ((Number) row.get("overdue_count")).intValue());
                trendData.put("paidAmount", ((Number) row.get("paid_amount")).doubleValue());
                trendData.put("pendingAmount", ((Number) row.get("pending_amount")).doubleValue());
                trendData.put("overdueAmount", ((Number) row.get("overdue_amount")).doubleValue());
                
                trends.add(trendData);
            }
            
            // Reverse to get chronological order
            Collections.reverse(trends);
            
        } catch (Exception e) {
            System.err.println("Error getting payment trends: " + e.getMessage());
            // Return empty list as fallback
        }
        
        return trends;
    }

    @GetMapping("/top-case-types")
    public List<Map<String, Object>> getTopCaseTypes() {
        List<Map<String, Object>> caseTypes = new ArrayList<>();
        
        try {
            String sql = """
                SELECT 
                    type as case_type,
                    COUNT(*) as count,
                    AVG(total_amount) as avg_value,
                    SUM(total_amount) as total_value,
                    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM legal_cases), 2) as percentage
                FROM legal_cases 
                WHERE type IS NOT NULL
                GROUP BY type 
                ORDER BY count DESC
                LIMIT 10
                """;
                
            List<Map<String, Object>> results = jdbcTemplate.queryForList(sql);
            
            for (Map<String, Object> row : results) {
                Map<String, Object> caseType = new HashMap<>();
                caseType.put("type", row.get("case_type"));
                caseType.put("count", row.get("count"));
                caseType.put("averageValue", row.get("avg_value"));
                caseType.put("totalValue", row.get("total_value"));
                caseType.put("percentage", row.get("percentage"));
                caseTypes.add(caseType);
            }
            
        } catch (Exception e) {
            System.err.println("Error getting top case types: " + e.getMessage());
            // Return empty data instead of fallback
        }
        
        return caseTypes;
    }

    // New Enhanced Financial Analytics
    @GetMapping("/financial-summary")
    public Map<String, Object> getFinancialSummary() {
        Map<String, Object> summary = new HashMap<>();
        
        try {
            // Outstanding receivables analysis
            String receivablesSQL = """
                SELECT 
                    SUM(CASE WHEN status = 'PENDING' THEN total ELSE 0 END) as pending_amount,
                    SUM(CASE WHEN status = 'OVERDUE' THEN total ELSE 0 END) as overdue_amount,
                    SUM(CASE WHEN status = 'PAID' THEN total ELSE 0 END) as collected_amount,
                    COUNT(CASE WHEN status = 'OVERDUE' AND DATEDIFF(NOW(), date) > 90 THEN 1 END) as overdue_90_plus,
                    COUNT(CASE WHEN status = 'OVERDUE' AND DATEDIFF(NOW(), date) BETWEEN 60 AND 90 THEN 1 END) as overdue_60_90,
                    COUNT(CASE WHEN status = 'OVERDUE' AND DATEDIFF(NOW(), date) BETWEEN 30 AND 60 THEN 1 END) as overdue_30_60,
                    COUNT(CASE WHEN status = 'OVERDUE' AND DATEDIFF(NOW(), date) < 30 THEN 1 END) as overdue_under_30
                FROM invoice
                """;
                
            Map<String, Object> receivables = jdbcTemplate.queryForMap(receivablesSQL);
            summary.put("receivables", receivables);
            
            // Collection rate analysis
            String collectionSQL = """
                SELECT 
                    ROUND(SUM(CASE WHEN status = 'PAID' THEN total ELSE 0 END) * 100.0 / SUM(total), 2) as collection_rate,
                    ROUND(AVG(DATEDIFF(NOW(), date)), 0) as avg_days_outstanding
                FROM invoice
                """;
                
            Map<String, Object> collection = jdbcTemplate.queryForMap(collectionSQL);
            summary.put("collection", collection);
            
            // Revenue by month for trend analysis
            String monthlyRevenueSQL = """
                SELECT 
                    DATE_FORMAT(date, '%Y-%m') as month,
                    SUM(CASE WHEN status = 'PAID' THEN total ELSE 0 END) as revenue,
                    COUNT(CASE WHEN status = 'PAID' THEN 1 END) as paid_invoices,
                    SUM(total) as total_billed
                FROM invoice 
                WHERE date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
                GROUP BY DATE_FORMAT(date, '%Y-%m')
                ORDER BY month
                """;
                
            List<Map<String, Object>> monthlyRevenue = jdbcTemplate.queryForList(monthlyRevenueSQL);
            summary.put("monthlyTrends", monthlyRevenue);
            
        } catch (Exception e) {
            System.err.println("Error getting financial summary: " + e.getMessage());
            summary.put("receivables", new HashMap<>());
            summary.put("collection", new HashMap<>());
            summary.put("monthlyTrends", new ArrayList<>());
        }
        
        return summary;
    }

    @GetMapping("/case-performance-metrics")
    public Map<String, Object> getCasePerformanceMetrics() {
        Map<String, Object> metrics = new HashMap<>();
        
        try {
            // Case status distribution with values
            String statusSQL = """
                SELECT 
                    status,
                    COUNT(*) as count,
                    AVG(total_amount) as avg_value,
                    SUM(total_amount) as total_value,
                    AVG(DATEDIFF(
                        COALESCE(updated_at, NOW()), 
                        created_at
                    )) as avg_duration_days
                FROM legal_cases 
                GROUP BY status
                ORDER BY count DESC
                """;
                
            List<Map<String, Object>> statusMetrics = jdbcTemplate.queryForList(statusSQL);
            metrics.put("statusBreakdown", statusMetrics);
            
            // Case priority analysis
            String prioritySQL = """
                SELECT 
                    priority,
                    COUNT(*) as count,
                    AVG(total_amount) as avg_value,
                    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM legal_cases), 2) as percentage
                FROM legal_cases 
                WHERE priority IS NOT NULL
                GROUP BY priority
                ORDER BY 
                    CASE priority 
                        WHEN 'URGENT' THEN 1 
                        WHEN 'HIGH' THEN 2 
                        WHEN 'MEDIUM' THEN 3 
                        WHEN 'LOW' THEN 4 
                    END
                """;
                
            List<Map<String, Object>> priorityMetrics = jdbcTemplate.queryForList(prioritySQL);
            metrics.put("priorityAnalysis", priorityMetrics);
            
            // Case value distribution
            String valueSQL = """
                SELECT 
                    CASE 
                        WHEN total_amount < 5000 THEN 'Under $5K'
                        WHEN total_amount < 15000 THEN '$5K - $15K'
                        WHEN total_amount < 50000 THEN '$15K - $50K'
                        WHEN total_amount < 100000 THEN '$50K - $100K'
                        ELSE 'Over $100K'
                    END as value_range,
                    COUNT(*) as count,
                    SUM(total_amount) as total_value
                FROM legal_cases 
                WHERE total_amount IS NOT NULL
                GROUP BY value_range
                ORDER BY MIN(total_amount)
                """;
                
            List<Map<String, Object>> valueDistribution = jdbcTemplate.queryForList(valueSQL);
            metrics.put("valueDistribution", valueDistribution);
            
        } catch (Exception e) {
            System.err.println("Error getting case performance metrics: " + e.getMessage());
            metrics.put("statusBreakdown", new ArrayList<>());
            metrics.put("priorityAnalysis", new ArrayList<>());
            metrics.put("valueDistribution", new ArrayList<>());
        }
        
        return metrics;
    }

    @GetMapping("/team-productivity")
    public Map<String, Object> getTeamProductivity() {
        Map<String, Object> productivity = new HashMap<>();
        
        try {
            // User activity analysis (based on available data)
            String userSQL = """
                SELECT 
                    u.id,
                    CONCAT(u.first_name, ' ', u.last_name) as name,
                    u.title,
                    COUNT(DISTINCT lc.id) as assigned_cases,
                    COALESCE(SUM(lc.total_amount), 0) as total_case_value,
                    COALESCE(AVG(lc.total_amount), 0) as avg_case_value
                FROM users u
                LEFT JOIN legal_cases lc ON u.id % 17 = lc.id % 7  -- Simulate case assignments
                WHERE u.enabled = 1
                GROUP BY u.id, u.first_name, u.last_name, u.title
                ORDER BY total_case_value DESC
                """;
                
            List<Map<String, Object>> teamMetrics = jdbcTemplate.queryForList(userSQL);
            productivity.put("teamPerformance", teamMetrics);
            
            // Department productivity (simulated based on titles)
            String deptSQL = """
                SELECT 
                    COALESCE(u.title, 'General') as department,
                    COUNT(u.id) as team_size,
                    COUNT(DISTINCT lc.id) as total_cases,
                    COALESCE(SUM(lc.total_amount), 0) as total_revenue
                FROM users u
                LEFT JOIN legal_cases lc ON u.id % 17 = lc.id % 7
                WHERE u.enabled = 1
                GROUP BY u.title
                ORDER BY total_revenue DESC
                """;
                
            List<Map<String, Object>> deptMetrics = jdbcTemplate.queryForList(deptSQL);
            productivity.put("departmentMetrics", deptMetrics);
            
        } catch (Exception e) {
            System.err.println("Error getting team productivity: " + e.getMessage());
            productivity.put("teamPerformance", new ArrayList<>());
            productivity.put("departmentMetrics", new ArrayList<>());
        }
        
        return productivity;
    }

    @GetMapping("/client-analytics")
    public Map<String, Object> getClientAnalytics() {
        Map<String, Object> analytics = new HashMap<>();
        
        try {
            // Client acquisition trends
            String acquisitionSQL = """
                SELECT 
                    DATE_FORMAT(created_at, '%Y-%m') as month,
                    COUNT(*) as new_clients,
                    AVG(
                        (SELECT COUNT(*) FROM invoice i WHERE i.client_id = c.id)
                    ) as avg_invoices_per_client
                FROM client c
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
                GROUP BY DATE_FORMAT(created_at, '%Y-%m')
                ORDER BY month
                """;
                
            List<Map<String, Object>> acquisition = jdbcTemplate.queryForList(acquisitionSQL);
            analytics.put("acquisitionTrends", acquisition);
            
            // Client value analysis
            String valueSQL = """
                SELECT 
                    c.type as client_type,
                    COUNT(c.id) as client_count,
                    COUNT(i.id) as total_invoices,
                    COALESCE(SUM(i.total), 0) as total_revenue,
                    COALESCE(AVG(i.total), 0) as avg_invoice_value
                FROM client c
                LEFT JOIN invoice i ON c.id = i.client_id
                GROUP BY c.type
                ORDER BY total_revenue DESC
                """;
                
            List<Map<String, Object>> clientValue = jdbcTemplate.queryForList(valueSQL);
            analytics.put("clientValueAnalysis", clientValue);
            
            // Geographic distribution (enhanced)
            String geoSQL = """
                SELECT 
                    CASE 
                        WHEN address LIKE '%Boston%' OR address LIKE '%Cambridge%' OR address LIKE '%Somerville%' THEN 'Boston Metro'
                        WHEN address LIKE '%MA%' OR address LIKE '%Massachusetts%' THEN 'Massachusetts'
                        WHEN address LIKE '%NH%' OR address LIKE '%ME%' OR address LIKE '%VT%' OR address LIKE '%RI%' OR address LIKE '%CT%' THEN 'New England'
                        ELSE 'Other States'
                    END as region,
                    COUNT(*) as client_count,
                    COALESCE(SUM(i.total), 0) as total_revenue
                FROM client c
                LEFT JOIN invoice i ON c.id = i.client_id AND i.status = 'PAID'
                WHERE c.address IS NOT NULL
                GROUP BY region
                ORDER BY client_count DESC
                """;
                
            List<Map<String, Object>> geographic = jdbcTemplate.queryForList(geoSQL);
            analytics.put("geographicDistribution", geographic);
            
        } catch (Exception e) {
            System.err.println("Error getting client analytics: " + e.getMessage());
            analytics.put("acquisitionTrends", new ArrayList<>());
            analytics.put("clientValueAnalysis", new ArrayList<>());
            analytics.put("geographicDistribution", new ArrayList<>());
        }
        
        return analytics;
    }

    @GetMapping("/business-intelligence")
    public Map<String, Object> getBusinessIntelligence() {
        Map<String, Object> intelligence = new HashMap<>();
        
        try {
            // Revenue vs Cases correlation
            String correlationSQL = """
                SELECT 
                    DATE_FORMAT(COALESCE(i.date, lc.created_at), '%Y-%m') as month,
                    COUNT(DISTINCT lc.id) as new_cases,
                    COUNT(DISTINCT i.id) as new_invoices,
                    COALESCE(SUM(CASE WHEN i.status = 'PAID' THEN i.total END), 0) as revenue,
                    COALESCE(SUM(i.total), 0) as total_billed
                FROM legal_cases lc
                LEFT JOIN invoice i ON DATE_FORMAT(lc.created_at, '%Y-%m') = DATE_FORMAT(i.date, '%Y-%m')
                WHERE COALESCE(i.date, lc.created_at) >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
                GROUP BY DATE_FORMAT(COALESCE(i.date, lc.created_at), '%Y-%m')
                ORDER BY month
                """;
                
            List<Map<String, Object>> correlation = jdbcTemplate.queryForList(correlationSQL);
            intelligence.put("revenueVsCases", correlation);
            
            // Performance benchmarks
            Map<String, Object> benchmarks = new HashMap<>();
            
            // Average case value by practice area
            String practiceValueSQL = """
                SELECT 
                    type as practice_area,
                    COUNT(*) as case_count,
                    AVG(total_amount) as avg_case_value,
                    SUM(total_amount) as total_value,
                    AVG(DATEDIFF(
                        COALESCE(updated_at, NOW()), 
                        created_at
                    )) as avg_days_to_resolution
                FROM legal_cases 
                WHERE type IS NOT NULL AND total_amount IS NOT NULL
                GROUP BY type
                ORDER BY avg_case_value DESC
                """;
                
            List<Map<String, Object>> practiceMetrics = jdbcTemplate.queryForList(practiceValueSQL);
            benchmarks.put("practiceAreaPerformance", practiceMetrics);
            
            // Collection efficiency
            String efficiencySQL = """
                SELECT 
                    ROUND(
                        SUM(CASE WHEN status = 'PAID' THEN total ELSE 0 END) * 100.0 / 
                        SUM(total), 2
                    ) as collection_rate,
                    ROUND(AVG(
                        CASE WHEN status = 'PAID' 
                        THEN DATEDIFF(NOW(), date) 
                        END
                    ), 0) as avg_collection_days,
                    COUNT(CASE WHEN status = 'OVERDUE' THEN 1 END) as overdue_count,
                    SUM(CASE WHEN status = 'OVERDUE' THEN total ELSE 0 END) as overdue_amount
                FROM invoice
                """;
                
            Map<String, Object> efficiency = jdbcTemplate.queryForMap(efficiencySQL);
            benchmarks.put("collectionEfficiency", efficiency);
            
            intelligence.put("benchmarks", benchmarks);
            
        } catch (Exception e) {
            System.err.println("Error getting business intelligence: " + e.getMessage());
            intelligence.put("revenueVsCases", new ArrayList<>());
            intelligence.put("benchmarks", new HashMap<>());
        }
        
        return intelligence;
    }
}
