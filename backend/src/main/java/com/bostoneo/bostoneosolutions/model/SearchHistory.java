package com.bostoneo.bostoneosolutions.model;

import com.bostoneo.bostoneosolutions.enumeration.QueryType;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "search_history")
public class SearchHistory {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "search_query", nullable = false, columnDefinition = "TEXT")
    private String searchQuery;

    @Enumerated(EnumType.STRING)
    @Column(name = "query_type")
    private QueryType queryType;

    @Column(name = "search_filters", columnDefinition = "jsonb")
    private String searchFilters;

    @Column(name = "results_count")
    private Integer resultsCount;

    @Column(name = "execution_time_ms")
    private Long executionTimeMs;

    @Builder.Default
    @Column(name = "is_saved")
    private Boolean isSaved = false;

    @Column(name = "session_id")
    private String sessionId;

    @CreationTimestamp
    @Column(name = "searched_at")
    private LocalDateTime searchedAt;
}