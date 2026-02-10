# =============================================================================
# Legience API - CI/CD Dockerfile
# =============================================================================
# Runtime-only image — JAR is pre-built by CI (mvn package -DskipTests)
# =============================================================================

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Create non-root user for security
RUN addgroup -g 1000 -S legience && \
    adduser -u 1000 -S legience -G legience

# Copy pre-built JAR from CI build step
COPY target/*.jar app.jar

# Change ownership
RUN chown -R legience:legience /app

# Switch to non-root user
USER legience:legience

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8085/actuator/health || exit 1

EXPOSE 8085

# JVM options for containers
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -XX:+TieredCompilation -XX:+AlwaysPreTouch -Djava.security.egd=file:/dev/./urandom"

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
