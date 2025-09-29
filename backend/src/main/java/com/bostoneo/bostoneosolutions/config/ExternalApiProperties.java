package com.bostoneo.bostoneosolutions.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.HashMap;
import java.util.Map;

@Configuration
@ConfigurationProperties(prefix = "legal.research")
@Data
public class ExternalApiProperties {

    private CourtListener courtlistener = new CourtListener();
    private FederalRegister federalRegister = new FederalRegister();
    private Massachusetts massachusetts = new Massachusetts();

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

    @Data
    public static class Massachusetts {
        private String baseUrl = "https://www.mass.gov";
        private Map<String, String> mainPages = new HashMap<>();
        private Map<String, String> documents = new HashMap<>();
        private MaLegislature malegislature = new MaLegislature();

        public Massachusetts() {
            // Initialize main pages
            mainPages.put("rulesAndStandards", "/court-rules-guidelines-and-standards");
            mainPages.put("rulesAndOrders", "/guides/massachusetts-rules-of-court-and-standing-orders");
            mainPages.put("courtGuidelines", "/lists/court-guidelines");

            // Initialize document URLs
            documents.put("criminal-procedure", "/doc/massachusetts-rules-of-criminal-procedure/download");
            documents.put("appellate-procedure", "/doc/massachusetts-rules-of-appellate-procedure/download");
            documents.put("civil-procedure", "/doc/massachusetts-rules-of-civil-procedure/download");
            documents.put("domestic-relations", "/doc/massachusetts-rules-of-domestic-relations-procedure/download");
            documents.put("probate-procedure", "/doc/massachusetts-uniform-probate-code/download");
            documents.put("sentencing-guidelines", "/doc/advisory-sentencing-guidelines/download");
            documents.put("evidence-guide", "/doc/massachusetts-guide-to-evidence/download");
            documents.put("professional-conduct", "/doc/rules-of-professional-conduct/download");
        }
    }

    @Data
    public static class MaLegislature {
        private String baseUrl = "https://malegislature.gov";
        private String generalLaws = "/Laws/GeneralLaws";
        private String searchUrl = "/Search/FindMyLegislator";
    }
}