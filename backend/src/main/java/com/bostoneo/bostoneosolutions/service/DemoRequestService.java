package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.DemoRequestDTO;
import com.bostoneo.bostoneosolutions.repository.DemoRequestRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class DemoRequestService {

    private final DemoRequestRepository demoRequestRepository;
    private final EmailService emailService;

    public void submitDemoRequest(DemoRequestDTO dto) {
        // Save to database
        demoRequestRepository.save(
            dto.getName(), dto.getEmail(), dto.getFirmName(),
            dto.getFirmSize(), dto.getPracticeAreas(),
            dto.getPhone(), dto.getMessage()
        );

        // Send notification email to admin asynchronously
        sendAdminNotification(dto);
    }

    @Async
    protected void sendAdminNotification(DemoRequestDTO dto) {
        try {
            String subject = "New Demo Request: " + dto.getFirmName() + " (" + dto.getName() + ")";
            String body = String.format("""
                New demo request received:

                Name: %s
                Email: %s
                Firm: %s
                Firm Size: %s
                Practice Areas: %s
                Phone: %s
                Message: %s
                """,
                dto.getName(),
                dto.getEmail(),
                dto.getFirmName(),
                dto.getFirmSize(),
                String.join(", ", dto.getPracticeAreas()),
                dto.getPhone() != null ? dto.getPhone() : "Not provided",
                dto.getMessage() != null ? dto.getMessage() : "Not provided"
            );

            emailService.sendEmail("marsel.hox@gmail.com", subject, body);
            log.info("Admin notification sent for demo request from: {}", dto.getEmail());
        } catch (Exception e) {
            log.error("Failed to send admin notification for demo request from: {}", dto.getEmail(), e);
        }
    }
}
