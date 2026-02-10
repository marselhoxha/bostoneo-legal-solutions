package com.bostoneo.bostoneosolutions.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class WarmupHealthIndicator implements HealthIndicator {

    private volatile boolean warmedUp = false;

    public void markWarmedUp() {
        this.warmedUp = true;
        log.info("Warmup health indicator: application is ready for traffic");
    }

    @Override
    public Health health() {
        if (warmedUp) {
            return Health.up().withDetail("warmup", "completed").build();
        }
        return Health.down().withDetail("warmup", "in-progress").build();
    }
}
