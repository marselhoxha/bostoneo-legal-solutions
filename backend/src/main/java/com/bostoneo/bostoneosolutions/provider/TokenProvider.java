package com.bostoneo.bostoneosolutions.provider;

import com.auth0.jwt.JWT;
import com.auth0.jwt.JWTVerifier;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.exceptions.InvalidClaimException;
import com.auth0.jwt.exceptions.JWTVerificationException;
import com.auth0.jwt.exceptions.TokenExpiredException;
import com.bostoneo.bostoneosolutions.model.UserPrincipal;
import com.bostoneo.bostoneosolutions.service.UserService;
import io.micrometer.common.util.StringUtils;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;

import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import java.util.ArrayList;
import java.util.HashMap;

import static com.auth0.jwt.algorithms.Algorithm.HMAC512;
import static com.bostoneo.bostoneosolutions.constant.Constants.*;
import static java.lang.System.currentTimeMillis;
import static java.util.Arrays.stream;
import static java.util.stream.Collectors.toList;

@Component
@RequiredArgsConstructor
@Slf4j
public class TokenProvider {

    private final UserService userService;

    @Value("${jwt.secret}")
    private String secret;

    public String createAccessToken(UserPrincipal userPrincipal){
        // Extract permissions and roles for JWT claims - put all authorities into permissions array
        List<String> allAuthorities = userPrincipal.getAuthorities().stream()
            .map(GrantedAuthority::getAuthority)
            .collect(Collectors.toList());

        // Extract just the roles (for backwards compatibility)
        List<String> roles = userPrincipal.getAuthorities().stream()
            .map(GrantedAuthority::getAuthority)
            .filter(auth -> auth.startsWith("ROLE_"))
            .collect(Collectors.toList());

        // Add case-specific roles
        Map<String, Object> caseRoles = new HashMap<>();
        userPrincipal.getCaseRoleAssignments().forEach(assignment -> {
            Long caseId = assignment.getLegalCase().getId();
            String roleName = assignment.getRole().getName();
            if (caseRoles.containsKey(caseId.toString())) {
                ((List<String>) caseRoles.get(caseId.toString())).add(roleName);
            } else {
                List<String> caseRolesList = new ArrayList<>();
                caseRolesList.add(roleName);
                caseRoles.put(caseId.toString(), caseRolesList);
            }
        });

        // Get organization ID from user
        Long organizationId = userPrincipal.getUser().getOrganizationId();
        log.info("Creating access token for user {} (id={}) with organizationId={}",
            userPrincipal.getUser().getEmail(), userPrincipal.getUser().getId(), organizationId);

        return JWT.create().withIssuer(BOSTONEO_SOLUTIONS_LLC).withAudience(CLIENT_MANAGEMENT_SERVICE)
                .withIssuedAt(new Date())
                .withSubject(String.valueOf(userPrincipal.getUser().getId()))
                .withClaim("organizationId", organizationId)
                .withArrayClaim(AUTHORITIES, getClaimsFromUser(userPrincipal))
                .withArrayClaim("permissions", allAuthorities.toArray(new String[0]))
                .withArrayClaim("roles", roles.toArray(new String[0]))
                .withClaim("caseRoles", caseRoles)
                .withExpiresAt(new Date(currentTimeMillis() + ACCESS_TOKEN_EXPIRATION_TIME))
                .sign(HMAC512(secret.getBytes()));
    }
    
    public String createRefreshToken(UserPrincipal userPrincipal){
        // Include organizationId in refresh token for tenant context during token refresh
        Long organizationId = userPrincipal.getUser().getOrganizationId();
        return JWT.create().withIssuer(BOSTONEO_SOLUTIONS_LLC).withAudience(CLIENT_MANAGEMENT_SERVICE)
                .withIssuedAt(new Date()).withSubject(String.valueOf(userPrincipal.getUser().getId()))
                .withClaim("organizationId", organizationId)
                .withExpiresAt(new Date(currentTimeMillis() + REFRESH_TOKEN_EXPIRATION_TIME))
                .sign(HMAC512(secret.getBytes()));
    }

    public Long getSubject(String token, HttpServletRequest request) {
        try {
            return Long.valueOf(getJWTVerifier().verify(token).getSubject());
        } catch (TokenExpiredException exception) {
            request.setAttribute("expiredMessage", exception.getMessage());
            throw exception;
        } catch (InvalidClaimException exception) {
            request.setAttribute("invalidClaim", exception.getMessage());
            throw exception;
        } catch (Exception exception) {
            throw exception;
        }
    }


    public List<GrantedAuthority> getAuthorities(String token){
        String[] claims = getClaimsFromToken(token);
        return stream(claims).map(SimpleGrantedAuthority::new).collect(toList());
    }

    public Authentication getAuthentication(Long userId, List<GrantedAuthority> authorities, HttpServletRequest request){
        UsernamePasswordAuthenticationToken userPasswordAuthToken = new UsernamePasswordAuthenticationToken(userService.getUserById(userId), null, authorities);
        userPasswordAuthToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
        return userPasswordAuthToken;
    }

    public boolean isTokenValid(Long userId, String token){
        JWTVerifier verifier = getJWTVerifier();
        return !Objects.isNull(userId) && !isTokenExpired(verifier, token);
    }

    /**
     * Extract organization ID from JWT token
     * This allows setting tenant context without a database lookup
     */
    public long getIssuedAt(String token) {
        try {
            return getJWTVerifier().verify(token).getIssuedAt().getTime();
        } catch (Exception e) {
            return 0;
        }
    }

    public Long getOrganizationId(String token) {
        try {
            JWTVerifier verifier = getJWTVerifier();
            var decodedToken = verifier.verify(token);
            var claim = decodedToken.getClaim("organizationId");
            if (claim.isNull()) {
                log.warn("Token does not contain organizationId claim");
                return null;
            }
            Long orgId = claim.asLong();
            log.debug("Extracted organizationId {} from token", orgId);
            return orgId;
        } catch (Exception e) {
            log.error("Failed to extract organizationId from token: {}", e.getMessage());
            return null;
        }
    }
   private boolean isTokenExpired(JWTVerifier verifier, String token) {
        Date expiration = verifier.verify(token).getExpiresAt();
        return expiration.before(new Date());
    }

    private String[] getClaimsFromUser(UserPrincipal userPrincipal) {
        return userPrincipal.getAuthorities().stream().map(GrantedAuthority::getAuthority).toArray(String[]::new);
    }

    private String[] getClaimsFromToken(String token) {
        JWTVerifier verifier = getJWTVerifier();
        return verifier.verify(token).getClaim(AUTHORITIES).asArray(String.class);
    }

    private JWTVerifier getJWTVerifier() {

        JWTVerifier verifier;
        try {
            Algorithm algorithm = HMAC512(secret);
            verifier = JWT.require(algorithm).withIssuer(BOSTONEO_SOLUTIONS_LLC).build();
        }catch (JWTVerificationException exception) { throw new JWTVerificationException(TOKEN_CANNOT_BE_VERIFIED); }
        return verifier;
    }
}
