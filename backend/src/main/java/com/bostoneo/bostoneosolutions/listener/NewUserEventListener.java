package com.***REMOVED***.***REMOVED***solutions.listener;

import com.***REMOVED***.***REMOVED***solutions.service.EventService;
import com.***REMOVED***.***REMOVED***solutions.event.NewUserEvent;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import static com.***REMOVED***.***REMOVED***solutions.utils.RequestUtils.getDevice;
import static com.***REMOVED***.***REMOVED***solutions.utils.RequestUtils.getIpAddress;

@Component
@RequiredArgsConstructor
@Slf4j
public class NewUserEventListener {
    private final EventService eventService;
    private final HttpServletRequest request;

    @EventListener
    public void onNewUserEvent(NewUserEvent event) {
        log.info("New user event is fired: {}", event);
        eventService.addUserEvent(event.getEmail(), event.getType(), getDevice(request), getIpAddress(request));
    }
}
