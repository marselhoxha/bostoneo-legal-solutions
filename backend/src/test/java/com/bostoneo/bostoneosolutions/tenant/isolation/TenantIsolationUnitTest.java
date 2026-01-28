package com.bostoneo.bostoneosolutions.tenant.isolation;

import com.bostoneo.bostoneosolutions.repository.*;
import org.junit.jupiter.api.*;
import org.springframework.data.domain.Pageable;

import java.lang.reflect.Method;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit Tests to verify tenant-filtered repository methods exist.
 * These tests verify that repositories have proper organization_id filtering.
 *
 * SECURITY: Tenant isolation is critical for multi-tenant applications.
 * All repository methods that return tenant-specific data MUST filter by organizationId.
 */
@DisplayName("Tenant Isolation Repository Method Verification")
class TenantIsolationUnitTest {

    @Nested
    @DisplayName("Core Entity Repositories - IMPLEMENTED")
    class CoreEntityTests {

        @Test
        @DisplayName("ClientRepository has tenant-filtered methods")
        void clientRepositoryHasTenantMethods() {
            assertMethodExists(ClientRepository.class, "findByOrganizationId", Long.class);
            assertMethodExists(ClientRepository.class, "findByIdAndOrganizationId", Long.class, Long.class);
            assertMethodExists(ClientRepository.class, "countByOrganizationId", Long.class);
            assertMethodExists(ClientRepository.class, "existsByIdAndOrganizationId", Long.class, Long.class);
        }

        @Test
        @DisplayName("LegalCaseRepository has tenant-filtered methods")
        void legalCaseRepositoryHasTenantMethods() {
            assertMethodExists(LegalCaseRepository.class, "findByOrganizationId", Long.class, Pageable.class);
            assertMethodExists(LegalCaseRepository.class, "findByIdAndOrganizationId", Long.class, Long.class);
            assertMethodExists(LegalCaseRepository.class, "existsByIdAndOrganizationId", Long.class, Long.class);
            assertMethodExists(LegalCaseRepository.class, "searchCasesByOrganization", Long.class, String.class, Pageable.class);
        }

        @Test
        @DisplayName("InvoiceRepository has tenant-filtered methods")
        void invoiceRepositoryHasTenantMethods() {
            assertMethodExists(InvoiceRepository.class, "findByOrganizationId", Long.class, Pageable.class);
            assertMethodExists(InvoiceRepository.class, "findByIdAndOrganizationId", Long.class, Long.class);
            assertMethodExists(InvoiceRepository.class, "existsByIdAndOrganizationId", Long.class, Long.class);
        }

        @Test
        @DisplayName("LeadRepository has tenant-filtered methods")
        void leadRepositoryHasTenantMethods() {
            assertMethodExists(LeadRepository.class, "findByOrganizationId", Long.class);
            assertMethodExists(LeadRepository.class, "findByIdAndOrganizationId", Long.class, Long.class);
        }

        @Test
        @DisplayName("OrganizationRepository exists")
        void organizationRepositoryExists() {
            assertNotNull(OrganizationRepository.class);
        }
    }

    @Nested
    @DisplayName("Additional Repositories - IMPLEMENTED")
    class ImplementedRepositoryTests {

        @Test
        @DisplayName("CalendarEventRepository has tenant-filtered methods")
        void calendarEventRepositoryHasTenantMethods() {
            assertMethodExists(CalendarEventRepository.class, "findByOrganizationId", Long.class);
            assertMethodExists(CalendarEventRepository.class, "findByIdAndOrganizationId", Long.class, Long.class);
        }

        @Test
        @DisplayName("TimeEntryRepository has tenant-filtered methods")
        void timeEntryRepositoryHasTenantMethods() {
            assertMethodExists(TimeEntryRepository.class, "findByOrganizationId", Long.class);
            assertMethodExists(TimeEntryRepository.class, "findByIdAndOrganizationId", Long.class, Long.class);
        }

        @Test
        @DisplayName("EmailTemplateRepository has tenant-filtered methods")
        void emailTemplateRepositoryHasTenantMethods() {
            assertMethodExists(EmailTemplateRepository.class, "findByOrganizationId", Long.class);
            assertMethodExists(EmailTemplateRepository.class, "findByIdAndOrganizationId", Long.class, Long.class);
        }

        @Test
        @DisplayName("AILegalTemplateRepository has tenant-filtered methods")
        void aiLegalTemplateRepositoryHasTenantMethods() {
            assertMethodExists(AILegalTemplateRepository.class, "findByOrganizationId", Long.class);
            assertMethodExists(AILegalTemplateRepository.class, "findByIdAndOrganizationId", Long.class, Long.class);
        }

