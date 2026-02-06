package com.bostoneo.bostoneosolutions;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.data.web.config.EnableSpringDataWebSupport;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import jakarta.annotation.PostConstruct;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.TimeZone;

import lombok.extern.slf4j.Slf4j;


@SpringBootApplication//(exclude = { SecurityAutoConfiguration.class })
@EnableScheduling
@EnableAsync
@EnableSpringDataWebSupport(pageSerializationMode = EnableSpringDataWebSupport.PageSerializationMode.VIA_DTO)
@Slf4j
public class BostoneosolutionsApplication {
	private static final int STRENGTH = 12;

	@Value("${app.cors.allowed-origins}")
	private String allowedOrigins;
	
	@PostConstruct
	public void init() {
		// Set default timezone
		TimeZone.setDefault(TimeZone.getTimeZone("America/New_York"));
		
		// Log system time information for debugging
		LocalDateTime now = LocalDateTime.now();
		ZonedDateTime zonedNow = ZonedDateTime.now();
		
		log.info("🕐 System timezone: {}", TimeZone.getDefault().getID());
		log.info("🕐 Current LocalDateTime: {} (Year: {})", now, now.getYear());
		log.info("🕐 Current ZonedDateTime: {}", zonedNow);
		log.info("🕐 Available zones: America/New_York, UTC, etc.");
		
		// Log system time for verification
		log.info("✅ System clock initialized - Current year: {}", now.getYear());
	}
	
	public static void main(String[] args) {
		SpringApplication.run(BostoneosolutionsApplication.class, args);
	}



	@Bean
	public BCryptPasswordEncoder passwordEncoder() {
		return new BCryptPasswordEncoder(STRENGTH);
	}

	@Bean
	public CorsFilter corsFilter() {
		UrlBasedCorsConfigurationSource urlBasedCorsConfigurationSource = new UrlBasedCorsConfigurationSource();
		CorsConfiguration corsConfiguration = new CorsConfiguration();
		corsConfiguration.setAllowCredentials(true);
		corsConfiguration.setAllowedOrigins(Arrays.asList(allowedOrigins.split(",")));
		corsConfiguration.setAllowedHeaders(Arrays.asList("Origin", "Access-Control-Allow-Origin", "Content-Type",
				"Accept", "Jwt-Token", "Authorization", "Origin", "Accept", "X-Requested-With",
				"Access-Control-Request-Method", "Access-Control-Request-Headers", "Cache-Control"));
		corsConfiguration.setExposedHeaders(Arrays.asList("Origin", "Content-Type", "Accept", "Jwt-Token", "Authorization",
				"Access-Control-Allow-Origin", "Access-Control-Allow-Origin", "Access-Control-Allow-Credentials", "File-Name"));
		corsConfiguration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
		urlBasedCorsConfigurationSource.registerCorsConfiguration("/**", corsConfiguration);
		return new CorsFilter(urlBasedCorsConfigurationSource);
	}
}

