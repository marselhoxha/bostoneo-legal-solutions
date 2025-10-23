package com.bostoneo.bostoneosolutions.dto.ai;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@NoArgsConstructor
public class AIResponse {
    private String id;
    private String type;
    private String role;
    private Content[] content;
    private String model;
    private Usage usage;
    @JsonProperty("stop_reason")
    private String stopReason;

    @Data
    @NoArgsConstructor
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class Content {
        private String type;   // "text" or "tool_use"
        private String text;   // For type="text"

        // For type="tool_use"
        private String id;
        private String name;
        private Map<String, Object> input;
    }

    @Data
    @NoArgsConstructor
    public static class Usage {
        private int input_tokens;
        private int output_tokens;
    }

    /**
     * Check if response contains tool use
     */
    public boolean hasToolUse() {
        if (content == null) return false;
        for (Content c : content) {
            if ("tool_use".equals(c.getType())) return true;
        }
        return false;
    }

    /**
     * Get first tool use from response
     */
    public Content getFirstToolUse() {
        if (content == null) return null;
        for (Content c : content) {
            if ("tool_use".equals(c.getType())) return c;
        }
        return null;
    }
}