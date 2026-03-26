package com.bostoneo.bostoneosolutions.dto.superadmin;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class RoleSummaryDTO {
    private Long id;
    private String name;
    private String displayName;
    private int hierarchyLevel;
    private boolean isSystemRole;
    private String description;
    private String permissionSummary;
}
