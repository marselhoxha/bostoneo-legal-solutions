package com.bostoneo.bostoneosolutions.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class TaskCommentDTO {
    private Long id;
    private Long taskId;
    private String taskTitle;
    private Long userId;
    private String userName;
    private String userEmail;
    private String comment;
    private String attachmentUrl;
    private boolean internal;
    private LocalDateTime createdAt;
} 