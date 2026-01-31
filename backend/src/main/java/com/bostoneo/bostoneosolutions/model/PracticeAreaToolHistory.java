package com.bostoneo.bostoneosolutions.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.Map;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

/**
 * Entity for storing practice area tool history.
 * Tracks calculations, generated documents, and AI analyses from practice area tools.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "practice_area_tool_history")
public class PracticeAreaToolHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id", nullable = false)
    private Long organizationId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "practice_area", nullable = false, length = 50)
    private String practiceArea;

    @Column(name = "tool_type", nullable = false, length = 50)
    private String toolType;

    @Column(name = "title", length = 255)
    private String title;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "input_data", nullable = false, columnDefinition = "jsonb")
    private Map<String, Object> inputData;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "output_data", columnDefinition = "jsonb")
    private Map<String, Object> outputData;

    @Column(name = "ai_analysis", columnDefinition = "TEXT")
    private String aiAnalysis;

    @Column(name = "case_id")
    private Long caseId;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;
}
