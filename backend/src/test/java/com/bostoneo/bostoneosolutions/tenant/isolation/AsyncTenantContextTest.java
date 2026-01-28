package com.bostoneo.bostoneosolutions.tenant.isolation;

import com.bostoneo.bostoneosolutions.multitenancy.TenantAwareTaskDecorator;
import com.bostoneo.bostoneosolutions.multitenancy.TenantContext;
import org.junit.jupiter.api.*;
import org.springframework.core.task.TaskDecorator;

import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for async tenant context propagation.
 * Verifies that TenantAwareTaskDecorator properly propagates tenant context to async threads.
 *
 * SECURITY: Critical - tenant context must be properly propagated to async operations
 * to prevent data leakage across tenants.
 */
@DisplayName("Async Tenant Context Propagation Tests")
class AsyncTenantContextTest {

    private static final Long ORG_1 = 1L;
    private static final Long ORG_2 = 2L;

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    // ==================== TenantAwareTaskDecorator Tests ====================

    @Nested
    @DisplayName("TenantAwareTaskDecorator")
    class TaskDecoratorTests {

        @Test
        @DisplayName("Should propagate tenant context to decorated runnable")
        void testTenantContextPropagation() throws Exception {
            TenantAwareTaskDecorator decorator = new TenantAwareTaskDecorator();
            AtomicReference<Long> capturedOrgId = new AtomicReference<>();

            // Set tenant context in main thread
            TenantContext.setCurrentTenant(ORG_1);

            // Create decorated runnable
            Runnable decorated = decorator.decorate(() -> {
                capturedOrgId.set(TenantContext.getCurrentTenant());
            });

            // Run in separate thread
            ExecutorService executor = Executors.newSingleThreadExecutor();
            Future<?> future = executor.submit(decorated);
            future.get(5, TimeUnit.SECONDS);
            executor.shutdown();

            // Verify tenant context was propagated
            assertEquals(ORG_1, capturedOrgId.get());
        }

        @Test
        @DisplayName("Should clear tenant context after task completes")
        void testTenantContextCleared() throws Exception {
            TenantAwareTaskDecorator decorator = new TenantAwareTaskDecorator();
            AtomicReference<Long> afterTaskOrgId = new AtomicReference<>();

            TenantContext.setCurrentTenant(ORG_1);

            Runnable decorated = decorator.decorate(() -> {
                // Task runs with tenant context
                assertEquals(ORG_1, TenantContext.getCurrentTenant());
            });

            ExecutorService executor = Executors.newSingleThreadExecutor();

            // Run the decorated task
            Future<?> future1 = executor.submit(decorated);
            future1.get(5, TimeUnit.SECONDS);

            // Run another task in same thread to check context was cleared
            Future<?> future2 = executor.submit(() -> {
                afterTaskOrgId.set(TenantContext.getCurrentTenant());
            });
            future2.get(5, TimeUnit.SECONDS);

            executor.shutdown();

            // Context should be cleared after decorated task completes
            assertNull(afterTaskOrgId.get(), "Tenant context should be cleared after task");
        }

        @Test
        @DisplayName("Should handle null tenant context gracefully")
        void testNullTenantContext() throws Exception {
            TenantAwareTaskDecorator decorator = new TenantAwareTaskDecorator();
            AtomicReference<Long> capturedOrgId = new AtomicReference<>(999L); // Set to non-null initially

            // Don't set tenant context (should be null)
            TenantContext.clear();

            Runnable decorated = decorator.decorate(() -> {
                capturedOrgId.set(TenantContext.getCurrentTenant());
            });

            ExecutorService executor = Executors.newSingleThreadExecutor();
            Future<?> future = executor.submit(decorated);
            future.get(5, TimeUnit.SECONDS);
            executor.shutdown();

            // Should have propagated null context
            assertNull(capturedOrgId.get());
        }

