package com.bostoneo.bostoneosolutions.enumeration;

/**
 * The plaintiff's role at the time of the incident in a Personal Injury case.
 *
 * Drives liability narrative, comparative-negligence analysis, and demand
 * letter framing. Captured at intake or auto-extracted from the ED note
 * by AI when records are uploaded.
 */
public enum PlaintiffRole {
    DRIVER,
    PASSENGER,
    PEDESTRIAN,
    CYCLIST,
    BYSTANDER,
    OTHER
}