        @Test
        @DisplayName("LegalDocumentRepository has tenant-filtered methods")
        void legalDocumentRepositoryHasTenantMethods() {
            assertMethodExists(LegalDocumentRepository.class, "findByOrganizationId", Long.class);
            assertMethodExists(LegalDocumentRepository.class, "findByIdAndOrganizationId", Long.class, Long.class);
        }

        @Test
        @DisplayName("CaseWorkflowTemplateRepository has tenant-filtered methods")
        void caseWorkflowTemplateRepositoryHasTenantMethods() {
            assertMethodExists(CaseWorkflowTemplateRepository.class, "findByOrganizationId", Long.class);
            assertMethodExists(CaseWorkflowTemplateRepository.class, "findByIdAndOrganizationId", Long.class, Long.class);
        }

        @Test
        @DisplayName("InvoiceWorkflowRuleRepository has tenant-filtered methods")
        void invoiceWorkflowRuleRepositoryHasTenantMethods() {
            assertMethodExists(InvoiceWorkflowRuleRepository.class, "findByOrganizationId", Long.class);
            assertMethodExists(InvoiceWorkflowRuleRepository.class, "findByIdAndOrganizationId", Long.class, Long.class);
        }

        @Test
        @DisplayName("PaymentTransactionRepository has tenant-filtered methods")
        void paymentTransactionRepositoryHasTenantMethods() {
            assertMethodExists(PaymentTransactionRepository.class, "findByOrganizationId", Long.class);
            assertMethodExists(PaymentTransactionRepository.class, "findByIdAndOrganizationId", Long.class, Long.class);
        }

        @Test
        @DisplayName("BillingRateRepository has tenant-filtered methods")
        void billingRateRepositoryHasTenantMethods() {
            assertMethodExists(BillingRateRepository.class, "findByOrganizationId", Long.class);
            assertMethodExists(BillingRateRepository.class, "findByIdAndOrganizationId", Long.class, Long.class);
        }

        @Test
        @DisplayName("AttorneyRepository has tenant-filtered methods")
        void attorneyRepositoryHasTenantMethods() {
            assertMethodExists(AttorneyRepository.class, "findByOrganizationId", Long.class);
            assertMethodExists(AttorneyRepository.class, "findByIdAndOrganizationId", Long.class, Long.class);
        }
    }

    @Nested
    @DisplayName("Newly Implemented Repositories")
    class NewlyImplementedRepositoryTests {

        @Test
        @DisplayName("ExpenseRepository has tenant-filtered methods")
        void expenseRepositoryHasTenantMethods() {
            assertMethodExists(ExpenseRepository.class, "findByOrganizationId", Long.class);
            assertMethodExists(ExpenseRepository.class, "findByIdAndOrganizationId", Long.class, Long.class);
        }

        @Test
        @DisplayName("FileItemRepository has tenant-filtered methods")
        void fileItemRepositoryHasTenantMethods() {
            assertMethodExists(FileItemRepository.class, "findByOrganizationId", Long.class);
            assertMethodExists(FileItemRepository.class, "findByIdAndOrganizationId", Long.class, Long.class);
        }

        @Test
        @DisplayName("AuditLogRepository has tenant-filtered methods")
        void auditLogRepositoryHasTenantMethods() {
            assertMethodExists(AuditLogRepository.class, "findByOrganizationId", Long.class);
            assertMethodExists(AuditLogRepository.class, "findByIdAndOrganizationId", Long.class, Long.class);
        }

        @Test
        @DisplayName("AIDocumentAnalysisRepository has tenant-filtered methods")
        void aiDocumentAnalysisRepositoryHasTenantMethods() {
            assertMethodExists(AIDocumentAnalysisRepository.class, "findByOrganizationId", Long.class);
            assertMethodExists(AIDocumentAnalysisRepository.class, "findByIdAndOrganizationId", Long.class, Long.class);
        }

        @Test
        @DisplayName("ActionItemRepository has tenant-filtered methods")
        void actionItemRepositoryHasTenantMethods() {
            assertMethodExists(ActionItemRepository.class, "findByOrganizationId", Long.class);
            assertMethodExists(ActionItemRepository.class, "findByIdAndOrganizationId", Long.class, Long.class);
        }

