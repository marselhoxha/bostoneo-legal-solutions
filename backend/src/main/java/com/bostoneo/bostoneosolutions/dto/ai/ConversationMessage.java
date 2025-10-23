package com.bostoneo.bostoneosolutions.dto.ai;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * DTO for conversation messages in AI legal research.
 * Used to pass conversation history context to backend for multi-turn conversations.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ConversationMessage {
    /**
     * Role of the message sender: "user" or "assistant"
     */
    private String role;

    /**
     * Content of the message
     */
    private String content;

    /**
     * Timestamp when the message was created
     */
    private LocalDateTime timestamp;
}
