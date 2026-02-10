package com.bostoneo.bostoneosolutions.config;

import com.bostoneo.bostoneosolutions.utils.RequestUtils;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class ApplicationWarmupRunner {

    private final NamedParameterJdbcTemplate jdbc;
    private final BCryptPasswordEncoder passwordEncoder;
    private final ObjectMapper objectMapper;
    private final WarmupHealthIndicator warmupHealthIndicator;

    @EventListener(ApplicationReadyEvent.class)
    public void warmup() {
        long start = System.currentTimeMillis();
        log.info("Starting application warmup...");

        warmupDatabase();
        warmupBCrypt();
        warmupUserAgentAnalyzer();
        warmupJackson();

        long elapsed = System.currentTimeMillis() - start;
        log.info("Application warmup completed in {} ms", elapsed);

        warmupHealthIndicator.markWarmedUp();
    }

    private void warmupDatabase() {
        long start = System.currentTimeMillis();
        try {
            jdbc.queryForObject("SELECT 1", Collections.emptyMap(), Integer.class);
            log.info("Warmup: Database connection verified in {} ms", System.currentTimeMillis() - start);
        } catch (Exception e) {
            log.warn("Warmup: Database warmup failed (non-fatal): {}", e.getMessage());
        }
    }

    private void warmupBCrypt() {
        long start = System.currentTimeMillis();
        try {
            passwordEncoder.encode("warmup");
            log.info("Warmup: BCrypt encoder warmed up in {} ms", System.currentTimeMillis() - start);
        } catch (Exception e) {
            log.warn("Warmup: BCrypt warmup failed (non-fatal): {}", e.getMessage());
        }
    }

    private void warmupUserAgentAnalyzer() {
        long start = System.currentTimeMillis();
        try {
            RequestUtils.getDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
            log.info("Warmup: UserAgentAnalyzer warmed up in {} ms", System.currentTimeMillis() - start);
        } catch (Exception e) {
            log.warn("Warmup: UserAgentAnalyzer warmup failed (non-fatal): {}", e.getMessage());
        }
    }

    private void warmupJackson() {
        long start = System.currentTimeMillis();
        try {
            objectMapper.writeValueAsString(Map.of("warmup", true, "timestamp", System.currentTimeMillis()));
            log.info("Warmup: Jackson ObjectMapper warmed up in {} ms", System.currentTimeMillis() - start);
        } catch (Exception e) {
            log.warn("Warmup: Jackson warmup failed (non-fatal): {}", e.getMessage());
        }
    }
}