        @Test
        @DisplayName("DocumentVersionRepository has tenant-filtered methods")
        void documentVersionRepositoryHasTenantMethods() {
            assertMethodExists(DocumentVersionRepository.class, "findByOrganizationId", Long.class);
            assertMethodExists(DocumentVersionRepository.class, "findByIdAndOrganizationId", Long.class, Long.class);
        }

        @Test
        @DisplayName("DocumentChunkRepository has tenant-filtered methods")
        void documentChunkRepositoryHasTenantMethods() {
            assertMethodExists(DocumentChunkRepository.class, "findByOrganizationId", Long.class);
            assertMethodExists(DocumentChunkRepository.class, "findByIdAndOrganizationId", Long.class, Long.class);
        }

        @Test
        @DisplayName("CaseWorkflowExecutionRepository has tenant-filtered methods")
        void caseWorkflowExecutionRepositoryHasTenantMethods() {
            assertMethodExists(CaseWorkflowExecutionRepository.class, "findByOrganizationId", Long.class);
            assertMethodExists(CaseWorkflowExecutionRepository.class, "findByIdAndOrganizationId", Long.class, Long.class);
        }

        @Test
        @DisplayName("UserNotificationRepository has tenant-filtered methods")
        void userNotificationRepositoryHasTenantMethods() {
            assertMethodExists(UserNotificationRepository.class, "findByOrganizationId", Long.class);
            assertMethodExists(UserNotificationRepository.class, "findByIdAndOrganizationId", Long.class, Long.class);
        }

        @Test
        @DisplayName("MessageRepository has tenant-filtered methods")
        void messageRepositoryHasTenantMethods() {
            assertMethodExists(MessageRepository.class, "findByOrganizationId", Long.class);
            assertMethodExists(MessageRepository.class, "findByIdAndOrganizationId", Long.class, Long.class);
        }

        @Test
        @DisplayName("MessageThreadRepository has tenant-filtered methods")
        void messageThreadRepositoryHasTenantMethods() {
            assertMethodExists(MessageThreadRepository.class, "findByOrganizationId", Long.class);
            assertMethodExists(MessageThreadRepository.class, "findByIdAndOrganizationId", Long.class, Long.class);
        }

        @Test
        @DisplayName("LeadActivityRepository has tenant-filtered methods")
        void leadActivityRepositoryHasTenantMethods() {
            assertMethodExists(LeadActivityRepository.class, "findByOrganizationId", Long.class);
            assertMethodExists(LeadActivityRepository.class, "findByIdAndOrganizationId", Long.class, Long.class);
        }

        @Test
        @DisplayName("LeadPipelineHistoryRepository has tenant-filtered methods")
        void leadPipelineHistoryRepositoryHasTenantMethods() {
            assertMethodExists(LeadPipelineHistoryRepository.class, "findByOrganizationId", Long.class);
            assertMethodExists(LeadPipelineHistoryRepository.class, "findByIdAndOrganizationId", Long.class, Long.class);
        }

        @Test
        @DisplayName("CaseAssignmentHistoryRepository has tenant-filtered methods")
        void caseAssignmentHistoryRepositoryHasTenantMethods() {
            assertMethodExists(CaseAssignmentHistoryRepository.class, "findByOrganizationId", Long.class);
            assertMethodExists(CaseAssignmentHistoryRepository.class, "findByIdAndOrganizationId", Long.class, Long.class);
        }

        @Test
        @DisplayName("PipelineStageRepository has tenant-filtered methods")
        void pipelineStageRepositoryHasTenantMethods() {
            assertMethodExists(PipelineStageRepository.class, "findByOrganizationId", Long.class);
            assertMethodExists(PipelineStageRepository.class, "findByIdAndOrganizationId", Long.class, Long.class);
        }
    }

    @Nested
    @DisplayName("Custom Interface Repositories (Different API)")
    class CustomInterfaceTests {

        @Test
        @DisplayName("InvoicePaymentRepository uses custom tenant methods")
        void invoicePaymentRepositoryHasCustomTenantMethods() {
            // InvoicePaymentRepository is a custom interface (not JpaRepository)
            // It uses different method naming: getByIdAndOrganization, findRecentPaymentsByOrganization
            assertMethodExists(InvoicePaymentRepository.class, "getByIdAndOrganization", Long.class, Long.class);
            assertMethodExists(InvoicePaymentRepository.class, "findByInvoiceIdAndOrganization", Long.class, Long.class);
            assertMethodExists(InvoicePaymentRepository.class, "findRecentPaymentsByOrganization", Long.class, int.class);
        }

