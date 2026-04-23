package com.bostoneo.bostoneosolutions.controller.ai;

import com.bostoneo.bostoneosolutions.dto.ai.PracticeAreaCatalogResponse;
import com.bostoneo.bostoneosolutions.service.ai.PracticeAreaCatalogService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Drives the draft-wizard Step 2 rendering: returns only the doc types that actually
 * have PA-specific template coverage in {@link com.bostoneo.bostoneosolutions.service.ai.DocumentTypeTemplateRegistry}.
 *
 * <p>The catalog is platform-wide (not tenant-scoped) — every organization sees the same
 * PA ↔ doc-type mapping. Org-specific templates live on the separate
 * {@code /api/ai/templates} path (the Template Library).</p>
 */
@Slf4j
@RestController
@RequestMapping("/api/ai/document-types")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ROLE_ADMIN', 'ROLE_SYSADMIN', 'ROLE_MANAGING_PARTNER', 'ROLE_ATTORNEY', 'ROLE_PARALEGAL', 'ROLE_ASSOCIATE')")
public class DocumentCatalogController {

    private final PracticeAreaCatalogService catalogService;

    /**
     * GET /api/ai/document-types?practiceArea=pi&jurisdiction=Massachusetts
     *
     * Returns the 3-tier doc-type catalog for the supplied practice area. When the PA has
     * no template coverage, {@code hasCoverage=false} and the frontend renders a "coming
     * soon" empty state.
     */
    @GetMapping
    public ResponseEntity<PracticeAreaCatalogResponse> getCatalog(
            @RequestParam(name = "practiceArea") String practiceArea,
            @RequestParam(name = "jurisdiction", required = false) String jurisdiction) {

        if (practiceArea == null || practiceArea.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        PracticeAreaCatalogResponse response = catalogService.getCatalog(practiceArea, jurisdiction);
        return ResponseEntity.ok(response);
    }
}
