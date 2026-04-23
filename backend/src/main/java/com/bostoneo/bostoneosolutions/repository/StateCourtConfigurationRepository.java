package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.StateCourtConfiguration;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StateCourtConfigurationRepository extends JpaRepository<StateCourtConfiguration, Long> {

    Optional<StateCourtConfiguration> findByStateCodeAndCourtLevelAndIsActiveTrue(String stateCode, String courtLevel);

    Optional<StateCourtConfiguration> findByStateCodeAndCourtLevel(String stateCode, String courtLevel);

    List<StateCourtConfiguration> findByStateCodeAndIsActiveTrue(String stateCode);

    List<StateCourtConfiguration> findByIsActiveTrue();
}