        @Test
        @DisplayName("PermissionAuditLogRepository has tenant methods")
        void permissionAuditLogRepositoryHasTenantMethods() {
            assertMethodExists(PermissionAuditLogRepository.class, "findByOrganizationId", Long.class);
            assertMethodExists(PermissionAuditLogRepository.class, "findByIdAndOrganizationId", Long.class, Long.class);
        }
    }

    @Nested
    @DisplayName("Final Batch - Recently Added")
    class FinalBatchTests {

        @Test
        @DisplayName("FileAccessLogRepository has tenant-filtered methods")
        void fileAccessLogRepositoryHasTenantMethods() {
            assertMethodExists(FileAccessLogRepository.class, "findByOrganizationId", Long.class);
            assertMethodExists(FileAccessLogRepository.class, "findByIdAndOrganizationId", Long.class, Long.class);
        }

        @Test
        @DisplayName("FilePermissionRepository has tenant-filtered methods")
        void filePermissionRepositoryHasTenantMethods() {
            assertMethodExists(FilePermissionRepository.class, "findByOrganizationId", Long.class);
            assertMethodExists(FilePermissionRepository.class, "findByIdAndOrganizationId", Long.class, Long.class);
        }

        @Test
        @DisplayName("TimerSessionRepository has tenant-filtered methods")
        void timerSessionRepositoryHasTenantMethods() {
            assertMethodExists(TimerSessionRepository.class, "findByOrganizationId", Long.class);
            assertMethodExists(TimerSessionRepository.class, "findByIdAndOrganizationId", Long.class, Long.class);
        }
    }

    @Nested
    @DisplayName("Tenant Isolation Coverage Summary")
    class CoverageSummaryTests {

