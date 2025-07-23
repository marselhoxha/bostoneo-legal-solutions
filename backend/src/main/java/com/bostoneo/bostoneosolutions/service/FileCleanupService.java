package com.***REMOVED***.***REMOVED***solutions.service;

import com.***REMOVED***.***REMOVED***solutions.model.FileItem;
import com.***REMOVED***.***REMOVED***solutions.repository.FileItemRepository;
import com.***REMOVED***.***REMOVED***solutions.service.FileStorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class FileCleanupService {

    private final FileItemRepository fileItemRepository;
    private final FileStorageService fileStorageService;

    @Value("${app.file-cleanup.retention-days:30}")
    private int retentionDays;

    @Value("${app.file-cleanup.enabled:true}")
    private boolean cleanupEnabled;

    @Value("${app.file-cleanup.batch-size:100}")
    private int batchSize;

    /**
     * Scheduled cleanup task that runs daily at 2 AM
     * Permanently deletes files that have been soft-deleted for more than the retention period
     */
    @Scheduled(cron = "${app.file-cleanup.cron:0 0 2 * * ?}")
    @Transactional
    public void cleanupOldDeletedFiles() {
        if (!cleanupEnabled) {
            log.debug("File cleanup is disabled");
            return;
        }

        LocalDateTime cutoffDate = LocalDateTime.now().minusDays(retentionDays);
        log.info("Starting automatic cleanup of files deleted before: {}", cutoffDate);

        try {
            List<FileItem> filesToDelete = fileItemRepository.findDeletedFilesOlderThan(cutoffDate);
            
            if (filesToDelete.isEmpty()) {
                log.info("No files found for cleanup");
                return;
            }

            log.info("Found {} files to permanently delete", filesToDelete.size());

            int deletedCount = 0;
            int failedCount = 0;

            // Process files in batches to avoid memory issues
            for (int i = 0; i < filesToDelete.size(); i += batchSize) {
                int endIndex = Math.min(i + batchSize, filesToDelete.size());
                List<FileItem> batch = filesToDelete.subList(i, endIndex);
                
                for (FileItem fileItem : batch) {
                    try {
                        permanentlyDeleteFile(fileItem);
                        deletedCount++;
                    } catch (Exception e) {
                        log.error("Failed to permanently delete file {}: {}", fileItem.getId(), e.getMessage());
                        failedCount++;
                    }
                }
                
                // Small delay between batches to reduce system load
                try {
                    Thread.sleep(100);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    log.warn("Cleanup interrupted");
                    break;
                }
            }

            log.info("Cleanup completed. Successfully deleted: {}, Failed: {}", deletedCount, failedCount);

        } catch (Exception e) {
            log.error("Error during automatic file cleanup: {}", e.getMessage(), e);
        }
    }

    /**
     * Permanently delete a single file
     */
    private void permanentlyDeleteFile(FileItem fileItem) {
        String filePath = fileItem.getFilePath();
        Long fileId = fileItem.getId();

        // Delete from database first
        fileItemRepository.delete(fileItem);

        // Then try to delete physical file
        try {
            if (filePath != null) {
                fileStorageService.deleteFile(filePath);
                log.debug("Physical file deleted: {}", filePath);
            }
        } catch (Exception e) {
            log.warn("Failed to delete physical file {} for record {}: {}", filePath, fileId, e.getMessage());
            // Don't re-throw - database record is already deleted
        }
    }

    /**
     * Manual cleanup method for immediate execution
     */
    public CleanupResult performManualCleanup() {
        LocalDateTime cutoffDate = LocalDateTime.now().minusDays(retentionDays);
        log.info("Starting manual cleanup of files deleted before: {}", cutoffDate);

        List<FileItem> filesToDelete = fileItemRepository.findDeletedFilesOlderThan(cutoffDate);
        
        int deletedCount = 0;
        int failedCount = 0;

        for (FileItem fileItem : filesToDelete) {
            try {
                permanentlyDeleteFile(fileItem);
                deletedCount++;
            } catch (Exception e) {
                log.error("Failed to permanently delete file {}: {}", fileItem.getId(), e.getMessage());
                failedCount++;
            }
        }

        CleanupResult result = new CleanupResult(deletedCount, failedCount, cutoffDate);
        log.info("Manual cleanup completed: {}", result);
        return result;
    }

    /**
     * Get count of files that would be cleaned up
     */
    public int getCleanupCandidatesCount() {
        LocalDateTime cutoffDate = LocalDateTime.now().minusDays(retentionDays);
        return fileItemRepository.findDeletedFilesOlderThan(cutoffDate).size();
    }

    /**
     * Result of cleanup operation
     */
    public static class CleanupResult {
        private final int deletedCount;
        private final int failedCount;
        private final LocalDateTime cutoffDate;

        public CleanupResult(int deletedCount, int failedCount, LocalDateTime cutoffDate) {
            this.deletedCount = deletedCount;
            this.failedCount = failedCount;
            this.cutoffDate = cutoffDate;
        }

        public int getDeletedCount() { return deletedCount; }
        public int getFailedCount() { return failedCount; }
        public LocalDateTime getCutoffDate() { return cutoffDate; }

        @Override
        public String toString() {
            return String.format("CleanupResult{deleted=%d, failed=%d, cutoffDate=%s}", 
                    deletedCount, failedCount, cutoffDate);
        }
    }
}