package com.bostoneo.bostoneosolutions.util;

import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.model.UserPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * Utility to safely extract the authenticated user's ID from SecurityContext.
 * Prevents IDOR by never trusting userId from request bodies.
 */
public final class AuthUtils {

    private AuthUtils() {}

    public static Long getAuthenticatedUserId() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof UserPrincipal up) return up.getId();
        if (principal instanceof UserDTO dto) return dto.getId();
        throw new com.bostoneo.bostoneosolutions.exception.ApiException("Unable to determine user identity");
    }
}
