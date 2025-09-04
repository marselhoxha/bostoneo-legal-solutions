package com.***REMOVED***.***REMOVED***solutions.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.util.List;
import java.util.Map;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
public class ConflictCheckDTO {

    private Long id;

    private String entityType;

    private Long entityId;

    private String checkType;

    private List<String> searchTerms;

    private Map<String, Object> searchParameters;

    private List<ConflictMatchDTO> results;

    private String status;

    private BigDecimal confidenceScore;

    private Boolean autoChecked;

    private Long checkedBy;

    private String checkedByName;

    private Timestamp checkedAt;

    private String resolution;

    private String resolutionNotes;

    private String waiverDocumentPath;

    private Long resolvedBy;

    private String resolvedByName;

    private Timestamp resolvedAt;

    private Timestamp expiresAt;

    private Timestamp createdAt;

    private Timestamp updatedAt;
}