package com.bostoneo.bostoneosolutions.listener;

import com.bostoneo.bostoneosolutions.multitenancy.TenantContext;
import com.bostoneo.bostoneosolutions.service.EventService;
import com.bostoneo.bostoneosolutions.event.NewUserEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class NewUserEventListener {
    private final EventService eventService;

    @Async
    @EventListener
    public void onNewUserEvent(NewUserEvent event) {
        log.info("New user event is fired (async): {}", event);

        // Use device/IP pre-captured from the request thread
        String device = event.getDevice() != null ? event.getDevice() : "Unknown";
        String ipAddress = event.getIpAddress() != null ? event.getIpAddress() : "Unknown";

        // SECURITY: Set tenant context if organizationId is provided in the event
        Long orgId = event.getOrganizationId();
        if (orgId != null) {
            TenantContext.setCurrentTenant(orgId);
            try {
                eventService.addUserEvent(event.getEmail(), event.getType(), device, ipAddress);
            } finally {
                TenantContext.clear();
            }
        } else {
            eventService.addUserEvent(event.getEmail(), event.getType(), device, ipAddress);
        }
    }
}
