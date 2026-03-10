package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.exception.ApiException;
import com.bostoneo.bostoneosolutions.model.AiWorkspaceDocumentExhibit;
import com.bostoneo.bostoneosolutions.rowmapper.AiWorkspaceDocumentExhibitRowMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

import static java.util.Objects.requireNonNull;

@Repository
@RequiredArgsConstructor
@Slf4j
public class AiWorkspaceDocumentExhibitRepository {

    private final NamedParameterJdbcTemplate jdbc;
    private final AiWorkspaceDocumentExhibitRowMapper rowMapper = new AiWorkspaceDocumentExhibitRowMapper();

    // SQL queries
    private static final String FIND_BY_DOCUMENT_AND_ORG =
        "SELECT * FROM ai_workspace_document_exhibits " +
        "WHERE document_id = :documentId AND organization_id = :orgId " +
        "ORDER BY display_order ASC, label ASC";

    private static final String FIND_BY_ID_AND_ORG =
        "SELECT * FROM ai_workspace_document_exhibits " +
        "WHERE id = :id AND organization_id = :orgId";

    private static final String INSERT_EXHIBIT =
        "INSERT INTO ai_workspace_document_exhibits " +
        "(document_id, organization_id, case_document_id, label, display_order, " +
        "file_name, file_path, mime_type, file_size, extracted_text, " +
        "text_extraction_status, page_count, created_at, updated_at) " +
        "VALUES (:documentId, :orgId, :caseDocId, :label, :displayOrder, " +
        ":fileName, :filePath, :mimeType, :fileSize, :extractedText, " +
        ":status, :pageCount, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)";

    private static final String DELETE_BY_ID_AND_ORG =
        "DELETE FROM ai_workspace_document_exhibits " +
        "WHERE id = :id AND organization_id = :orgId";

    private static final String UPDATE_EXTRACTED_TEXT =
        "UPDATE ai_workspace_document_exhibits " +
        "SET extracted_text = :text, text_extraction_status = :status, " +
        "page_count = :pageCount, updated_at = CURRENT_TIMESTAMP " +
        "WHERE id = :id AND organization_id = :orgId";

    private static final String COUNT_BY_DOCUMENT_AND_ORG =
        "SELECT COUNT(*) FROM ai_workspace_document_exhibits " +
        "WHERE document_id = :documentId AND organization_id = :orgId";

    private static final String UPDATE_DISPLAY_ORDER =
        "UPDATE ai_workspace_document_exhibits " +
        "SET display_order = :displayOrder, updated_at = CURRENT_TIMESTAMP " +
        "WHERE id = :id AND organization_id = :orgId";

    private static final String DELETE_STALE_EXHIBITS =
        "DELETE FROM ai_workspace_document_exhibits e " +
        "WHERE e.document_id = :documentId AND e.organization_id = :orgId " +
        "AND e.case_document_id IS NOT NULL " +
        "AND NOT EXISTS (" +
        "  SELECT 1 FROM file_items fi " +
        "  WHERE fi.id = e.case_document_id AND fi.is_deleted = false AND fi.organization_id = :orgId" +
        ")";

    /**
     * Find all exhibits for a document within an organization.
     */
    public List<AiWorkspaceDocumentExhibit> findByDocumentIdAndOrgId(Long documentId, Long orgId) {
        log.debug("Finding exhibits for document {} in org {}", documentId, orgId);
        try {
            MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("documentId", documentId)
                .addValue("orgId", orgId);
            return jdbc.query(FIND_BY_DOCUMENT_AND_ORG, params, rowMapper);
        } catch (Exception e) {
            log.error("Error finding exhibits for document {}: {}", documentId, e.getMessage());
            throw new ApiException("Error retrieving exhibits");
        }
    }

    /**
     * Find a single exhibit by ID with tenant isolation.
     */
    public Optional<AiWorkspaceDocumentExhibit> findById(Long id, Long orgId) {
        log.debug("Finding exhibit {} in org {}", id, orgId);
        try {
            MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("id", id)
                .addValue("orgId", orgId);
            AiWorkspaceDocumentExhibit exhibit = jdbc.queryForObject(FIND_BY_ID_AND_ORG, params, rowMapper);
            return Optional.ofNullable(exhibit);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        } catch (Exception e) {
            log.error("Error finding exhibit {}: {}", id, e.getMessage());
            throw new ApiException("Error retrieving exhibit");
        }
    }

