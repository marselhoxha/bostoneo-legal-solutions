package com.bostoneo.bostoneosolutions.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;

import java.util.Date;

import static com.fasterxml.jackson.annotation.JsonInclude.Include.NON_DEFAULT;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(NON_DEFAULT)
public class ReceiptDTO {
    private Long id;
    private String fileName;
    private String contentType;
    private Long fileSize;
    private String thumbnailBase64;
    private Date createdAt;
    private Date updatedAt;
} 