package com.bostoneo.bostoneosolutions.dto.ai;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AIRequest {
    private String model = "claude-3-5-sonnet-20241022";
    private int max_tokens = 4000;
    private String system;  // System message for high-priority instructions
    private Message[] messages;
    private List<ToolDefinition> tools;  // For tool-calling mode
    private Double temperature;  // 0.0 for deterministic responses, null for default

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Message {
        private String role;
        private Object content;  // Can be String or List<ContentBlock> for tool results
    }
}