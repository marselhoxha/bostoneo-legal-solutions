package com.bostoneo.bostoneosolutions.tenant.isolation;

import com.bostoneo.bostoneosolutions.model.*;
import com.bostoneo.bostoneosolutions.multitenancy.TenantContext;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Test fixtures for multi-tenant testing.
 * Provides helper methods to create tenant-isolated test data.
 *
 * SECURITY: Use these fixtures to create properly isolated test data
 * for verifying tenant isolation in unit and integration tests.
 */
public class TenantTestFixtures {

    // Standard test organization IDs
    public static final Long ORG_1 = 1L;
    public static final Long ORG_2 = 2L;
    public static final Long ORG_SUPERADMIN = 0L;

    // Standard test user IDs
    public static final Long USER_1_ORG_1 = 100L;
    public static final Long USER_2_ORG_1 = 101L;
    public static final Long USER_1_ORG_2 = 200L;
    public static final Long USER_2_ORG_2 = 201L;

    // ==================== Organization Factory ====================

    public static Organization createOrganization(Long id, String name) {
        return Organization.builder()
            .id(id)
            .name(name)
            .slug(name.toLowerCase().replace(" ", "-"))
            .createdAt(LocalDateTime.now())
            .build();
    }

    public static Organization createOrg1() {
        return createOrganization(ORG_1, "Test Organization 1");
    }

    public static Organization createOrg2() {
        return createOrganization(ORG_2, "Test Organization 2");
    }

    // ==================== Client Factory ====================

    public static Client createClient(Long id, String name, String email, Long orgId) {
        return Client.builder()
            .id(id)
            .name(name)
            .email(email)
            .organizationId(orgId)
            .build();
    }

    public static Client createClientForOrg1(Long id) {
        return createClient(id, "John Doe", "john.doe@org1.com", ORG_1);
    }

    public static Client createClientForOrg2(Long id) {
        return createClient(id, "Jane Smith", "jane.smith@org2.com", ORG_2);
    }

    // ==================== LegalCase Factory ====================

    public static LegalCase createLegalCase(Long id, String title, Long clientId, Long orgId) {
        return LegalCase.builder()
            .id(id)
            .title(title)
            .caseNumber("CASE-" + id)
            .clientId(clientId)
            .organizationId(orgId)
            .build();
    }

    public static LegalCase createLegalCaseForOrg1(Long id, Long clientId) {
        return createLegalCase(id, "Test Case for Org 1", clientId, ORG_1);
    }

    public static LegalCase createLegalCaseForOrg2(Long id, Long clientId) {
        return createLegalCase(id, "Test Case for Org 2", clientId, ORG_2);
    }

    // ==================== Invoice Factory ====================

    public static Invoice createInvoice(Long id, String invoiceNumber, Long clientId, Long caseId, Long orgId) {
        Invoice invoice = new Invoice();
        invoice.setId(id);
        invoice.setInvoiceNumber(invoiceNumber);
        invoice.setClientId(clientId);
        invoice.setLegalCaseId(caseId);
        invoice.setOrganizationId(orgId);
        invoice.setTotalAmount(BigDecimal.valueOf(1000.00));
        invoice.setIssueDate(LocalDate.now());
        invoice.setDueDate(LocalDate.now().plusDays(30));
        return invoice;
    }

    public static Invoice createInvoiceForOrg1(Long id) {
        return createInvoice(id, "INV-" + id, 100L, 10L, ORG_1);
    }

    public static Invoice createInvoiceForOrg2(Long id) {
        return createInvoice(id, "INV-" + id, 200L, 20L, ORG_2);
    }

    // ==================== Expense Factory ====================

    public static Expense createExpense(Long id, String description, BigDecimal amount, Long orgId) {
        Expense expense = new Expense();
        expense.setId(id);
        expense.setDescription(description);
        expense.setAmount(amount);
        expense.setCurrency("USD");
        expense.setOrganizationId(orgId);
        return expense;
    }

