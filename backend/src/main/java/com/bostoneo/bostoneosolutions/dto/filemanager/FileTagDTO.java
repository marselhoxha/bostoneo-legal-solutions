package com.bostoneo.bostoneosolutions.dto.filemanager;

import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FileTagDTO {
    private Long id;
    private String name;
    private String color;
    private Integer fileCount;
}