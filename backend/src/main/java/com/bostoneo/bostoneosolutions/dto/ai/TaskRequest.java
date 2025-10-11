package com.bostoneo.bostoneosolutions.dto.ai;

import com.bostoneo.bostoneosolutions.model.ResearchActionItem.TaskPriority;
import lombok.Data;

@Data
public class TaskRequest {
    private String description;
    private TaskPriority priority;
}
