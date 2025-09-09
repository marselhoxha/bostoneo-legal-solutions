package com.***REMOVED***.***REMOVED***solutions.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;

import java.sql.Timestamp;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
public class LeadDTO {

    private Long id;

    private String firstName;

    private String lastName;

    private String fullName;

    private String email;

    private String phone;

    private String company;

    private String status;

    private String practiceArea;

    private String priority;

    private Integer leadScore;

    private Long assignedTo;

    private String assignedToName;

    private String source;

    private String referralSource;

    private String initialInquiry;

    private String notes;

    private String urgencyLevel;

    private String contactPreference;

    private String bestTimeToCall;

    private String tags;

    private Timestamp consultationDate;

    private String consultationNotes;

    private Timestamp followUpDate;

    private String followUpNotes;

    private Integer estimatedValue;


    private String jurisdiction;

    private Boolean qualified;

    private String qualificationNotes;

    private Boolean contacted;

    private Timestamp lastContactDate;

    private Integer contactAttempts;

    private String conversionStatus;

    private Timestamp convertedAt;

    private Long convertedToClientId;

    private Long convertedToCaseId;

    private Timestamp createdAt;

    private Timestamp updatedAt;
}