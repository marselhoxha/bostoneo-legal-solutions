package com.bostoneo.bostoneosolutions.dto.ai;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * Attorney's live review decisions for a single file, replayed against the cached
 * original bytes to refresh the binary preview. Used only during review — final
 * persistence flows through {@link ImportCommitRequest.FileDecision}.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RetokenizeRequest {

    /** Variable keys the attorney has unchecked — excluded from the replacement set. */
    private List<String> rejectedVariableKeys;

    /** Accepted variable renames (old_key → new_key). The new key drives the {{token}} in the transformed bytes. */
    private Map<String, String> variableRenames;
}
