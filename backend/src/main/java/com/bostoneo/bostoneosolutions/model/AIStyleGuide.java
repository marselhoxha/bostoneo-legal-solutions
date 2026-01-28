package com.bostoneo.bostoneosolutions.model;

import com.bostoneo.bostoneosolutions.enumeration.CitationStyle;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(NON_DEFAULT)
@Entity
@Table(name = "ai_style_guides")
public class AIStyleGuide {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id")
    private Long organizationId;

    @Column(name = "firm_id")
    private Long firmId;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "rules_json", columnDefinition = "TEXT")
    private String rulesJson;

    @Column(name = "formatting_preferences", columnDefinition = "TEXT")
    private String formattingPreferences;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "citation_style")
    private CitationStyle citationStyle = CitationStyle.BLUEBOOK;

    @Column(name = "terminology_preferences", columnDefinition = "TEXT")
    private String terminologyPreferences;

    @Column(name = "signature_blocks", columnDefinition = "TEXT")
    private String signatureBlocks;

    @Column(name = "letterhead_template", columnDefinition = "TEXT")
    private String letterheadTemplate;

    @Column(name = "footer_template", columnDefinition = "TEXT")
    private String footerTemplate;

    @Column(name = "font_preferences", columnDefinition = "TEXT")
    private String fontPreferences;

    @Column(name = "margin_settings", columnDefinition = "TEXT")
    private String marginSettings;

    @Builder.Default
    @Column(name = "is_default")
    private Boolean isDefault = false;

    @Builder.Default
    @Column(name = "is_active")
    private Boolean isActive = true;

    @Column(name = "created_by")
    private Long createdBy;

    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}