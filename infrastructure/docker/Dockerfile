# =============================================================================
# Legience API - Production Dockerfile
# =============================================================================
# Multi-stage build for optimized image size
# Owner: Bostoneo Solutions LLC
# =============================================================================

# Build stage
FROM eclipse-temurin:17-jdk-alpine AS build
WORKDIR /app

# Copy Maven files
COPY pom.xml .
COPY src ./src

# Build the application
RUN apk add --no-cache maven && \
    mvn package -DskipTests -Dmaven.test.skip=true

# Runtime stage
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Create non-root user for security
RUN addgroup -g 1000 -S legience && \
    adduser -u 1000 -S legience -G legience

# Copy JAR from build stage
COPY --from=build /app/target/*.jar app.jar

# Change ownership
RUN chown -R legience:legience /app

# Switch to non-root user
USER legience:legience

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8085/actuator/health || exit 1

# Expose port
EXPOSE 8085

# JVM options for containers
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -Djava.security.egd=file:/dev/./urandom"

# Run the application
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
