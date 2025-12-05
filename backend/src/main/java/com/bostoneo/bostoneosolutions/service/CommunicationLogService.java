package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.CommunicationLogDTO;
import com.bostoneo.bostoneosolutions.dto.SmsRequestDTO;
import com.bostoneo.bostoneosolutions.dto.SmsResponseDTO;
import com.bostoneo.bostoneosolutions.model.CommunicationLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Service for managing communication logs
 */
public interface CommunicationLogService {

    /**
     * Log an outbound SMS communication
     */
    CommunicationLog logSms(SmsRequestDTO request, SmsResponseDTO response, String fromNumber);

    /**
     * Log an outbound WhatsApp communication
     */
    CommunicationLog logWhatsApp(SmsRequestDTO request, SmsResponseDTO response, String fromNumber);

    /**
     * Log an email communication
     */
    CommunicationLog logEmail(Long userId, Long clientId, Long caseId, String to, String from,
                               String subject, String content, String status);

    /**
     * Update communication status (from Twilio webhook)
     */
    void updateStatus(String twilioSid, String status, String errorCode, String errorMessage);

    /**
     * Get communication by ID
     */
    CommunicationLogDTO getById(Long id);

    /**
     * Get communications by client
     */
    Page<CommunicationLogDTO> getByClientId(Long clientId, Pageable pageable);

    /**
     * Get communications by case
     */
    Page<CommunicationLogDTO> getByCaseId(Long caseId, Pageable pageable);

    /**
     * Get communications by user
     */
    Page<CommunicationLogDTO> getByUserId(Long userId, Pageable pageable);

    /**
     * Get communications by channel
     */
    Page<CommunicationLogDTO> getByChannel(String channel, Pageable pageable);

    /**
     * Get communications in date range
     */
    Page<CommunicationLogDTO> getByDateRange(LocalDateTime startDate, LocalDateTime endDate, Pageable pageable);

    /**
     * Get recent communications for a client (last 30 days)
     */
    List<CommunicationLogDTO> getRecentByClientId(Long clientId);

    /**
     * Search communications
     */
    Page<CommunicationLogDTO> search(String query, Pageable pageable);

    /**
     * Get communication statistics
     */
    Map<String, Object> getStatistics(LocalDateTime since);

    /**
     * Get failed communications count
     */
    long getFailedCount();
}
