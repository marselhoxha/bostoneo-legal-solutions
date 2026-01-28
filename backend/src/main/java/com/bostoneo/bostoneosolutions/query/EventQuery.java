package com.bostoneo.bostoneosolutions.query;

public class EventQuery {
    // ==================== DEPRECATED QUERIES (no tenant filtering) ====================
    /**
     * @deprecated Use SELECT_EVENTS_BY_USER_ID_AND_ORG_QUERY for tenant isolation
     */
    @Deprecated
    public static final String SELECT_EVENTS_BY_USER_ID_QUERY = "SELECT uev.id, uev.device, uev.ip_address, ev.type, ev.description, uev.created_at FROM events ev JOIN user_events uev ON ev.id = uev.event_id JOIN users u ON u.id = uev.user_id WHERE u.id = :id ORDER BY uev.created_at DESC LIMIT 5";

    /**
     * @deprecated Use INSERT_EVENT_BY_USER_EMAIL_WITH_ORG_QUERY for tenant isolation
     */
    @Deprecated
    public static final String INSERT_EVENT_BY_USER_EMAIL_QUERY = "INSERT INTO user_events (user_id, event_id, device, ip_address) VALUES ((SELECT id FROM users WHERE email = :email), (SELECT id FROM events WHERE type = :type), :device, :ipAddress)";

    // ==================== TENANT-FILTERED QUERIES ====================
    // SECURITY: Always use these queries for proper multi-tenant isolation.

    /**
     * SECURITY: Select events for a user within their organization
     */
    public static final String SELECT_EVENTS_BY_USER_ID_AND_ORG_QUERY =
            "SELECT uev.id, uev.organization_id, uev.device, uev.ip_address, ev.type, ev.description, uev.created_at " +
            "FROM events ev JOIN user_events uev ON ev.id = uev.event_id JOIN users u ON u.id = uev.user_id " +
            "WHERE u.id = :id AND uev.organization_id = :organizationId " +
            "ORDER BY uev.created_at DESC LIMIT 5";

    /**
     * SECURITY: Insert event for a user with organization context (by email)
     */
    public static final String INSERT_EVENT_BY_USER_EMAIL_WITH_ORG_QUERY =
            "INSERT INTO user_events (user_id, event_id, device, ip_address, organization_id) " +
            "VALUES ((SELECT id FROM users WHERE email = :email AND organization_id = :organizationId), " +
            "(SELECT id FROM events WHERE type = :type), :device, :ipAddress, :organizationId)";

    /**
     * SECURITY: Insert event for a user with organization context (by userId)
     */
    public static final String INSERT_EVENT_BY_USER_ID_WITH_ORG_QUERY =
            "INSERT INTO user_events (user_id, event_id, device, ip_address, organization_id) " +
            "VALUES (:userId, (SELECT id FROM events WHERE type = :type), :device, :ipAddress, :organizationId)";
}
