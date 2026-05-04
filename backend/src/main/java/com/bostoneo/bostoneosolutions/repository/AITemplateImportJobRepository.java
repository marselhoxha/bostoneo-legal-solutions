package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AITemplateImportJob;
import com.bostoneo.bostoneosolutions.model.AITemplateImportJob.Status;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AITemplateImportJobRepository extends JpaRepository<AITemplateImportJob, Long> {

    Optional<AITemplateImportJob> findBySessionId(UUID sessionId);

    /** Active + recently-finished jobs for the user, used by the indicator badge. */
    List<AITemplateImportJob> findTop20ByUserIdOrderByStartedAtDesc(Long userId);

    /** Just the in-flight jobs for the seed-on-app-boot path. */
    List<AITemplateImportJob> findByUserIdAndStatusInOrderByStartedAtDesc(Long userId, Collection<Status> statuses);
}
