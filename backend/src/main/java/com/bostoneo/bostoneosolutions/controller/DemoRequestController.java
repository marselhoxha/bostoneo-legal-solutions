package com.bostoneo.bostoneosolutions.controller;

import com.bostoneo.bostoneosolutions.dto.DemoRequestDTO;
import com.bostoneo.bostoneosolutions.service.DemoRequestService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/demo-requests")
@RequiredArgsConstructor
@Slf4j
public class DemoRequestController {

    private final DemoRequestService demoRequestService;

    @PostMapping
    public ResponseEntity<Map<String, String>> submitDemoRequest(@RequestBody @Valid DemoRequestDTO dto) {
        log.info("Demo request received from: {} ({})", dto.getName(), dto.getEmail());
        demoRequestService.submitDemoRequest(dto);
        return ResponseEntity.ok(Map.of("message", "Demo request submitted successfully"));
    }
}
