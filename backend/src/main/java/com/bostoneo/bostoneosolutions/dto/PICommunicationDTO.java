package com.bostoneo.bostoneosolutions.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * P9e — DTO for PI Communications Log entries.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PICommunicationDTO {

    private Long id;
    private Long caseId;
    private Long organizationId;

    private String type;
    private String direction;
    private String counterparty;
    private String subject;
    private String summary;

    // Pattern is minutes-precision (no seconds) so it round-trips with the
    // frontend's `<input type="datetime-local">`, which only emits :mm.
    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm")
    private LocalDateTime eventDate;

    @JsonFormat(pattern = "yyyy-MM-dd'T'HH:mm:ss")
    private LocalDateTime createdAt;

    private Long createdBy;
    private String createdByName;
}
