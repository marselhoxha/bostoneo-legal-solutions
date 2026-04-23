package com.bostoneo.bostoneosolutions.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

/**
 * Outcome of an import-commit operation: how many templates were created,
 * skipped, overwritten, or failed, plus the batch id the attorney can reference later.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ImportCommitResponse {

    private UUID importBatchId;
    private int created;
    private int skipped;
    private int overwritten;
    private int failed;
    private List<Long> createdTemplateIds;
    private List<String> failures;
}
