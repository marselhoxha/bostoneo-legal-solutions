package com.bostoneo.bostoneosolutions.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserPreferenceDTO {
    private String preferredViewTasks;       // null => use role default
    private String preferredLayoutCalendar;  // null => "classic" default
}
