# =============================================================================
# Legience API - CI/CD Dockerfile
# =============================================================================
# Runtime-only image — JAR is pre-built by CI (mvn package -DskipTests)
# =============================================================================

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Install curl for health checks, tesseract for PDF OCR (scanned medical documents)
RUN apk add --no-cache curl tesseract-ocr tesseract-ocr-data-eng

# Create non-root user for security
RUN addgroup -g 1000 -S legience && \
    adduser -u 1000 -S legience -G legience

# Copy pre-built JAR from CI build step
COPY target/*.jar app.jar

# Change ownership
RUN chown -R legience:legience /app

# Switch to non-root user
USER legience:legience

# Health check — start-period must exceed app startup time (~200s on Fargate)
HEALTHCHECK --interval=30s --timeout=5s --start-period=300s --retries=3 \
  CMD curl -f http://localhost:8085/health || exit 1

EXPOSE 8085

# JVM options for containers
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=60.0 -XX:MaxMetaspaceSize=256m -XX:+TieredCompilation -Djava.security.egd=file:/dev/./urandom"

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
