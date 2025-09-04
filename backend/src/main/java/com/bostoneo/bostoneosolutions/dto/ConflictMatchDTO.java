package com.***REMOVED***.***REMOVED***solutions.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.util.Map;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
public class ConflictMatchDTO {

    private String entityType;

    private Long entityId;

    private String entityName;

    private String matchType;

    private BigDecimal matchScore;

    private String matchReason;

    private Map<String, Object> matchDetails;

    private String riskLevel;

    private String status;

    private Timestamp lastUpdated;

    private String recommendedAction;
}