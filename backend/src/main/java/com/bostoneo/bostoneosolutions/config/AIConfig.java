package com.bostoneo.bostoneosolutions.config;

import jakarta.annotation.PostConstruct;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.http.apache.ApacheHttpClient;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeAsyncClient;
import software.amazon.awssdk.services.s3.S3Client;

import com.bostoneo.bostoneosolutions.configuration.FileStorageConfiguration;
import java.time.Duration;

@Configuration
@Slf4j
@Getter
public class AIConfig {

    @Value("${ai.bedrock.region:us-east-1}")
    private String bedrockRegion;

    @Value("${ai.bedrock.model-id.opus:us.anthropic.claude-opus-4-6-v1}")
    private String opusModelId;

    @Value("${ai.bedrock.model-id.sonnet:us.anthropic.claude-sonnet-4-6}")
    private String sonnetModelId;

    @Value("${ai.bedrock.model-id.haiku:us.anthropic.claude-haiku-4-5-20251001-v1:0}")
    private String haikuModelId;

    @PostConstruct
    public void init() {
        log.info("AI Config initialized: region={}", bedrockRegion);
        log.debug("Opus={}, Sonnet={}, Haiku={}", opusModelId, sonnetModelId, haikuModelId);

        try {
            var creds = DefaultCredentialsProvider.create().resolveCredentials();
            String akid = creds.accessKeyId();
            String masked = akid == null || akid.length() < 8
                    ? "<malformed>"
                    : akid.substring(0, 4) + "..." + akid.substring(akid.length() - 4);
            log.info("AWS credentials resolved: accessKeyId={} providerClass={}",
                    masked, creds.getClass().getSimpleName());
        } catch (Exception e) {
            log.error("AWS credentials not configured. AI features will be disabled: {}", e.getMessage());
        }
    }

    @Bean
    public BedrockRuntimeClient bedrockClient() {
        log.debug("Creating Bedrock Runtime client (region: {})", bedrockRegion);
        return BedrockRuntimeClient.builder()
                .credentialsProvider(DefaultCredentialsProvider.create())
                .region(Region.of(bedrockRegion))
                .httpClient(ApacheHttpClient.builder()
                        .socketTimeout(Duration.ofMinutes(5))
                        .connectionTimeout(Duration.ofSeconds(30))
                        .build())
                .overrideConfiguration(config -> config
                        .apiCallTimeout(Duration.ofMinutes(10))
                        .apiCallAttemptTimeout(Duration.ofMinutes(5)))
                .build();
    }

    @Bean
    public BedrockRuntimeAsyncClient bedrockAsyncClient() {
        log.debug("Creating Bedrock Runtime async client (region: {})", bedrockRegion);
        return BedrockRuntimeAsyncClient.builder()
                .credentialsProvider(DefaultCredentialsProvider.create())
                .region(Region.of(bedrockRegion))
                .overrideConfiguration(config -> config
                        .apiCallTimeout(Duration.ofMinutes(10))
                        .apiCallAttemptTimeout(Duration.ofMinutes(5)))
                .build();
    }

    /**
     * S3 client used by AI/Textract code paths. {@link com.bostoneo.bostoneosolutions.service.implementation.S3FileStorageServiceImpl}
     * builds its own S3Client internally (and only registers when {@code file.storage.type=s3}),
     * so this bean is unconditional — needed for the Textract path to upload temp PDFs even
     * when local dev is using {@code file.storage.type=local} for everything else.
     * The two clients can coexist; the cost is one extra connection pool (~negligible).
     */
    @Bean
    public S3Client awsS3Client(FileStorageConfiguration storageConfig) {
        String region = storageConfig.getS3Region();
        log.info("Creating S3 client (region: {})", region);
        return S3Client.builder()
                .credentialsProvider(DefaultCredentialsProvider.create())
                .region(Region.of(region))
                .build();
    }


    /**
     * Resolve the Bedrock model ID from a short model name (e.g., "claude-opus-4-6" -> full Bedrock ARN).
     * This maps the model names used in AIOperationType to Bedrock model IDs.
     */
    public String resolveBedrockModelId(String modelName) {
        if (modelName == null) return opusModelId;
        return switch (modelName) {
            case "claude-opus-4-6" -> opusModelId;
            case "claude-sonnet-4-6" -> sonnetModelId;
            case "claude-haiku-4-5" -> haikuModelId;
            default -> {
                // If it already looks like a Bedrock model ID, use it directly
                if (modelName.contains("anthropic.")) {
                    yield modelName;
                }
                log.warn("Unknown model name '{}', falling back to Opus", modelName);
                yield opusModelId;
            }
        };
    }
}
