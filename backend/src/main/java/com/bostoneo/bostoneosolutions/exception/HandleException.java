package com.bostoneo.bostoneosolutions.exception;

import com.auth0.jwt.exceptions.JWTDecodeException;
import com.auth0.jwt.exceptions.TokenExpiredException;
import com.bostoneo.bostoneosolutions.model.HttpResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.web.servlet.error.ErrorController;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.authorization.AuthorizationDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import java.nio.file.AccessDeniedException;
import java.sql.SQLIntegrityConstraintViolationException;
import java.util.List;
import java.util.stream.Collectors;

import static java.time.LocalDateTime.now;
import static org.springframework.http.HttpStatus.*;
@RestControllerAdvice
@Slf4j
public class HandleException extends ResponseEntityExceptionHandler implements ErrorController {

    @org.springframework.beans.factory.annotation.Value("${spring.profiles.active:dev}")
    private String activeProfile;

    // SECURITY: Suppress internal details in production/staging responses
    private String safeDeveloperMessage(String message) {
        if (isProduction()) return "See server logs for details";
        return message;
    }

    // SECURITY: Sanitize reason field for production — only show safe, user-facing messages
    private String safeReason(String message) {
        if (!isProduction()) return message;
        if (message == null || message.isEmpty()) return "An error occurred";
        // Allow known app-controlled messages (ApiException messages are safe)
        if (message.contains("Please try again") || message.contains("not found") || message.contains("cannot be")) return message;
        return "An error occurred processing your request";
    }

    private boolean isProduction() {
        return activeProfile.contains("prod") || activeProfile.contains("staging");
    }

    @Override
    protected ResponseEntity<Object> handleExceptionInternal(Exception exception, Object body, HttpHeaders headers, HttpStatusCode statusCode, WebRequest request) {
        log.error(exception.getMessage());
        return new ResponseEntity<>(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .reason(safeReason(exception.getMessage()))
                        .developerMessage(safeDeveloperMessage(exception.getMessage()))
                        .status(resolve(statusCode.value()))
                        .statusCode(statusCode.value())
                        .build(), statusCode);
    }

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(MethodArgumentNotValidException exception, HttpHeaders headers, HttpStatusCode statusCode, WebRequest request) {
        log.error(exception.getMessage());
        List<FieldError> fieldErrors = exception.getBindingResult().getFieldErrors();
        String fieldMessage = fieldErrors.stream().map(FieldError::getDefaultMessage).collect(Collectors.joining(", "));
        return new ResponseEntity<>(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .reason(fieldMessage)
                        .developerMessage(safeDeveloperMessage(exception.getMessage()))
                        .status(resolve(statusCode.value()))
                        .statusCode(statusCode.value())
                        .build(), statusCode);
    }

    /**
     * Handle client disconnection during async requests (e.g., long-running AI analysis).
     * This is expected behavior when users navigate away - not an error.
     */
    @ExceptionHandler(AsyncRequestNotUsableException.class)
    public ResponseEntity<HttpResponse> asyncRequestNotUsableException(AsyncRequestNotUsableException exception) {
        // Log at DEBUG level - this is expected when clients disconnect during long requests
        log.debug("Client disconnected during async request (Broken pipe): {}", exception.getMessage());
        // Return null - the client is gone anyway, no point returning a response
        return null;
    }

