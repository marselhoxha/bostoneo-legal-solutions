package com.***REMOVED***.***REMOVED***solutions.utils;

import com.***REMOVED***.***REMOVED***solutions.dto.UserDTO;
import com.***REMOVED***.***REMOVED***solutions.dtomapper.UserDTOMapper;
import com.***REMOVED***.***REMOVED***solutions.model.UserPrincipal;
import org.springframework.security.core.Authentication;

public class UserUtils {
    public static UserDTO getAuthenticatedUser(Authentication authentication) {
        return ((UserDTO) authentication.getPrincipal());
    }


    public static UserDTO getLoggedInUser(Authentication authentication){
        UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
        return UserDTOMapper.fromUserPrincipal(principal);
    }
}
