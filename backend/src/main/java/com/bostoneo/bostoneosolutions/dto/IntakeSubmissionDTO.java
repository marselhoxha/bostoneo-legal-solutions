package com.***REMOVED***.***REMOVED***solutions.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;

import java.sql.Timestamp;
import java.util.Map;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
public class IntakeSubmissionDTO {

    private Long id;

    private Long intakeFormId;

    private String formTitle;

    private String practiceArea;

    private String status;

    private Map<String, Object> submissionData;

    private String clientName;

    private String clientEmail;

    private String clientPhone;

    private Integer priorityScore;

    private String priority;

    private String source;

    private String notes;

    private Long reviewedBy;

    private String reviewerName;

    private Timestamp reviewedAt;

    private String reviewNotes;

    private Long convertedToLeadId;

    private Timestamp convertedAt;

    private String rejectionReason;

    private Timestamp createdAt;

    private Timestamp updatedAt;
}