    @ExceptionHandler(SQLIntegrityConstraintViolationException.class)
    public ResponseEntity<HttpResponse> sQLIntegrityConstraintViolationException(SQLIntegrityConstraintViolationException exception) {
        log.error(exception.getMessage());
        return new ResponseEntity<>(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .reason(exception.getMessage().contains("Duplicate entry") ? "Information already exists" : safeReason(exception.getMessage()))
                        .developerMessage(safeDeveloperMessage(exception.getMessage()))
                        .status(BAD_REQUEST)
                        .statusCode(BAD_REQUEST.value())
                        .build(), BAD_REQUEST);
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<HttpResponse> badCredentialsException(BadCredentialsException exception) {
        log.error(exception.getMessage());
        return new ResponseEntity<>(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .reason("Incorrect email or password")
                        .developerMessage(safeDeveloperMessage(exception.getMessage()))
                        .status(BAD_REQUEST)
                        .statusCode(BAD_REQUEST.value())
                        .build(), BAD_REQUEST);
    }

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<HttpResponse> apiException(ApiException exception) {
        log.error(exception.getMessage());
        return new ResponseEntity<>(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .reason(exception.getMessage())
                        .developerMessage(safeDeveloperMessage(exception.getMessage()))
                        .status(BAD_REQUEST)
                        .statusCode(BAD_REQUEST.value())
                        .build(), BAD_REQUEST);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<HttpResponse> accessDeniedException(AccessDeniedException exception) {
        log.error(exception.getMessage());
        return new ResponseEntity<>(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .reason("Access denied. You don\'t have access")
                        .developerMessage(safeDeveloperMessage(exception.getMessage()))
                        .status(FORBIDDEN)
                        .statusCode(FORBIDDEN.value())
                        .build(), FORBIDDEN);
    }

    @ExceptionHandler(AuthorizationDeniedException.class)
    public ResponseEntity<HttpResponse> authorizationDeniedException(AuthorizationDeniedException exception) {
        log.error("Authorization denied: {}", exception.getMessage());
        return new ResponseEntity<>(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .reason("You don't have permission to perform this action")
                        .developerMessage(safeDeveloperMessage(exception.getMessage()))
                        .status(FORBIDDEN)
                        .statusCode(FORBIDDEN.value())
                        .build(), FORBIDDEN);
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<HttpResponse> runtimeException(RuntimeException exception, WebRequest request) {
        // CRITICAL FIX: Don't handle SSE (Server-Sent Events) exceptions here
        // Let SSE endpoints handle their own errors gracefully
        String requestUri = request.getDescription(false);
        if (requestUri != null && requestUri.contains("/progress-stream")) {
            log.debug("SSE endpoint runtime exception - letting endpoint handle it: {}", exception.getMessage());
            return null;
        }

        // Log without full stack trace for cleaner logs
        log.error("Runtime exception on {}: {}", requestUri, exception.getMessage());

        String reason = exception.getMessage();
        if (reason == null || reason.isEmpty()) {
            reason = "An error occurred while processing your request";
        }

        return new ResponseEntity<>(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .reason(safeReason(reason))
                        .developerMessage(safeDeveloperMessage(exception.getClass().getSimpleName() + ": " + exception.getMessage()))
                        .status(BAD_REQUEST)
                        .statusCode(BAD_REQUEST.value())
                        .build(), BAD_REQUEST);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<HttpResponse> exception(Exception exception, WebRequest request) {
        // CRITICAL FIX: Don't handle SSE (Server-Sent Events) exceptions here
        // SSE endpoints have Content-Type: text/event-stream and can't return JSON
        String requestUri = request.getDescription(false);
        if (requestUri != null && requestUri.contains("/progress-stream")) {
            log.debug("SSE endpoint exception - letting endpoint handle it: {}", exception.getMessage());
            return null;
        }

        // Log concisely - only include stack trace for truly unexpected errors
        log.error("Unhandled exception on {}: {} - {}",
            requestUri,
            exception.getClass().getSimpleName(),
            exception.getMessage());

        String reason = exception.getMessage();
        if (reason == null || reason.isEmpty()) {
            reason = "An unexpected error occurred";
        } else if (reason.contains("expected 1, actual 0")) {
            reason = "Record not found";
        }

        return new ResponseEntity<>(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .reason(safeReason(reason))
                        .developerMessage(safeDeveloperMessage(exception.getClass().getSimpleName() + ": " + exception.getMessage()))
                        .status(INTERNAL_SERVER_ERROR)
                        .statusCode(INTERNAL_SERVER_ERROR.value())
                        .build(), INTERNAL_SERVER_ERROR);
    }

    @ExceptionHandler(JWTDecodeException.class)
    public ResponseEntity<HttpResponse> exception(JWTDecodeException exception) {
        log.warn("JWT decode error: {}", exception.getMessage());
        return new ResponseEntity<>(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .reason("Could not decode the token")
                        .developerMessage(safeDeveloperMessage(exception.getMessage()))
                        .status(UNAUTHORIZED)
                        .statusCode(UNAUTHORIZED.value())
                        .build(), UNAUTHORIZED);
    }

    @ExceptionHandler(TokenExpiredException.class)
    public ResponseEntity<HttpResponse> tokenExpiredException(TokenExpiredException exception) {
        // Expected error - don't log as error, just warn
        log.warn("Token expired - user needs to re-authenticate");
        return new ResponseEntity<>(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .reason("Session expired. Please log in again.")
                        .developerMessage("Token expired")
                        .status(UNAUTHORIZED)
                        .statusCode(UNAUTHORIZED.value())
                        .build(), UNAUTHORIZED);
    }

    @ExceptionHandler(EmptyResultDataAccessException.class)
    public ResponseEntity<HttpResponse> emptyResultDataAccessException(EmptyResultDataAccessException exception) {
        log.error(exception.getMessage());
        return new ResponseEntity<>(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .reason(exception.getMessage().contains("expected 1, actual 0") ? "Record not found" : safeReason(exception.getMessage()))
                        .developerMessage(safeDeveloperMessage(exception.getMessage()))
                        .status(BAD_REQUEST)
                        .statusCode(BAD_REQUEST.value())
                        .build(), BAD_REQUEST);
    }

    @ExceptionHandler(DisabledException.class)
    public ResponseEntity<HttpResponse> disabledException(DisabledException exception) {
        log.error(exception.getMessage());
        return new ResponseEntity<>(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .developerMessage(safeDeveloperMessage(exception.getMessage()))
                        //.reason(exception.getMessage() + ". Please check your email and verify your account.")
                        .reason("User account is currently disabled")
                        .status(BAD_REQUEST)
                        .statusCode(BAD_REQUEST.value()).build()
                , BAD_REQUEST);
    }

    @ExceptionHandler(LockedException.class)
    public ResponseEntity<HttpResponse> lockedException(LockedException exception) {
        log.error(exception.getMessage());
        return new ResponseEntity<>(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .developerMessage(safeDeveloperMessage(exception.getMessage()))
                        //.reason(exception.getMessage() + ", too many failed attempts.")
                        .reason("User account is currently locked")
                        .status(BAD_REQUEST)
                        .statusCode(BAD_REQUEST.value()).build()
                , BAD_REQUEST);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<HttpResponse> dataIntegrityViolationException(DataIntegrityViolationException exception) {
        log.error(exception.getMessage());
        String reason = processIntegrityViolationMessage(exception.getMessage());
        return new ResponseEntity<>(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .reason(reason)
                        .developerMessage(safeDeveloperMessage(exception.getMessage()))
                        .status(CONFLICT)
                        .statusCode(CONFLICT.value()).build()
                , CONFLICT);
    }

    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<HttpResponse> dataAccessException(DataAccessException exception) {
        log.error(exception.getMessage());
        return new ResponseEntity<>(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .reason(processErrorMessage(exception.getMessage()))
                        .developerMessage(safeDeveloperMessage(processErrorMessage(exception.getMessage())))
                        .status(BAD_REQUEST)
                        .statusCode(BAD_REQUEST.value()).build()
                , BAD_REQUEST);
    }

    @ExceptionHandler(LegalCaseException.class)
    public ResponseEntity<HttpResponse> legalCaseException(LegalCaseException exception) {
        return createErrorHttpResponse(NOT_FOUND, exception.getMessage(), exception);
    }

    private ResponseEntity<HttpResponse> createErrorHttpResponse(HttpStatus httpStatus, String reason, Exception exception) {
        return new ResponseEntity<>(
                HttpResponse.builder()
                        .timeStamp(now().toString())
                        .developerMessage(safeDeveloperMessage(exception.getMessage()))
                        .reason(reason)
                        .status(httpStatus)
                        .statusCode(httpStatus.value()).build()
                , httpStatus);
    }

    private String processIntegrityViolationMessage(String message) {
        if (message == null) return "A data integrity error occurred. Please try again.";
        // PostgreSQL duplicate key
        if (message.contains("duplicate key value") || message.contains("unique constraint")) {
            if (message.contains("(email)")) {
                return "A lead with this email address already exists.";
            }
            if (message.contains("(phone)")) {
                return "A lead with this phone number already exists.";
            }
            if (message.contains("(case_number)")) {
                return "This case number already exists. Please try again — a new number will be generated.";
            }
            // Surface the column name when we can extract it — generic "Key (col)=(val)"
            // pattern in the Postgres detail line. Beats the catch-all when the user
            // hits a unique constraint we don't have a friendly message for.
            String col = extractKeyColumn(message);
            if (col != null) {
                return "A record with this " + col.replace('_', ' ') + " already exists.";
            }
            return "A record with these details already exists.";
        }
        // PostgreSQL FK violation — usually means a referenced parent row is missing
        // or a child row is preventing delete. Both surface here.
        if (message.contains("violates foreign key constraint")) {
            String table = extractFkRelatedTable(message);
            if (table != null) {
                return "Cannot complete this action because of a related record in " + table + ".";
            }
            return "Cannot complete this action — a related record is preventing it.";
        }
        // PostgreSQL not-null / check constraint
        if (message.contains("violates not-null constraint")) {
            String col = extractNotNullColumn(message);
            if (col != null) {
                return "Required field missing: " + col.replace('_', ' ') + ".";
            }
            return "Required information is missing. Please fill in all required fields.";
        }
        if (message.contains("violates check constraint")) {
            return "One of the values doesn't meet validation rules. Please review the form.";
        }
        // MySQL-style (legacy)
        if (message.contains("Duplicate entry")) {
            if (message.contains("AccountVerifications")) return "You already verified your account.";
            if (message.contains("ResetPasswordVerifications")) return "We already sent you an email to reset your password.";
            return "Duplicate entry. Please try again.";
        }
        return "A data integrity error occurred. Please try again.";
    }

    /** Extract column name from a Postgres unique-violation DETAIL line: `Key (col)=(...)` */
    private String extractKeyColumn(String message) {
        int i = message.indexOf("Key (");
        if (i < 0) return null;
        int j = message.indexOf(')', i + 5);
        if (j < 0) return null;
        return message.substring(i + 5, j);
    }

    /** Extract the table name from a Postgres FK-violation message: `on table "child"`. */
    private String extractFkRelatedTable(String message) {
        int i = message.indexOf("on table \"");
        if (i < 0) return null;
        int j = message.indexOf('"', i + 10);
        if (j < 0) return null;
        return message.substring(i + 10, j);
    }

    /** Extract column from a Postgres not-null violation: `null value in column "col"`. */
    private String extractNotNullColumn(String message) {
        int i = message.indexOf("null value in column \"");
        if (i < 0) return null;
        int j = message.indexOf('"', i + 22);
        if (j < 0) return null;
        return message.substring(i + 22, j);
    }

    private String processErrorMessage(String errorMessage) {
        if(errorMessage != null) {
            if(errorMessage.contains("Duplicate entry") && errorMessage.contains("AccountVerifications")) {
                return "You already verified your account.";
            }
            if(errorMessage.contains("Duplicate entry") && errorMessage.contains("ResetPasswordVerifications")) {
                return "We already sent you an email to reset your password.";
            }
            if(errorMessage.contains("Duplicate entry")) {
                return "Duplicate entry. Please try again.";
            }
        }
        return "Some error occurred";
    }
}
