package com.bostoneo.bostoneosolutions.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class FrAgency {

    private Integer id;

    private String name;

    @JsonProperty("short_name")
    private String shortName;

    private String slug;

    private String url;
}