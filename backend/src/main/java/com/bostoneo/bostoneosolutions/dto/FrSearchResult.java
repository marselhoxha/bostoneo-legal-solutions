package com.bostoneo.bostoneosolutions.dto;

import lombok.Data;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class FrSearchResult {

    private List<FrDocument> results;

    private FrMeta meta;

    private int count;

    private String description;

    private String nextPageUrl;

    private String previousPageUrl;
}