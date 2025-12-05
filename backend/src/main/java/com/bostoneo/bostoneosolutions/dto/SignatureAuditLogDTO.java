package com.bostoneo.bostoneosolutions.dto;

import com.bostoneo.bostoneosolutions.model.SignatureAuditLog.ActorType;
import com.bostoneo.bostoneosolutions.model.SignatureAuditLog.Channel;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_NULL)
public class SignatureAuditLogDTO {

    private Long id;
    private Long organizationId;
    private Long signatureRequestId;
    private String signatureRequestTitle;

    private String eventType;
    private String eventTypeDisplay;
    private String eventData;

    private ActorType actorType;
    private Long actorId;
    private String actorName;
    private String actorEmail;

    private Channel channel;
    private String ipAddress;
    private String userAgent;

    private LocalDateTime createdAt;
}
