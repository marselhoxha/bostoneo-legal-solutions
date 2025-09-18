package com.bostoneo.bostoneosolutions.dto.ai;

import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class AIResponse {
    private String id;
    private String type;
    private String role;
    private Content[] content;
    private String model;
    private Usage usage;
    
    @Data
    @NoArgsConstructor
    public static class Content {
        private String type;
        private String text;
    }
    
    @Data
    @NoArgsConstructor
    public static class Usage {
        private int input_tokens;
        private int output_tokens;
    }
}