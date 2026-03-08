package com.bostoneo.bostoneosolutions.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DocumentTypeTemplate {
    private String type;              // e.g. "demand_letter"
    private List<String> aliases;     // e.g. ["demand"]
    private String displayName;       // e.g. "Demand Letter"
    private String category;          // "letter" | "pleading" | "contract" | "discovery"
    private String citationLevel;     // "NONE" | "MINIMAL" | "COMPREHENSIVE"
    private String template;          // Full structural template text
    private String hints;             // Shorter fallback hints for prompt enhancer
}
