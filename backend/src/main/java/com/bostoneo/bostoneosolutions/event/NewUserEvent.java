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
}
