package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.dto.CommunicationLogDTO;
import com.bostoneo.bostoneosolutions.dto.SmsRequestDTO;
import com.bostoneo.bostoneosolutions.dto.SmsResponseDTO;
import com.bostoneo.bostoneosolutions.model.CommunicationLog;
import com.bostoneo.bostoneosolutions.repository.CommunicationLogRepository;
import com.bostoneo.bostoneosolutions.service.CommunicationLogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Implementation of CommunicationLogService
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class CommunicationLogServiceImpl implements CommunicationLogService {

    private final CommunicationLogRepository communicationLogRepository;

    @Override
    public CommunicationLog logSms(SmsRequestDTO request, SmsResponseDTO response, String fromNumber) {
        CommunicationLog logEntry = CommunicationLog.builder()
                .userId(request.getUserId())
                .clientId(request.getClientId())
                .caseId(request.getCaseId())
                .appointmentId(request.getAppointmentId())
                .channel("SMS")
                .direction("OUTBOUND")
                .toAddress(request.getTo())
                .fromAddress(fromNumber)
                .content(request.getMessage())
                .status(response.isSuccess() ? response.getStatus() : "FAILED")
                .twilioSid(response.getMessageSid())
                .errorMessage(response.getErrorMessage())
                .errorCode(response.getErrorCode())
                .templateCode(request.getTemplateCode())
                .sentByUserId(request.getSentByUserId())
                .sentByUserName(request.getSentByUserName())
                .build();

        CommunicationLog saved = communicationLogRepository.save(logEntry);
        log.info("Logged SMS communication. ID: {}, To: {}, Status: {}",
                saved.getId(), maskPhone(request.getTo()), saved.getStatus());
        return saved;
    }

    @Override
    public CommunicationLog logWhatsApp(SmsRequestDTO request, SmsResponseDTO response, String fromNumber) {
        CommunicationLog logEntry = CommunicationLog.builder()
                .userId(request.getUserId())
                .clientId(request.getClientId())
                .caseId(request.getCaseId())
                .appointmentId(request.getAppointmentId())
                .channel("WHATSAPP")
                .direction("OUTBOUND")
                .toAddress(request.getTo())
                .fromAddress(fromNumber)
                .content(request.getMessage())
                .status(response.isSuccess() ? response.getStatus() : "FAILED")
                .twilioSid(response.getMessageSid())
                .errorMessage(response.getErrorMessage())
                .errorCode(response.getErrorCode())
                .templateCode(request.getTemplateCode())
                .sentByUserId(request.getSentByUserId())
                .sentByUserName(request.getSentByUserName())
                .build();

        CommunicationLog saved = communicationLogRepository.save(logEntry);
        log.info("Logged WhatsApp communication. ID: {}, To: {}, Status: {}",
                saved.getId(), maskPhone(request.getTo()), saved.getStatus());
        return saved;
    }

    @Override
    public CommunicationLog logEmail(Long userId, Long clientId, Long caseId, String to, String from,
                                      String subject, String content, String status) {
        CommunicationLog logEntry = CommunicationLog.builder()
                .userId(userId)
                .clientId(clientId)
                .caseId(caseId)
                .channel("EMAIL")
                .direction("OUTBOUND")
                .toAddress(to)
                .fromAddress(from)
                .subject(subject)
                .content(content)
                .status(status)
                .build();

        CommunicationLog saved = communicationLogRepository.save(logEntry);
        log.info("Logged Email communication. ID: {}, To: {}, Subject: {}",
                saved.getId(), to, subject);
        return saved;
    }

    @Override
    public void updateStatus(String twilioSid, String status, String errorCode, String errorMessage) {
        communicationLogRepository.findByTwilioSid(twilioSid).ifPresent(log -> {
            log.setStatus(status);
            log.setErrorCode(errorCode);
            log.setErrorMessage(errorMessage);
            if ("DELIVERED".equalsIgnoreCase(status)) {
                log.setDeliveredAt(LocalDateTime.now());
            }
            communicationLogRepository.save(log);
            CommunicationLogServiceImpl.log.info("Updated communication status. SID: {}, Status: {}",
                    twilioSid, status);
        });
    }

    @Override
    @Transactional(readOnly = true)
    public CommunicationLogDTO getById(Long id) {
        return communicationLogRepository.findById(id)
                .map(this::toDTO)
                .orElse(null);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<CommunicationLogDTO> getByClientId(Long clientId, Pageable pageable) {
        return communicationLogRepository.findByClientIdOrderByCreatedAtDesc(clientId, pageable)
                .map(this::toDTO);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<CommunicationLogDTO> getByCaseId(Long caseId, Pageable pageable) {
        return communicationLogRepository.findByCaseIdOrderByCreatedAtDesc(caseId, pageable)
                .map(this::toDTO);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<CommunicationLogDTO> getByUserId(Long userId, Pageable pageable) {
        return communicationLogRepository.findByUserIdOrderByCreatedAtDesc(userId, pageable)
                .map(this::toDTO);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<CommunicationLogDTO> getByChannel(String channel, Pageable pageable) {
        return communicationLogRepository.findByChannelOrderByCreatedAtDesc(channel, pageable)
                .map(this::toDTO);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<CommunicationLogDTO> getByDateRange(LocalDateTime startDate, LocalDateTime endDate, Pageable pageable) {
        return communicationLogRepository.findByDateRange(startDate, endDate, pageable)
                .map(this::toDTO);
    }

    @Override
    @Transactional(readOnly = true)
    public List<CommunicationLogDTO> getRecentByClientId(Long clientId) {
        LocalDateTime thirtyDaysAgo = LocalDateTime.now().minusDays(30);
        return communicationLogRepository.findRecentByClientId(clientId, thirtyDaysAgo)
                .stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public Page<CommunicationLogDTO> search(String query, Pageable pageable) {
        return communicationLogRepository.searchCommunications(query, pageable)
                .map(this::toDTO);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Object> getStatistics(LocalDateTime since) {
        Map<String, Object> stats = new HashMap<>();

        // Channel statistics
        List<Object[]> channelStats = communicationLogRepository.getChannelStatistics(since);
        Map<String, Long> byChannel = new HashMap<>();
        for (Object[] row : channelStats) {
            byChannel.put((String) row[0], (Long) row[1]);
        }
        stats.put("byChannel", byChannel);

        // Status counts
        stats.put("totalSms", communicationLogRepository.countByChannel("SMS"));
        stats.put("totalWhatsApp", communicationLogRepository.countByChannel("WHATSAPP"));
        stats.put("totalEmail", communicationLogRepository.countByChannel("EMAIL"));
        stats.put("totalFailed", communicationLogRepository.countFailedCommunications());

        return stats;
    }

    @Override
    @Transactional(readOnly = true)
    public long getFailedCount() {
        return communicationLogRepository.countFailedCommunications();
    }

    /**
     * Convert entity to DTO
     */
    private CommunicationLogDTO toDTO(CommunicationLog entity) {
        return CommunicationLogDTO.builder()
                .id(entity.getId())
                .userId(entity.getUserId())
                .clientId(entity.getClientId())
                .caseId(entity.getCaseId())
                .appointmentId(entity.getAppointmentId())
                .channel(entity.getChannel())
                .direction(entity.getDirection())
                .toAddress(entity.getToAddress())
                .fromAddress(entity.getFromAddress())
                .content(entity.getContent())
                .subject(entity.getSubject())
                .status(entity.getStatus())
                .twilioSid(entity.getTwilioSid())
                .errorMessage(entity.getErrorMessage())
                .errorCode(entity.getErrorCode())
                .templateCode(entity.getTemplateCode())
                .sentByUserId(entity.getSentByUserId())
                .sentByUserName(entity.getSentByUserName())
                .durationSeconds(entity.getDurationSeconds())
                .cost(entity.getCost())
                .costCurrency(entity.getCostCurrency())
                .createdAt(entity.getCreatedAt())
                .deliveredAt(entity.getDeliveredAt())
                .updatedAt(entity.getUpdatedAt())
                .statusDisplay(getStatusDisplay(entity.getStatus()))
                .channelIcon(getChannelIcon(entity.getChannel()))
                .build();
    }

    private String getStatusDisplay(String status) {
        if (status == null) return "Unknown";
        return switch (status.toUpperCase()) {
            case "QUEUED" -> "Queued";
            case "SENT" -> "Sent";
            case "DELIVERED" -> "Delivered";
            case "FAILED" -> "Failed";
            case "UNDELIVERED" -> "Undelivered";
            default -> status;
        };
    }

    private String getChannelIcon(String channel) {
        if (channel == null) return "ri-message-line";
        return switch (channel.toUpperCase()) {
            case "SMS" -> "ri-smartphone-line";
            case "WHATSAPP" -> "ri-whatsapp-line";
            case "EMAIL" -> "ri-mail-line";
            case "VOICE" -> "ri-phone-line";
            default -> "ri-message-line";
        };
    }

    private String maskPhone(String phone) {
        if (phone == null || phone.length() < 4) return "****";
        return "***" + phone.substring(phone.length() - 4);
    }
}
