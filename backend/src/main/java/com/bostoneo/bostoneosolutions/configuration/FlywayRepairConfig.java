package com.bostoneo.bostoneosolutions.configuration;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Auto-repair Flyway before running migrations.
 * Cleans up FAILED migration entries from previous deployment crashes,
 * allowing corrected migrations to be re-applied.
 */
@Configuration
@Slf4j
public class FlywayRepairConfig {

    @Bean
    public FlywayMigrationStrategy flywayMigrationStrategy() {
        return flyway -> {
            log.info("Running Flyway repair before migration...");
            flyway.repair();
            log.info("Flyway repair complete. Running migrations...");
            flyway.migrate();
        };
    }
}
