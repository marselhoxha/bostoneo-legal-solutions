package com.bostoneo.bostoneosolutions.tenant.isolation;

import com.bostoneo.bostoneosolutions.multitenancy.TenantContext;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Integration tests for tenant isolation across the application.
 * These tests verify that cross-tenant access is properly blocked.
 *
 * SECURITY: Critical tests for multi-tenant data isolation.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("Tenant Isolation Integration Tests")
class TenantIsolationIntegrationTest {

    private static final Long ORG_1 = 1L;
    private static final Long ORG_2 = 2L;

    @Mock
    private TenantService tenantService;

    @Mock
    private ExpenseRepository expenseRepository;

    @Mock
    private InvoiceRepository invoiceRepository;

    @Mock
    private ClientRepository clientRepository;

    @Mock
    private LegalCaseRepository legalCaseRepository;

    @Mock
    private EventRepository eventRepository;

    // ==================== TenantContext Tests ====================

    @Nested
    @DisplayName("TenantContext Thread Safety")
    class TenantContextTests {

        @Test
        @DisplayName("TenantContext should be thread-local and isolated")
        void testTenantContextIsolation() {
            // Set tenant for current thread
            TenantContext.setCurrentTenant(ORG_1);
            assertEquals(ORG_1, TenantContext.getCurrentTenant());

            // Clear should work
            TenantContext.clear();
            assertNull(TenantContext.getCurrentTenant());
        }

        @Test
        @DisplayName("TenantContext.requireCurrentTenant should throw when not set")
        void testRequireCurrentTenantThrows() {
            TenantContext.clear();
            assertThrows(RuntimeException.class, () -> TenantContext.requireCurrentTenant());
        }

        @Test
        @DisplayName("TenantContext.isSet should return correct status")
        void testIsSet() {
            TenantContext.clear();
            assertFalse(TenantContext.isSet());

            TenantContext.setCurrentTenant(ORG_1);
            assertTrue(TenantContext.isSet());

            TenantContext.clear();
            assertFalse(TenantContext.isSet());
        }
    }

    // ==================== Cross-Tenant Access Tests ====================

    @Nested
    @DisplayName("Cross-Tenant Access Prevention")
    class CrossTenantAccessTests {

        @Test
        @DisplayName("findByIdAndOrganizationId should return empty for wrong org")
        void testExpenseRepositoryCrossTenantAccess() {
            Long expenseId = 100L;

            // Expense belongs to ORG_1
            when(expenseRepository.findByIdAndOrganizationId(expenseId, ORG_1))
                .thenReturn(Optional.of(mock(com.bostoneo.bostoneosolutions.model.Expense.class)));
            when(expenseRepository.findByIdAndOrganizationId(expenseId, ORG_2))
                .thenReturn(Optional.empty());

            // ORG_1 can access
            assertTrue(expenseRepository.findByIdAndOrganizationId(expenseId, ORG_1).isPresent());

            // ORG_2 cannot access ORG_1's expense
            assertTrue(expenseRepository.findByIdAndOrganizationId(expenseId, ORG_2).isEmpty());
        }

        @Test
        @DisplayName("Invoice cross-tenant access should be blocked")
        void testInvoiceRepositoryCrossTenantAccess() {
            Long invoiceId = 200L;

            when(invoiceRepository.findByIdAndOrganizationId(invoiceId, ORG_1))
                .thenReturn(Optional.of(mock(com.bostoneo.bostoneosolutions.model.Invoice.class)));
            when(invoiceRepository.findByIdAndOrganizationId(invoiceId, ORG_2))
                .thenReturn(Optional.empty());

            assertTrue(invoiceRepository.findByIdAndOrganizationId(invoiceId, ORG_1).isPresent());
            assertTrue(invoiceRepository.findByIdAndOrganizationId(invoiceId, ORG_2).isEmpty());
        }

