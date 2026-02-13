package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.FileItemTextCache;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FileItemTextCacheRepository extends JpaRepository<FileItemTextCache, Long> {

    Optional<FileItemTextCache> findByFileItemIdAndOrganizationId(Long fileItemId, Long organizationId);

    List<FileItemTextCache> findByFileItemIdInAndOrganizationId(List<Long> fileItemIds, Long organizationId);
}
