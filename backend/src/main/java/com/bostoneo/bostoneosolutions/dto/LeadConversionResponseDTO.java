package com.***REMOVED***.***REMOVED***solutions.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
public class LeadConversionResponseDTO {

    private Boolean success;

    private String message;

    private Long leadId;

    private Long clientId;

    private Long caseId;

    private Long conversionId;

    private String conversionType;

    private String errorCode;

    private String conflictDetails;
}