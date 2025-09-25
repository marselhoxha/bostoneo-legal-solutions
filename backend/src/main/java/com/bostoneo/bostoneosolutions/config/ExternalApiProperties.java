package com.bostoneo.bostoneosolutions.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "legal.research")
@Data
public class ExternalApiProperties {

    private CourtListener courtlistener = new CourtListener();
    private FederalRegister federalRegister = new FederalRegister();

    @Data
    public static class CourtListener {
        private String apiKey;
        private String baseUrl = "https://www.courtlistener.com/api/rest/v3/";
        private int timeout = 30000;
        private int rateLimit = 100;
    }


    @Data
    public static class FederalRegister {
        private String baseUrl = "https://www.federalregister.gov/api/v1/";
        private int timeout = 30000;
        private int rateLimit = 1000;
    }
}