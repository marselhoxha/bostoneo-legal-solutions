package com.bostoneo.bostoneosolutions.service;

import com.bostoneo.bostoneosolutions.dto.UserPreferenceDTO;

public interface UserPreferenceService {
    UserPreferenceDTO getMyPreferences(Long userId, Long organizationId);
    UserPreferenceDTO updateMyPreferences(Long userId, Long organizationId, UserPreferenceDTO request);
}
