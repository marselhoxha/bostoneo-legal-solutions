package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AdverseParty;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AdversePartyRepository extends JpaRepository<AdverseParty, Long> {

    List<AdverseParty> findByOrganizationIdAndCaseId(Long organizationId, Long caseId);

    List<AdverseParty> findByOrganizationId(Long organizationId);
}
