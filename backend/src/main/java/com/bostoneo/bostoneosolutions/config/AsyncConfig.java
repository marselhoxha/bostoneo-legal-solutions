package com.bostoneo.bostoneosolutions.config;

import com.bostoneo.bostoneosolutions.multitenancy.TenantAwareTaskDecorator;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.task.TaskExecutor;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * Configuration for async task execution.
 * SECURITY: Uses TenantAwareTaskDecorator to propagate tenant context
 * to async threads, preventing cross-tenant data access in @Async methods.
 */
@Configuration
@EnableAsync
public class AsyncConfig {

    @Bean(name = "taskExecutor")
    public TaskExecutor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(5);
        executor.setMaxPoolSize(10);
        executor.setQueueCapacity(25);
        executor.setThreadNamePrefix("TenantAware-");

        // SECURITY: Propagate tenant context to async threads
        executor.setTaskDecorator(new TenantAwareTaskDecorator());

        executor.initialize();
        return executor;
    }
}
