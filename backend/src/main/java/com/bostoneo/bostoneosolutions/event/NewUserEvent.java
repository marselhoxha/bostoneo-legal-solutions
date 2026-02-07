package com.bostoneo.bostoneosolutions.event;

import com.bostoneo.bostoneosolutions.enumeration.EventType;
import lombok.Getter;
import lombok.Setter;
import org.springframework.context.ApplicationEvent;

@Getter
@Setter
public class NewUserEvent extends ApplicationEvent {
    private EventType type;
    private String email;
    // SECURITY: Required for multi-tenant data isolation
    private Long organizationId;
    // Captured from request thread for async processing
    private String device;
    private String ipAddress;

    public NewUserEvent(String email, EventType type) {
        super(email);
        this.type = type;
        this.email = email;
    }

    public NewUserEvent(String email, EventType type, Long organizationId) {
        super(email);
        this.type = type;
        this.email = email;
        this.organizationId = organizationId;
    }

    public NewUserEvent(String email, EventType type, Long organizationId, String device, String ipAddress) {
        super(email);
        this.type = type;
        this.email = email;
        this.organizationId = organizationId;
        this.device = device;
        this.ipAddress = ipAddress;
    }
}
