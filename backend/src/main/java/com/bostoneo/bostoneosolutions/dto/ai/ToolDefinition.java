package com.bostoneo.bostoneosolutions.dto.ai;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * Anthropic API tool definition for function calling
 * See: https://docs.anthropic.com/claude/docs/tool-use
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ToolDefinition {
    private String name;
    private String description;
    private Map<String, Object> input_schema;  // JSON Schema for tool parameters
}