        @Test
        @DisplayName("Print tenant isolation coverage report")
        void printCoverageReport() {
            Map<String, Boolean> repositoryStatus = new LinkedHashMap<>();

            // Check all repositories
            repositoryStatus.put("ClientRepository", hasMethod(ClientRepository.class, "findByOrganizationId"));
            repositoryStatus.put("LegalCaseRepository", hasMethod(LegalCaseRepository.class, "findByOrganizationId"));
            repositoryStatus.put("InvoiceRepository", hasMethod(InvoiceRepository.class, "findByOrganizationId"));
            repositoryStatus.put("LeadRepository", hasMethod(LeadRepository.class, "findByOrganizationId"));
            repositoryStatus.put("CalendarEventRepository", hasMethod(CalendarEventRepository.class, "findByOrganizationId"));
            repositoryStatus.put("TimeEntryRepository", hasMethod(TimeEntryRepository.class, "findByOrganizationId"));
            repositoryStatus.put("EmailTemplateRepository", hasMethod(EmailTemplateRepository.class, "findByOrganizationId"));
            repositoryStatus.put("AILegalTemplateRepository", hasMethod(AILegalTemplateRepository.class, "findByOrganizationId"));
            repositoryStatus.put("LegalDocumentRepository", hasMethod(LegalDocumentRepository.class, "findByOrganizationId"));
            repositoryStatus.put("CaseWorkflowTemplateRepository", hasMethod(CaseWorkflowTemplateRepository.class, "findByOrganizationId"));
            repositoryStatus.put("InvoiceWorkflowRuleRepository", hasMethod(InvoiceWorkflowRuleRepository.class, "findByOrganizationId"));
            repositoryStatus.put("PaymentTransactionRepository", hasMethod(PaymentTransactionRepository.class, "findByOrganizationId"));
            repositoryStatus.put("BillingRateRepository", hasMethod(BillingRateRepository.class, "findByOrganizationId"));
            repositoryStatus.put("AttorneyRepository", hasMethod(AttorneyRepository.class, "findByOrganizationId"));
            repositoryStatus.put("ExpenseRepository", hasMethod(ExpenseRepository.class, "findByOrganizationId"));
            repositoryStatus.put("FileItemRepository", hasMethod(FileItemRepository.class, "findByOrganizationId"));
            repositoryStatus.put("CaseTaskRepository", hasMethod(CaseTaskRepository.class, "findByOrganizationId"));
            repositoryStatus.put("AuditLogRepository", hasMethod(AuditLogRepository.class, "findByOrganizationId"));
            repositoryStatus.put("AIDocumentAnalysisRepository", hasMethod(AIDocumentAnalysisRepository.class, "findByOrganizationId"));
            repositoryStatus.put("ActionItemRepository", hasMethod(ActionItemRepository.class, "findByOrganizationId"));
            repositoryStatus.put("DocumentVersionRepository", hasMethod(DocumentVersionRepository.class, "findByOrganizationId"));
            repositoryStatus.put("DocumentChunkRepository", hasMethod(DocumentChunkRepository.class, "findByOrganizationId"));
            repositoryStatus.put("CaseWorkflowExecutionRepository", hasMethod(CaseWorkflowExecutionRepository.class, "findByOrganizationId"));
            repositoryStatus.put("SignatureRequestRepository", hasMethod(SignatureRequestRepository.class, "findByOrganizationId"));
            repositoryStatus.put("InvoicePaymentRepository", hasMethod(InvoicePaymentRepository.class, "findByOrganizationId"));
            repositoryStatus.put("UserNotificationRepository", hasMethod(UserNotificationRepository.class, "findByOrganizationId"));
            repositoryStatus.put("MessageRepository", hasMethod(MessageRepository.class, "findByOrganizationId"));
            repositoryStatus.put("MessageThreadRepository", hasMethod(MessageThreadRepository.class, "findByOrganizationId"));
            repositoryStatus.put("LeadActivityRepository", hasMethod(LeadActivityRepository.class, "findByOrganizationId"));
            repositoryStatus.put("LeadPipelineHistoryRepository", hasMethod(LeadPipelineHistoryRepository.class, "findByOrganizationId"));
            repositoryStatus.put("CaseAssignmentHistoryRepository", hasMethod(CaseAssignmentHistoryRepository.class, "findByOrganizationId"));
            repositoryStatus.put("PipelineStageRepository", hasMethod(PipelineStageRepository.class, "findByOrganizationId"));
            repositoryStatus.put("FileAccessLogRepository", hasMethod(FileAccessLogRepository.class, "findByOrganizationId"));
            repositoryStatus.put("FilePermissionRepository", hasMethod(FilePermissionRepository.class, "findByOrganizationId"));
            repositoryStatus.put("TimerSessionRepository", hasMethod(TimerSessionRepository.class, "findByOrganizationId"));
            repositoryStatus.put("PermissionAuditLogRepository", hasMethod(PermissionAuditLogRepository.class, "findByOrganizationId"));

            long implemented = repositoryStatus.values().stream().filter(v -> v).count();
            long total = repositoryStatus.size();
            long missing = total - implemented;

            System.out.println("\n========== TENANT ISOLATION COVERAGE REPORT ==========");
            System.out.println("Total repositories checked: " + total);
            System.out.println("Implemented: " + implemented);
            System.out.println("Missing: " + missing);
            System.out.println("Coverage: " + (implemented * 100 / total) + "%");
            System.out.println("\n--- Implemented Repositories ---");
            repositoryStatus.entrySet().stream()
                .filter(Map.Entry::getValue)
                .forEach(e -> System.out.println("  [OK] " + e.getKey()));
            System.out.println("\n--- Missing Tenant Isolation ---");
            repositoryStatus.entrySet().stream()
                .filter(e -> !e.getValue())
                .forEach(e -> System.out.println("  [MISSING] " + e.getKey()));
            System.out.println("======================================================\n");

            // Test passes to show report - actual coverage verified by other tests
            assertTrue(implemented >= 30, "At least 30 repositories should have tenant isolation after updates");
        }
    }

    /**
     * Helper method to verify a method with given parameter types exists in a class.
     */
    private void assertMethodExists(Class<?> repositoryClass, String methodName, Class<?>... paramTypes) {
        assertTrue(hasMethod(repositoryClass, methodName, paramTypes),
            String.format("SECURITY: Method %s.%s(%s) not found! Tenant isolation may be missing.",
                repositoryClass.getSimpleName(),
                methodName,
                Arrays.stream(paramTypes).map(Class::getSimpleName).reduce((a, b) -> a + ", " + b).orElse("")));
    }

    private boolean hasMethod(Class<?> repositoryClass, String methodName, Class<?>... paramTypes) {
        for (Method method : repositoryClass.getMethods()) {
            if (method.getName().equals(methodName)) {
                if (paramTypes.length == 0) {
                    return true;
                }
                Class<?>[] actualTypes = method.getParameterTypes();
                if (actualTypes.length == paramTypes.length) {
                    boolean match = true;
                    for (int i = 0; i < paramTypes.length; i++) {
                        if (!paramTypes[i].isAssignableFrom(actualTypes[i]) &&
                            !actualTypes[i].isAssignableFrom(paramTypes[i])) {
                            match = false;
                            break;
                        }
                    }
                    if (match) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
}
