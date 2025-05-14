package com.***REMOVED***.***REMOVED***solutions.dtomapper;

import com.***REMOVED***.***REMOVED***solutions.dto.NotificationTokenDTO;
import com.***REMOVED***.***REMOVED***solutions.model.NotificationToken;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

public class NotificationTokenDTOMapper {
    
    /**
     * Convert model to DTO
     */
    public static NotificationTokenDTO fromNotificationToken(NotificationToken token) {
        if (token == null) {
            return null;
        }
        
        DateTimeFormatter formatter = DateTimeFormatter.ISO_LOCAL_DATE_TIME;
        
        NotificationTokenDTO dto = new NotificationTokenDTO();
        dto.setId(token.getId());
        dto.setToken(token.getToken());
        dto.setUserId(token.getUserId());
        dto.setPlatform(token.getPlatform());
        
        if (token.getCreatedAt() != null) {
            dto.setCreatedAt(token.getCreatedAt().format(formatter));
        }
        
        if (token.getLastUsed() != null) {
            dto.setLastUsed(token.getLastUsed().format(formatter));
        }
        
        return dto;
    }
    
    /**
     * Convert DTO to model
     */
    public static NotificationToken toNotificationToken(NotificationTokenDTO dto) {
        if (dto == null) {
            return null;
        }
        
        NotificationToken token = new NotificationToken();
        token.setId(dto.getId());
        token.setToken(dto.getToken());
        token.setUserId(dto.getUserId());
        token.setPlatform(dto.getPlatform());
        
        // Parse dates if provided
        if (dto.getCreatedAt() != null) {
            try {
                token.setCreatedAt(LocalDateTime.parse(dto.getCreatedAt()));
            } catch (Exception e) {
                // Ignore parse errors
            }
        }
        
        if (dto.getLastUsed() != null) {
            try {
                token.setLastUsed(LocalDateTime.parse(dto.getLastUsed()));
            } catch (Exception e) {
                // Ignore parse errors
            }
        }
        
        return token;
    }
} 
 