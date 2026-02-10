package com.bostoneo.bostoneosolutions.utils;

import jakarta.servlet.http.HttpServletRequest;
import nl.basjes.parse.useragent.UserAgent;
import nl.basjes.parse.useragent.UserAgentAnalyzer;

import static nl.basjes.parse.useragent.UserAgent.AGENT_NAME;
import static nl.basjes.parse.useragent.UserAgent.DEVICE_NAME;

public class RequestUtils {
    // Singleton — Yauaa loads ~1000 regex rules on build(), so never create per-request
    private static final UserAgentAnalyzer USER_AGENT_ANALYZER =
            UserAgentAnalyzer.newBuilder().hideMatcherLoadStats().withCache(1000).build();

    public static String getIpAddress(HttpServletRequest request) {
        String ipAddress = "Unknown IP";
        if(request != null) {
            ipAddress = request.getHeader("X-FORWARDED-FOR");
            if(ipAddress == null || "".equals(ipAddress)) {
                ipAddress = request.getRemoteAddr();
            }
        }
        return ipAddress;
    }

    public static String getDevice(HttpServletRequest request) {
        return getDevice(request.getHeader("user-agent"));
    }

    public static String getDevice(String userAgentString) {
        UserAgent agent = USER_AGENT_ANALYZER.parse(userAgentString);
        return agent.getValue(AGENT_NAME) + " - " + agent.getValue(DEVICE_NAME);
    }
}