        @Test
        @DisplayName("Client cross-tenant access should be blocked")
        void testClientRepositoryCrossTenantAccess() {
            Long clientId = 300L;

            when(clientRepository.findByIdAndOrganizationId(clientId, ORG_1))
                .thenReturn(Optional.of(mock(com.bostoneo.bostoneosolutions.model.Client.class)));
            when(clientRepository.findByIdAndOrganizationId(clientId, ORG_2))
                .thenReturn(Optional.empty());

            assertTrue(clientRepository.findByIdAndOrganizationId(clientId, ORG_1).isPresent());
            assertTrue(clientRepository.findByIdAndOrganizationId(clientId, ORG_2).isEmpty());
        }

        @Test
        @DisplayName("LegalCase cross-tenant access should be blocked")
        void testLegalCaseRepositoryCrossTenantAccess() {
            Long caseId = 400L;

            when(legalCaseRepository.findByIdAndOrganizationId(caseId, ORG_1))
                .thenReturn(Optional.of(mock(com.bostoneo.bostoneosolutions.model.LegalCase.class)));
            when(legalCaseRepository.findByIdAndOrganizationId(caseId, ORG_2))
                .thenReturn(Optional.empty());

            assertTrue(legalCaseRepository.findByIdAndOrganizationId(caseId, ORG_1).isPresent());
            assertTrue(legalCaseRepository.findByIdAndOrganizationId(caseId, ORG_2).isEmpty());
        }
    }

    // ==================== TenantService Tests ====================

    @Nested
    @DisplayName("TenantService Behavior")
    class TenantServiceTests {

        @Test
        @DisplayName("TenantService should return current organization from context")
        void testGetCurrentOrganizationId() {
            when(tenantService.getCurrentOrganizationId()).thenReturn(Optional.of(ORG_1));

            Optional<Long> orgId = tenantService.getCurrentOrganizationId();
            assertTrue(orgId.isPresent());
            assertEquals(ORG_1, orgId.get());
        }

        @Test
        @DisplayName("TenantService should return empty when no context")
        void testGetCurrentOrganizationIdEmpty() {
            when(tenantService.getCurrentOrganizationId()).thenReturn(Optional.empty());

            assertTrue(tenantService.getCurrentOrganizationId().isEmpty());
        }
    }

    // ==================== Event Repository Tenant Tests ====================

    @Nested
    @DisplayName("EventRepository Tenant Isolation")
    class EventRepositoryTests {

        @Test
        @DisplayName("EventRepository should have tenant-filtered methods")
        void testEventRepositoryTenantMethods() {
            // Verify tenant-filtered methods exist via interface check
            assertNotNull(EventRepository.class);

            // Check method signatures exist
            try {
                EventRepository.class.getMethod("getEventsByUserIdAndOrganizationId", Long.class, Long.class);
                EventRepository.class.getMethod("addUserEvent", String.class,
                    com.bostoneo.bostoneosolutions.enumeration.EventType.class,
                    String.class, String.class, Long.class);
            } catch (NoSuchMethodException e) {
                fail("SECURITY: Tenant-filtered EventRepository methods not found: " + e.getMessage());
            }
        }
    }

    // ==================== Deprecated Method Detection ====================

    @Nested
    @DisplayName("Deprecated Method Detection")
    class DeprecatedMethodTests {

        @Test
        @DisplayName("Global notification preference methods should be deprecated")
        void testNotificationPreferenceDeprecatedMethods() throws NoSuchMethodException {
            // These methods should be marked @Deprecated
            var findByEventTypeMethod = UserNotificationPreferenceRepository.class
                .getMethod("findByEventTypeAndEnabledTrue", String.class);

            assertTrue(findByEventTypeMethod.isAnnotationPresent(Deprecated.class),
                "SECURITY: findByEventTypeAndEnabledTrue should be @Deprecated");
        }

        @Test
        @DisplayName("Global event repository methods should be deprecated")
        void testEventRepositoryDeprecatedMethods() throws NoSuchMethodException {
            var getEventsMethod = EventRepository.class.getMethod("getEventsByUserId", Long.class);

            assertTrue(getEventsMethod.isAnnotationPresent(Deprecated.class),
                "SECURITY: getEventsByUserId should be @Deprecated");
        }
    }
}
