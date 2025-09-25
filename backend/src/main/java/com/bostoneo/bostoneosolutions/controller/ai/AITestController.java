package com.bostoneo.bostoneosolutions.controller.ai;

import com.bostoneo.bostoneosolutions.service.ai.ClaudeSonnet4Service;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@RestController
@RequestMapping("/api/ai/test")
@RequiredArgsConstructor
@Slf4j
public class AITestController {

    private final ClaudeSonnet4Service claudeService;

    @PostMapping("/generate")
    public CompletableFuture<ResponseEntity<Map<String, Object>>> testGeneration(@RequestBody TestRequest request) {
        log.info("Testing Claude Sonnet 4 with prompt: {}", request.getPrompt());
        
        return claudeService.generateCompletion(request.getPrompt(), false)
                .thenApply(response -> {
                    Map<String, Object> result = new HashMap<>();
                    result.put("success", true);
                    result.put("response", response);
                    result.put("model", "claude-sonnet-4-20250514");
                    return ResponseEntity.ok(result);
                })
                .exceptionally(ex -> {
                    log.error("Error testing Claude Sonnet 4: {}", ex.getMessage(), ex);
                    Map<String, Object> errorResult = new HashMap<>();
                    errorResult.put("success", false);
                    errorResult.put("error", ex.getMessage());
                    return ResponseEntity.status(500).body(errorResult);
                });
    }

    @GetMapping("/simple")
    public CompletableFuture<ResponseEntity<String>> simpleTest() {
        String prompt = "Hello Claude Sonnet 4! Please respond with 'AI integration working successfully' if you can read this.";
        log.info("Testing simple Claude Sonnet 4 integration");
        
        return claudeService.generateCompletion(prompt, false)
                .thenApply(response -> {
                    log.info("Claude Sonnet 4 response: {}", response);
                    return ResponseEntity.ok(response);
                })
                .exceptionally(ex -> {
                    log.error("Error in simple test: {}", ex.getMessage(), ex);
                    return ResponseEntity.status(500).body("Error: " + ex.getMessage());
                });
    }

    public static class TestRequest {
        private String prompt;
        
        public String getPrompt() {
            return prompt;
        }
        
        public void setPrompt(String prompt) {
            this.prompt = prompt;
        }
    }
}