    public static Expense createExpenseForOrg1(Long id) {
        return createExpense(id, "Test Expense Org 1", BigDecimal.valueOf(100.00), ORG_1);
    }

    public static Expense createExpenseForOrg2(Long id) {
        return createExpense(id, "Test Expense Org 2", BigDecimal.valueOf(200.00), ORG_2);
    }

    // ==================== FileItem Factory ====================

    public static FileItem createFileItem(Long id, String name, Long orgId) {
        FileItem file = new FileItem();
        file.setId(id);
        file.setName(name);
        file.setOrganizationId(orgId);
        file.setDeleted(false);
        file.setCreatedAt(LocalDateTime.now());
        return file;
    }

    public static FileItem createFileItemForOrg1(Long id) {
        return createFileItem(id, "document_org1.pdf", ORG_1);
    }

    public static FileItem createFileItemForOrg2(Long id) {
        return createFileItem(id, "document_org2.pdf", ORG_2);
    }

    // ==================== CalendarEvent Factory ====================

    public static CalendarEvent createCalendarEvent(Long id, String title, Long userId, Long orgId) {
        CalendarEvent event = new CalendarEvent();
        event.setId(id);
        event.setTitle(title);
        event.setUserId(userId);
        event.setOrganizationId(orgId);
        event.setStartTime(LocalDateTime.now().plusDays(1));
        event.setEndTime(LocalDateTime.now().plusDays(1).plusHours(1));
        event.setCreatedAt(LocalDateTime.now());
        return event;
    }

    // ==================== UserNotificationPreference Factory ====================

    public static UserNotificationPreference createNotificationPreference(
            Long id, Long userId, String eventType, Long orgId) {
        UserNotificationPreference pref = new UserNotificationPreference();
        pref.setId(id);
        pref.setUserId(userId);
        pref.setEventType(eventType);
        pref.setEnabled(true);
        pref.setEmailEnabled(true);
        pref.setPushEnabled(true);
        pref.setInAppEnabled(true);
        pref.setOrganizationId(orgId);
        return pref;
    }

    // ==================== TenantContext Helpers ====================

    /**
     * Set up tenant context for ORG_1.
     * Call clear() after test.
     */
    public static void setupTenantContextOrg1() {
        TenantContext.setCurrentTenant(ORG_1);
    }

    /**
     * Set up tenant context for ORG_2.
     * Call clear() after test.
     */
    public static void setupTenantContextOrg2() {
        TenantContext.setCurrentTenant(ORG_2);
    }

    /**
     * Clear tenant context.
     * Should be called in @AfterEach.
     */
    public static void clearTenantContext() {
        TenantContext.clear();
    }

    // ==================== Cross-Tenant Test Data Builder ====================

    /**
     * Creates test data for both organizations.
     * Useful for cross-tenant access testing.
     */
    public static class CrossTenantTestData {
        public final Organization org1;
        public final Organization org2;
        public final Client clientOrg1;
        public final Client clientOrg2;
        public final LegalCase caseOrg1;
        public final LegalCase caseOrg2;
        public final Invoice invoiceOrg1;
        public final Invoice invoiceOrg2;

        public CrossTenantTestData() {
            this.org1 = createOrg1();
            this.org2 = createOrg2();
            this.clientOrg1 = createClientForOrg1(100L);
            this.clientOrg2 = createClientForOrg2(200L);
            this.caseOrg1 = createLegalCaseForOrg1(10L, 100L);
            this.caseOrg2 = createLegalCaseForOrg2(20L, 200L);
            this.invoiceOrg1 = createInvoiceForOrg1(1000L);
            this.invoiceOrg2 = createInvoiceForOrg2(2000L);
        }
    }

    /**
     * Create a complete set of cross-tenant test data.
     */
    public static CrossTenantTestData createCrossTenantTestData() {
        return new CrossTenantTestData();
    }
}
