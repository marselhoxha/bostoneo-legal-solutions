package com.bostoneo.bostoneosolutions.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Attorney's per-file accept/reject/overwrite decisions for a template import session.
 * Sent to the commit endpoint after the review step.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ImportCommitRequest {

    private List<FileDecision> decisions;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FileDecision {
        public enum Action { IMPORT, SKIP, OVERWRITE }

        private String fileId;            // matches ImportSessionResponse.FileStatus.fileId
        private Action action;
        private String templateName;      // optional override of Claude's suggestion
        private String templateDescription;
        private String category;          // TemplateCategory enum name (optional override)
        private String practiceArea;      // slug override
        private String jurisdiction;      // ISO state code or full name
        private Boolean isPrivate;        // marks this template as private to the uploader
        private Map<String, String> variableRenames; // old_key → new_key for accepted variables
        private List<String> rejectedVariableKeys;   // variable keys to NOT persist
        private Long overwriteTemplateId;            // required when action == OVERWRITE
    }
}
