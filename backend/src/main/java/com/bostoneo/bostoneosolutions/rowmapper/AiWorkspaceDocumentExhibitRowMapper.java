package com.bostoneo.bostoneosolutions.rowmapper;

import com.bostoneo.bostoneosolutions.model.AiWorkspaceDocumentExhibit;
import org.springframework.jdbc.core.RowMapper;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;

public class AiWorkspaceDocumentExhibitRowMapper implements RowMapper<AiWorkspaceDocumentExhibit> {

    @Override
    public AiWorkspaceDocumentExhibit mapRow(ResultSet rs, int rowNum) throws SQLException {
        Timestamp createdAtTs = rs.getTimestamp("created_at");
        Timestamp updatedAtTs = rs.getTimestamp("updated_at");

        Long caseDocumentId = rs.getLong("case_document_id");
        if (rs.wasNull()) {
            caseDocumentId = null;
        }

        Long fileSize = rs.getLong("file_size");
        if (rs.wasNull()) {
            fileSize = null;
        }

        Integer pageCount = rs.getInt("page_count");
        if (rs.wasNull()) {
            pageCount = null;
        }

        return AiWorkspaceDocumentExhibit.builder()
                .id(rs.getLong("id"))
                .documentId(rs.getLong("document_id"))
                .organizationId(rs.getLong("organization_id"))
                .caseDocumentId(caseDocumentId)
                .label(rs.getString("label"))
                .displayOrder(rs.getInt("display_order"))
                .fileName(rs.getString("file_name"))
                .filePath(rs.getString("file_path"))
                .mimeType(rs.getString("mime_type"))
                .fileSize(fileSize)
                .extractedText(rs.getString("extracted_text"))
                .textExtractionStatus(rs.getString("text_extraction_status"))
                .pageCount(pageCount)
                .createdAt(createdAtTs != null ? createdAtTs.toLocalDateTime() : null)
                .updatedAt(updatedAtTs != null ? updatedAtTs.toLocalDateTime() : null)
                .build();
    }
}
