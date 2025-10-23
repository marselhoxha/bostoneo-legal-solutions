package com.bostoneo.bostoneosolutions.dto.ai;

import lombok.Data;

import java.util.Map;

/**
 * Represents a tool use request from Claude
 */
@Data
public class ToolUse {
    private String id;           // Unique ID for this tool use
    private String type;         // Always "tool_use"
    private String name;         // Tool name
    private Map<String, Object> input;  // Tool parameters
}
