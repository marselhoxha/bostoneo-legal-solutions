package com.bostoneo.bostoneosolutions.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class FrMeta {

    @JsonProperty("total_results")
    private int totalResults;

    @JsonProperty("current_page")
    private int currentPage;

    @JsonProperty("per_page")
    private int perPage;

    @JsonProperty("total_pages")
    private int totalPages;

    @JsonProperty("next_page_url")
    private String nextPageUrl;

    @JsonProperty("previous_page_url")
    private String previousPageUrl;

    @JsonProperty("page_limit")
    private int pageLimit;
}