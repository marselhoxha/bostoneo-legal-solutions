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
        log.info("Default Spring Profiles: {}", String.join(", ", env.getDefaultProfiles()));
        
        // Try to get API key from multiple sources
        if (anthropicApiKey == null || anthropicApiKey.isEmpty()) {
            // Try from environment variable
            anthropicApiKey = env.getProperty("ai.anthropic.api-key");
            if (anthropicApiKey == null || anthropicApiKey.isEmpty()) {
                // Try from system property
                anthropicApiKey = System.getProperty("ai.anthropic.api-key");
            }
            if (anthropicApiKey == null || anthropicApiKey.isEmpty()) {
                // Try from environment variable with different naming
                anthropicApiKey = System.getenv("ANTHROPIC_API_KEY");
            }
        }
        
        // Check final status
        if (anthropicApiKey == null || anthropicApiKey.isEmpty()) {
            log.warn("API Key is not configured. AI features will not work.");
            log.warn("Please set ai.anthropic.api-key in application-local.properties or as environment variable ANTHROPIC_API_KEY");
            // Don't throw exception to allow app to start
        } else {
            log.info("API Key configured successfully (" + anthropicApiKey.length() + " chars)");
            log.info("API Key preview: " + anthropicApiKey.substring(0, Math.min(20, anthropicApiKey.length())) + "...");
        }
    }

    @Bean
    public WebClient anthropicWebClient() {
        log.info("=== CREATING ANTHROPIC WEBCLIENT ===");
        log.info("Base URL: {}", anthropicBaseUrl);

        // Configure HTTP client with timeouts for agentic mode
        // Use only responseTimeout - simpler and avoids conflicts with read/write handlers
        HttpClient httpClient = HttpClient.create()
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 30000) // 30 seconds to connect
                .responseTimeout(Duration.ofMinutes(10)); // 10 minutes max for agentic mode with multiple tool calls

        log.info("WebClient configured with timeouts: connect=30s, response=600s");

        // Don't set API key here - we'll inject it per request
        return WebClient.builder()
                .baseUrl(anthropicBaseUrl)
                .defaultHeader("Content-Type", "application/json")
                .defaultHeader("anthropic-version", "2023-06-01")
                .clientConnector(new ReactorClientHttpConnector(httpClient))
                .build();
    }
    
    public String getApiKey() {
        // Return the API key from configuration
        if (anthropicApiKey == null || anthropicApiKey.isEmpty()) {
            log.error("AI API Key is not configured. Please set ai.anthropic.api-key in your configuration.");
            throw new IllegalStateException("AI API Key is not configured. Please set ai.anthropic.api-key in your configuration.");
        }
        log.debug("getApiKey() returning configured key");
        return anthropicApiKey;
    }
}