        @Test
        @DisplayName("Should isolate tenant context between different tasks")
        void testTenantContextIsolation() throws Exception {
            TenantAwareTaskDecorator decorator = new TenantAwareTaskDecorator();
            AtomicReference<Long> task1OrgId = new AtomicReference<>();
            AtomicReference<Long> task2OrgId = new AtomicReference<>();

            // Create two tasks with different tenant contexts
            TenantContext.setCurrentTenant(ORG_1);
            Runnable task1 = decorator.decorate(() -> {
                task1OrgId.set(TenantContext.getCurrentTenant());
                // Simulate some work
                try { Thread.sleep(50); } catch (InterruptedException e) {}
            });

            TenantContext.setCurrentTenant(ORG_2);
            Runnable task2 = decorator.decorate(() -> {
                task2OrgId.set(TenantContext.getCurrentTenant());
            });

            // Run both tasks
            ExecutorService executor = Executors.newFixedThreadPool(2);
            Future<?> future1 = executor.submit(task1);
            Future<?> future2 = executor.submit(task2);

            future1.get(5, TimeUnit.SECONDS);
            future2.get(5, TimeUnit.SECONDS);
            executor.shutdown();

            // Each task should have its own tenant context
            assertEquals(ORG_1, task1OrgId.get());
            assertEquals(ORG_2, task2OrgId.get());
        }
    }

    // ==================== CompletableFuture Context Tests ====================

    @Nested
    @DisplayName("CompletableFuture Tenant Context")
    class CompletableFutureTests {

        @Test
        @DisplayName("CompletableFuture with executor should maintain tenant context")
        void testCompletableFutureWithExecutor() throws Exception {
            TenantAwareTaskDecorator decorator = new TenantAwareTaskDecorator();

            // Create executor with decorator
            ThreadPoolExecutor executor = new ThreadPoolExecutor(
                1, 1, 0L, TimeUnit.MILLISECONDS, new LinkedBlockingQueue<>()
            );
            executor.setThreadFactory(r -> new Thread(r, "TenantAware-test"));

            TenantContext.setCurrentTenant(ORG_1);

            // Capture the current tenant before running async
            Long capturedTenant = TenantContext.getCurrentTenant();

            AtomicReference<Long> asyncTenant = new AtomicReference<>();

            // Use decorated runnable with CompletableFuture
            Runnable decorated = decorator.decorate(() -> {
                asyncTenant.set(TenantContext.getCurrentTenant());
            });

            CompletableFuture.runAsync(decorated, executor).get(5, TimeUnit.SECONDS);
            executor.shutdown();

            assertEquals(capturedTenant, asyncTenant.get());
        }
    }

    // ==================== Edge Cases ====================

    @Nested
    @DisplayName("Edge Cases")
    class EdgeCaseTests {

        @Test
        @DisplayName("Should handle exception in decorated task")
        void testExceptionHandling() {
            TenantAwareTaskDecorator decorator = new TenantAwareTaskDecorator();
            AtomicReference<Long> afterExceptionOrgId = new AtomicReference<>();

            TenantContext.setCurrentTenant(ORG_1);

            Runnable decorated = decorator.decorate(() -> {
                throw new RuntimeException("Test exception");
            });

            ExecutorService executor = Executors.newSingleThreadExecutor();

            // Task throws exception
            Future<?> future1 = executor.submit(decorated);
            assertThrows(ExecutionException.class, () -> future1.get(5, TimeUnit.SECONDS));

            // Context should still be cleared even after exception
            Future<?> future2 = executor.submit(() -> {
                afterExceptionOrgId.set(TenantContext.getCurrentTenant());
            });
            try {
                future2.get(5, TimeUnit.SECONDS);
            } catch (Exception ignored) {}

            executor.shutdown();

            // Context should be cleared after exception
            assertNull(afterExceptionOrgId.get(), "Tenant context should be cleared even after exception");
        }
    }
}
