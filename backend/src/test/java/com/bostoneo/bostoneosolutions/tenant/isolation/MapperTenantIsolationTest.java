package com.bostoneo.bostoneosolutions.tenant.isolation;

import com.bostoneo.bostoneosolutions.dto.ExpenseDTO;
import com.bostoneo.bostoneosolutions.mapper.ExpenseMapper;
import com.bostoneo.bostoneosolutions.model.*;
import com.bostoneo.bostoneosolutions.multitenancy.TenantService;
import com.bostoneo.bostoneosolutions.repository.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Tests for ExpenseMapper tenant isolation.
 * Verifies that the mapper uses tenant-filtered repository lookups.
 *
 * SECURITY: Critical - ExpenseMapper must use findByIdAndOrganizationId
 * for all entity lookups to prevent cross-tenant data references.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ExpenseMapper Tenant Isolation Tests")
class MapperTenantIsolationTest {

    private static final Long ORG_1 = 1L;
    private static final Long ORG_2 = 2L;

    @Mock
    private ExpenseCategoryRepository categoryRepository;

    @Mock
    private ClientRepository clientRepository;

    @Mock
    private VendorRepository vendorRepository;

    @Mock
    private InvoiceRepository invoiceRepository;

    @Mock
    private LegalCaseRepository legalCaseRepository;

    @Mock
    private ReceiptRepository receiptRepository;

    @Mock
    private TenantService tenantService;

    @InjectMocks
    private ExpenseMapper expenseMapper;

    @BeforeEach
    void setUp() {
        // Set up tenant context to return ORG_1
        when(tenantService.getCurrentOrganizationId()).thenReturn(Optional.of(ORG_1));
    }

    // ==================== Tenant-Filtered Lookup Tests ====================

    @Nested
    @DisplayName("Category Lookup Tenant Isolation")
    class CategoryLookupTests {

        @Test
        @DisplayName("toEntity should use findByIdAndOrganizationId for category")
        void testCategoryLookupUsesTenantFilter() {
            ExpenseDTO dto = createExpenseDTO();
            dto.setCategoryId(100L);

            ExpenseCategory category = new ExpenseCategory();
            category.setId(100L);
            category.setName("Travel");
            category.setOrganizationId(ORG_1);

            when(categoryRepository.findByIdAndOrganizationId(100L, ORG_1))
                .thenReturn(Optional.of(category));

            Expense result = expenseMapper.toEntity(dto);

            // Verify tenant-filtered method was called
            verify(categoryRepository).findByIdAndOrganizationId(100L, ORG_1);
            // Verify non-filtered method was NOT called
            verify(categoryRepository, never()).findById(anyLong());

            assertNotNull(result.getCategory());
            assertEquals("Travel", result.getCategory().getName());
        }

        @Test
        @DisplayName("toEntity should not set category if not found in org")
        void testCategoryNotFoundInOrg() {
            ExpenseDTO dto = createExpenseDTO();
            dto.setCategoryId(100L);

            // Category exists but not in this org
            when(categoryRepository.findByIdAndOrganizationId(100L, ORG_1))
                .thenReturn(Optional.empty());

            Expense result = expenseMapper.toEntity(dto);

            assertNull(result.getCategory());
        }
    }

    @Nested
    @DisplayName("Vendor Lookup Tenant Isolation")
    class VendorLookupTests {

        @Test
        @DisplayName("toEntity should use findByIdAndOrganizationId for vendor")
        void testVendorLookupUsesTenantFilter() {
            ExpenseDTO dto = createExpenseDTO();
            dto.setVendorId(200L);

            Vendor vendor = new Vendor();
            vendor.setId(200L);
            vendor.setName("Acme Corp");
            vendor.setOrganizationId(ORG_1);

            when(vendorRepository.findByIdAndOrganizationId(200L, ORG_1))
                .thenReturn(Optional.of(vendor));

            Expense result = expenseMapper.toEntity(dto);

            verify(vendorRepository).findByIdAndOrganizationId(200L, ORG_1);
            verify(vendorRepository, never()).findById(anyLong());

            assertNotNull(result.getVendor());
            assertEquals("Acme Corp", result.getVendor().getName());
        }
    }

    @Nested
    @DisplayName("Client Lookup Tenant Isolation")
    class ClientLookupTests {

        @Test
        @DisplayName("toEntity should use findByIdAndOrganizationId for client")
        void testClientLookupUsesTenantFilter() {
            ExpenseDTO dto = createExpenseDTO();
            dto.setClientId(300L);

            Client client = mock(Client.class);

            when(clientRepository.findByIdAndOrganizationId(300L, ORG_1))
                .thenReturn(Optional.of(client));

            Expense result = expenseMapper.toEntity(dto);

            verify(clientRepository).findByIdAndOrganizationId(300L, ORG_1);
            verify(clientRepository, never()).findById(anyLong());

            assertNotNull(result.getClient());
        }

