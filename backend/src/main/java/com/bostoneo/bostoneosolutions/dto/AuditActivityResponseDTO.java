package com.bostoneo.bostoneosolutions.dto;

import lombok.*;

import java.util.List;

@Setter
@Getter
@AllArgsConstructor
@NoArgsConstructor
@ToString
public class AuditActivityResponseDTO {

    private List<AuditLogDTO> activities;
    private Long totalCount;
    private Long todayCount;
    private Long weekCount;
    private String lastUpdateTime;
    
    // Additional statistics
    private ActivityStatistics statistics;
    
    @Setter
    @Getter
    @AllArgsConstructor
    @NoArgsConstructor
    @ToString
    public static class ActivityStatistics {
        private Long totalUsers;
        private Long activeUsersToday;
        private String mostActiveUser;
        private String mostCommonAction;
        private String mostAccessedEntity;
    }
} 
 
 
 
 
 
 