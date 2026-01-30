package com.bostoneo.bostoneosolutions.enumeration;

public enum WorkflowStepType {
    DISPLAY,        // Query stored analysis data (no AI call)
    SYNTHESIS,      // Light AI aggregation
    GENERATION,     // Heavy AI content creation
    INTEGRATION,    // Create drafts/research via other services
    ACTION,         // Pause and wait for user
    TASK_CREATION,  // Create case tasks from workflow templates
    CASE_UPDATE     // Update case status and log activities
}
