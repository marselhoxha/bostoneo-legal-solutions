package com.bostoneo.bostoneosolutions.service.implementation;

import com.bostoneo.bostoneosolutions.dto.UserPreferenceDTO;
import com.bostoneo.bostoneosolutions.model.UserPreference;
import com.bostoneo.bostoneosolutions.repository.UserPreferenceRepository;
import com.bostoneo.bostoneosolutions.service.UserPreferenceService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserPreferenceServiceImpl implements UserPreferenceService {

    private final UserPreferenceRepository repo;

    @Override
    public UserPreferenceDTO getMyPreferences(Long userId, Long organizationId) {
        UserPreference pref = repo.findByUserIdAndOrganizationId(userId, organizationId)
            .orElseGet(() -> create(userId, organizationId));
        return toDTO(pref);
    }

    @Override
    @Transactional
    public UserPreferenceDTO updateMyPreferences(Long userId, Long organizationId, UserPreferenceDTO request) {
        UserPreference pref = repo.findByUserIdAndOrganizationId(userId, organizationId)
            .orElseGet(() -> create(userId, organizationId));
        if (request.getPreferredViewTasks() != null) pref.setPreferredViewTasks(request.getPreferredViewTasks());
        if (request.getPreferredLayoutCalendar() != null) pref.setPreferredLayoutCalendar(request.getPreferredLayoutCalendar());
        return toDTO(repo.save(pref));
    }

    private UserPreference create(Long userId, Long organizationId) {
        UserPreference pref = UserPreference.builder()
            .userId(userId)
            .organizationId(organizationId)
            .build();
        return repo.save(pref);
    }

    private UserPreferenceDTO toDTO(UserPreference p) {
        return new UserPreferenceDTO(p.getPreferredViewTasks(), p.getPreferredLayoutCalendar());
    }
}
