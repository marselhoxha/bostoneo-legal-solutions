package com.***REMOVED***.***REMOVED***solutions.dto.filemanager;

import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FileManagerStatsDTO {
    private Integer totalFiles;
    private Integer totalFolders;
    private Long totalSize;
    private Long totalStorageSize;
    private String formattedTotalSize;
    private Long usedSpace;
    private Long availableSpace;
    private Double usagePercentage;
    private Map<String, StorageTypeStatsDTO> storageByType;
    private List<FileItemDTO> recentFiles;
    private List<FileItemDTO> starredFiles;
}

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
class StorageTypeStatsDTO {
    private String type;
    private Long size;
    private String formattedSize;
    private Integer count;
    private Double percentage;
    private String color;
}