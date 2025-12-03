package com.bostoneo.bostoneosolutions.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClientPortalDashboardDTO {
    // Profile summary
    private String clientName;
    private String clientEmail;
    private String clientImageUrl;

    // Case summary
    private int totalCases;
    private int activeCases;
    private int closedCases;

    // Document summary
    private int totalDocuments;
    private int recentDocuments; // Last 30 days

    // Appointment summary
    private int upcomingAppointments;
    private ClientPortalAppointmentDTO nextAppointment;

    // Message summary
    private int unreadMessages;

    // Billing summary
    private BigDecimal totalOutstanding;
    private int pendingInvoices;

    // Recent activity
    private List<ClientPortalActivityDTO> recentActivity;

    // Recent cases
    private List<ClientPortalCaseDTO> recentCases;
}
