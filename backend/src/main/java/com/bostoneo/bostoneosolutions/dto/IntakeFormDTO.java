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
public class IntakeFormDTO {

    private Long id;

    private String name;

    private String description;

    private String formType;

    private String status;

    private Boolean isPublic;

    private String publicUrl;

    private Map<String, Object> formConfig;

    private String successMessage;

    private String redirectUrl;

    private Long emailTemplateId;

    private Long autoAssignTo;

    private String practiceArea;

    private Integer version;

    private Integer submissionCount;

    private BigDecimal conversionRate;

    private Long createdBy;

    private String createdByName;

    private Timestamp createdAt;

    private Timestamp updatedAt;

    private Timestamp publishedAt;
}