    /**
     * Save a new exhibit. Returns the exhibit with its generated ID.
     */
    public AiWorkspaceDocumentExhibit save(AiWorkspaceDocumentExhibit exhibit) {
        log.debug("Saving exhibit '{}' for document {}", exhibit.getLabel(), exhibit.getDocumentId());
        try {
            KeyHolder keyHolder = new GeneratedKeyHolder();
            MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("documentId", exhibit.getDocumentId())
                .addValue("orgId", exhibit.getOrganizationId())
                .addValue("caseDocId", exhibit.getCaseDocumentId())
                .addValue("label", exhibit.getLabel())
                .addValue("displayOrder", exhibit.getDisplayOrder())
                .addValue("fileName", exhibit.getFileName())
                .addValue("filePath", exhibit.getFilePath())
                .addValue("mimeType", exhibit.getMimeType())
                .addValue("fileSize", exhibit.getFileSize())
                .addValue("extractedText", exhibit.getExtractedText())
                .addValue("status", exhibit.getTextExtractionStatus())
                .addValue("pageCount", exhibit.getPageCount());

            jdbc.update(INSERT_EXHIBIT, params, keyHolder, new String[]{"id"});
            exhibit.setId(requireNonNull(keyHolder.getKey()).longValue());
            return exhibit;
        } catch (Exception e) {
            log.error("Error saving exhibit: {}", e.getMessage());
            throw new ApiException("Error saving exhibit");
        }
    }

    /**
     * Delete an exhibit by ID with tenant isolation.
     */
    public void deleteById(Long id, Long orgId) {
        log.debug("Deleting exhibit {} in org {}", id, orgId);
        try {
            MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("id", id)
                .addValue("orgId", orgId);
            int rowsAffected = jdbc.update(DELETE_BY_ID_AND_ORG, params);
            if (rowsAffected == 0) {
                throw new ApiException("Exhibit not found or access denied");
            }
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error deleting exhibit {}: {}", id, e.getMessage());
            throw new ApiException("Error deleting exhibit");
        }
    }

    /**
     * Update extracted text, status, and page count after text extraction completes.
     */
    public void updateExtractedText(Long id, String text, String status, int pageCount, Long orgId) {
        log.debug("Updating extracted text for exhibit {} (status: {})", id, status);
        try {
            MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("id", id)
                .addValue("text", text)
                .addValue("status", status)
                .addValue("pageCount", pageCount)
                .addValue("orgId", orgId);
            int rowsAffected = jdbc.update(UPDATE_EXTRACTED_TEXT, params);
            if (rowsAffected == 0) {
                throw new ApiException("Exhibit not found or access denied");
            }
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error updating extracted text for exhibit {}: {}", id, e.getMessage());
            throw new ApiException("Error updating exhibit text extraction");
        }
    }

    /**
     * Get the next exhibit label (A, B, C... Z, AA, AB...) for a document.
     */
    public String getNextLabel(Long documentId, Long orgId) {
        log.debug("Getting next label for document {} in org {}", documentId, orgId);
        try {
            MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("documentId", documentId)
                .addValue("orgId", orgId);
            int count = jdbc.queryForObject(COUNT_BY_DOCUMENT_AND_ORG, params, Integer.class);
            return toExhibitLabel(count);
        } catch (Exception e) {
            log.error("Error getting next label for document {}: {}", documentId, e.getMessage());
            throw new ApiException("Error determining next exhibit label");
        }
    }

    /**
     * Update the display order of an exhibit.
     */
    public void updateDisplayOrder(Long id, int order, Long orgId) {
        log.debug("Updating display order for exhibit {} to {}", id, order);
        try {
            MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("id", id)
                .addValue("displayOrder", order)
                .addValue("orgId", orgId);
            int rowsAffected = jdbc.update(UPDATE_DISPLAY_ORDER, params);
            if (rowsAffected == 0) {
                throw new ApiException("Exhibit not found or access denied");
            }
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            log.error("Error updating display order for exhibit {}: {}", id, e.getMessage());
            throw new ApiException("Error updating exhibit display order");
        }
    }

    /**
     * Delete stale exhibits whose source file_items have been soft-deleted.
     * Only affects exhibits linked to case documents (case_document_id IS NOT NULL).
     */
    public int deleteStaleExhibits(Long documentId, Long orgId) {
        log.debug("Deleting stale exhibits for document {} in org {}", documentId, orgId);
        try {
            MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("documentId", documentId)
                .addValue("orgId", orgId);
            int deleted = jdbc.update(DELETE_STALE_EXHIBITS, params);
            if (deleted > 0) {
                log.info("Deleted {} stale exhibits for document {} in org {}", deleted, documentId, orgId);
            }
            return deleted;
        } catch (Exception e) {
            log.error("Error deleting stale exhibits for document {}: {}", documentId, e.getMessage());
            return 0;
        }
    }

    /**
     * Convert a 0-based count to an exhibit label.
     * 0 -> A, 1 -> B, ... 25 -> Z, 26 -> AA, 27 -> AB, etc.
     */
    private String toExhibitLabel(int index) {
        StringBuilder label = new StringBuilder();
        int remaining = index;
        do {
            label.insert(0, (char) ('A' + (remaining % 26)));
            remaining = (remaining / 26) - 1;
        } while (remaining >= 0);
        return label.toString();
    }
}
