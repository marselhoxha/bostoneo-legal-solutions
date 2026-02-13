package com.bostoneo.bostoneosolutions.config;

import jakarta.annotation.PostConstruct;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.reactive.function.client.WebClient;
import io.netty.channel.ChannelOption;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import reactor.netty.http.client.HttpClient;
import reactor.netty.resources.ConnectionProvider;
import java.time.Duration;

@Configuration
@Slf4j
@Getter
public class AIConfig {

    @Autowired
    private Environment env;

    @Value("${ai.anthropic.api-key:#{null}}")
    private String anthropicApiKey;

    @Value("${ai.anthropic.base-url:https://api.anthropic.com}")
    private String anthropicBaseUrl;


    @PostConstruct
    public void init() {
        log.info("=== INITIALIZING AI CONFIG ===");
        log.info("Active Spring Profiles: {}", String.join(", ", env.getActiveProfiles()));

        // Try to get API key from multiple sources
        if (anthropicApiKey == null || anthropicApiKey.isEmpty()) {
            anthropicApiKey = env.getProperty("ai.anthropic.api-key");
            if (anthropicApiKey == null || anthropicApiKey.isEmpty()) {
                anthropicApiKey = System.getProperty("ai.anthropic.api-key");
            }
            if (anthropicApiKey == null || anthropicApiKey.isEmpty()) {
                anthropicApiKey = System.getenv("ANTHROPIC_API_KEY");
            }
        }

        if (anthropicApiKey == null || anthropicApiKey.isEmpty()) {
            log.error("ANTHROPIC_API_KEY is not configured. AI features will be disabled.");
            log.error("Set the ANTHROPIC_API_KEY environment variable to enable AI features.");
        } else {
            // SECURITY: Never log API key contents, only confirm presence
            log.info("Anthropic API key configured successfully ({} chars)", anthropicApiKey.length());
        }
    }

    @Bean
    public WebClient anthropicWebClient() {
        log.info("Creating Anthropic WebClient (base URL: {})", anthropicBaseUrl);

        ConnectionProvider connectionProvider = ConnectionProvider.builder("anthropic-pool")
                .maxConnections(50)
                .maxIdleTime(Duration.ofMinutes(5))
                .maxLifeTime(Duration.ofMinutes(30))
                .pendingAcquireTimeout(Duration.ofSeconds(60))
                .evictInBackground(Duration.ofMinutes(2))
                .build();

        HttpClient httpClient = HttpClient.create(connectionProvider)
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 30000)
                .responseTimeout(Duration.ofMinutes(10))
                .option(ChannelOption.SO_KEEPALIVE, true)
                .option(ChannelOption.TCP_NODELAY, true);

        // COMPLIANCE: ZDR (Zero Data Retention) enterprise agreement is being pursued with Anthropic.
        // These headers help track our requests and signal professional/legal use.
        // Once ZDR is active, Anthropic will not retain any prompt or response data.
        return WebClient.builder()
                .baseUrl(anthropicBaseUrl)
                .defaultHeader("Content-Type", "application/json")
                .defaultHeader("anthropic-version", "2023-06-01")
                .defaultHeader("X-Request-Source", "bostoneo-legal")
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .build();
    }

    public String getApiKey() {
        if (anthropicApiKey == null || anthropicApiKey.isEmpty()) {
            throw new IllegalStateException(
                "ANTHROPIC_API_KEY is not configured. Set the environment variable to enable AI features.");
        }
        return anthropicApiKey;
    }
}
