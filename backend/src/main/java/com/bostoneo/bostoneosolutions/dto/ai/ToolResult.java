package com.bostoneo.bostoneosolutions.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Tool execution result to send back to Claude
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ToolResult {
    private String type;         // Always "tool_result"
    private String tool_use_id;  // ID from the tool use request
    private Object content;      // Tool execution result (String or structured data)
    private Boolean is_error;    // Optional: true if tool execution failed
}
