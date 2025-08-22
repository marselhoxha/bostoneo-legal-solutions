package com.***REMOVED***.***REMOVED***solutions.handler;

import com.***REMOVED***.***REMOVED***solutions.model.HttpResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.OutputStream;

import static java.time.LocalDateTime.now;
import static java.util.Map.of;
import static org.springframework.http.HttpStatus.CREATED;
import static org.springframework.http.HttpStatus.FORBIDDEN;
import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;

@Component
@Slf4j
public class CustomAccessDeniedHandler implements AccessDeniedHandler {
    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, AccessDeniedException accessDeniedException) throws IOException, ServletException {
        log.error("🚨 ACCESS DENIED HANDLER TRIGGERED!");
        log.error("- Request: {} {}", request.getMethod(), request.getRequestURI());
        log.error("- Exception: {}", accessDeniedException.getMessage());
        
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null) {
            log.error("- Principal: {}", auth.getPrincipal());
            log.error("- Authorities: {}", auth.getAuthorities());
            log.error("- Authenticated: {}", auth.isAuthenticated());
        } else {
            log.error("- No Authentication found in SecurityContext");
        }
        
        HttpResponse httpResponse = HttpResponse
                .builder()
                .timeStamp(now().toString())
                .reason("You don't have enough permission")
                .status(FORBIDDEN)
                .statusCode(FORBIDDEN.value())
                .build();
        response.setContentType(APPLICATION_JSON_VALUE);
        response.setStatus(FORBIDDEN.value());
        OutputStream out = response.getOutputStream();
        ObjectMapper mapper = new ObjectMapper();
        mapper.writeValue(out, httpResponse);
        out.flush();
    }
}
