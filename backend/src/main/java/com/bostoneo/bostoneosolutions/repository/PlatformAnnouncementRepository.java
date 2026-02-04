package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.PlatformAnnouncement;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PlatformAnnouncementRepository extends JpaRepository<PlatformAnnouncement, Long> {

    Page<PlatformAnnouncement> findAllByOrderByCreatedAtDesc(Pageable pageable);

    Page<PlatformAnnouncement> findByTypeOrderByCreatedAtDesc(String type, Pageable pageable);
}