        @Test
        @DisplayName("Cross-tenant client reference should be blocked")
        void testCrossTenantClientBlocked() {
            ExpenseDTO dto = createExpenseDTO();
            dto.setClientId(300L); // Client from ORG_2

            // Client not found in ORG_1
            when(clientRepository.findByIdAndOrganizationId(300L, ORG_1))
                .thenReturn(Optional.empty());

            Expense result = expenseMapper.toEntity(dto);

            // Client should not be set
            assertNull(result.getClient());
        }
    }

    @Nested
    @DisplayName("Invoice Lookup Tenant Isolation")
    class InvoiceLookupTests {

        @Test
        @DisplayName("toEntity should use findByIdAndOrganizationId for invoice")
        void testInvoiceLookupUsesTenantFilter() {
            ExpenseDTO dto = createExpenseDTO();
            dto.setInvoiceId(400L);

            Invoice invoice = new Invoice();
            invoice.setId(400L);
            invoice.setOrganizationId(ORG_1);

            when(invoiceRepository.findByIdAndOrganizationId(400L, ORG_1))
                .thenReturn(Optional.of(invoice));

            Expense result = expenseMapper.toEntity(dto);

            verify(invoiceRepository).findByIdAndOrganizationId(400L, ORG_1);
            verify(invoiceRepository, never()).findById(anyLong());

            assertNotNull(result.getInvoice());
        }
    }

    @Nested
    @DisplayName("LegalCase Lookup Tenant Isolation")
    class LegalCaseLookupTests {

        @Test
        @DisplayName("toEntity should use findByIdAndOrganizationId for legalCase")
        void testLegalCaseLookupUsesTenantFilter() {
            ExpenseDTO dto = createExpenseDTO();
            dto.setLegalCaseId(500L);

            LegalCase legalCase = new LegalCase();
            legalCase.setId(500L);
            legalCase.setOrganizationId(ORG_1);

            when(legalCaseRepository.findByIdAndOrganizationId(500L, ORG_1))
                .thenReturn(Optional.of(legalCase));

            Expense result = expenseMapper.toEntity(dto);

            verify(legalCaseRepository).findByIdAndOrganizationId(500L, ORG_1);
            verify(legalCaseRepository, never()).findById(anyLong());

            assertNotNull(result.getLegalCase());
        }
    }

    @Nested
    @DisplayName("Receipt Lookup Tenant Isolation")
    class ReceiptLookupTests {

        @Test
        @DisplayName("toEntity should use findByIdAndOrganizationId for receipt")
        void testReceiptLookupUsesTenantFilter() {
            ExpenseDTO dto = createExpenseDTO();
            dto.setReceiptId(600L);

            Receipt receipt = new Receipt();
            receipt.setId(600L);
            receipt.setOrganizationId(ORG_1);

            when(receiptRepository.findByIdAndOrganizationId(600L, ORG_1))
                .thenReturn(Optional.of(receipt));

            Expense result = expenseMapper.toEntity(dto);

            verify(receiptRepository).findByIdAndOrganizationId(600L, ORG_1);
            verify(receiptRepository, never()).findById(anyLong());

            assertNotNull(result.getReceipt());
        }
    }

    // ==================== Organization Context Tests ====================

    @Nested
    @DisplayName("Organization Context Handling")
    class OrganizationContextTests {

        @Test
        @DisplayName("toEntity should throw when no organization context")
        void testNoOrganizationContextThrows() {
            when(tenantService.getCurrentOrganizationId()).thenReturn(Optional.empty());

            ExpenseDTO dto = createExpenseDTO();

            assertThrows(RuntimeException.class, () -> expenseMapper.toEntity(dto),
                "Should throw when organization context is missing");
        }

        @Test
        @DisplayName("toEntity should use org from TenantService, not from DTO")
        void testUsesOrgFromTenantService() {
            ExpenseDTO dto = createExpenseDTO();
            dto.setOrganizationId(ORG_2); // DTO has different org

            Expense result = expenseMapper.toEntity(dto);

            // Should use ORG_1 from TenantService, not ORG_2 from DTO
            assertEquals(ORG_1, result.getOrganizationId());
        }
    }

    // ==================== Helper Methods ====================

    private ExpenseDTO createExpenseDTO() {
        ExpenseDTO dto = new ExpenseDTO();
        dto.setId(1L);
        dto.setOrganizationId(ORG_1);
        dto.setAmount(new BigDecimal("100.00"));
        dto.setCurrency("USD");
        dto.setDescription("Test Expense");
        return dto;
    }
}
