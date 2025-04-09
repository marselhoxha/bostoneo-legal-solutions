package com.bostoneo.bostoneosolutions.utils;

import com.bostoneo.bostoneosolutions.dto.UserDTO;
import com.bostoneo.bostoneosolutions.model.UserPrincipal;
import org.springframework.security.core.Authentication;

public class UserUtils {
    public static UserDTO getAuthenticatedUser(Authentication authentication) {
        return ((UserDTO) authentication.getPrincipal());
    }


    public static UserDTO getLoggedInUser(Authentication authentication){
        return ((UserPrincipal) authentication.getPrincipal()).getUser();
    }
}
