package com.bostoneo.bostoneosolutions.utils;

import jakarta.servlet.http.HttpServletRequest;
import nl.basjes.parse.useragent.UserAgent;
import nl.basjes.parse.useragent.UserAgentAnalyzer;

import static nl.basjes.parse.useragent.UserAgent.AGENT_NAME;
import static nl.basjes.parse.useragent.UserAgent.DEVICE_NAME;

public class RequestUtils {
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
        UserAgentAnalyzer userAgentAnalyzer = UserAgentAnalyzer.newBuilder().hideMatcherLoadStats().withCache(1000).build();
        UserAgent agent = userAgentAnalyzer.parse(request.getHeader("user-agent"));
        //return agent.getValue(OPERATING_SYSTEM_NAME) + " - " + agent.getValue(AGENT_NAME) + " - " + agent.getValue(DEVICE_NAME);
        return agent.getValue(AGENT_NAME) + " - " + agent.getValue(DEVICE_NAME);
    }
}
