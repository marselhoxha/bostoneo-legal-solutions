package com.bostoneo.bostoneosolutions.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class FrDocument {

    private String id;

    @JsonProperty("document_number")
    private String documentNumber;

    private String title;

    @JsonProperty("abstract")
    private String abstractText;

    @JsonProperty("publication_date")
    private LocalDate publicationDate;

    private String type;

    @JsonProperty("html_url")
    private String htmlUrl;

    @JsonProperty("pdf_url")
    private String pdfUrl;

    @JsonProperty("federal_register_url")
    private String federalRegisterUrl;

    private List<FrAgency> agencies;

    private String source = "Federal Register";

    // Additional fields for our internal use
    private String summary;
    private String documentType;
}