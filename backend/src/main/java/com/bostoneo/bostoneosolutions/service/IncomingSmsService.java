package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.IncomingSmsDTO;
import com.bostoneo.bostoneosolutions.model.CommunicationLog;

/**
 * Service for processing incoming SMS messages from clients.
 * Handles matching SMS to clients, creating message threads, and notifications.
 */
public interface IncomingSmsService {

    /**
     * Process an incoming SMS from Twilio webhook.
     * This will:
     * 1. Match the phone number to a client
     * 2. Find or create a message thread
     * 3. Store the message
     * 4. Notify the assigned attorney
     *
     * @param incomingSms The incoming SMS data from Twilio
     * @return The created communication log entry
     */
    CommunicationLog processIncomingSms(IncomingSmsDTO incomingSms);

    /**
     * Find client by phone number
     *
     * @param phoneNumber The phone number to search (E.164 format)
     * @return Client ID if found, null otherwise
     */
    Long findClientByPhone(String phoneNumber);

    /**
     * Get the primary case for a client to associate the message with
     *
     * @param clientId The client ID
     * @return Case ID if found, null otherwise
     */
    Long getPrimaryCaseForClient(Long clientId);
}
