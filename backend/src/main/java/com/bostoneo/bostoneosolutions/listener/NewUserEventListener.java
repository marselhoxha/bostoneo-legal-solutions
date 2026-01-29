package com.bostoneo.bostoneosolutions.listener;

import com.bostoneo.bostoneosolutions.multitenancy.TenantContext;
import com.bostoneo.bostoneosolutions.service.EventService;
import com.bostoneo.bostoneosolutions.event.NewUserEvent;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import static com.bostoneo.bostoneosolutions.utils.RequestUtils.getDevice;
import static com.bostoneo.bostoneosolutions.utils.RequestUtils.getIpAddress;

@Component
@RequiredArgsConstructor
@Slf4j
public class NewUserEventListener {
    private final EventService eventService;
    private final HttpServletRequest request;

    @EventListener
    public void onNewUserEvent(NewUserEvent event) {
        log.info("New user event is fired: {}", event);

        // SECURITY: Set tenant context if organizationId is provided in the event
        Long orgId = event.getOrganizationId();
        if (orgId != null) {
            TenantContext.setCurrentTenant(orgId);
            try {
                eventService.addUserEvent(event.getEmail(), event.getType(), getDevice(request), getIpAddress(request));
            } finally {
                // Clear context after processing to prevent leaks
                TenantContext.clear();
            }
        } else {
            // Fallback: use existing context if available
            eventService.addUserEvent(event.getEmail(), event.getType(), getDevice(request), getIpAddress(request));
        }
    }
}
