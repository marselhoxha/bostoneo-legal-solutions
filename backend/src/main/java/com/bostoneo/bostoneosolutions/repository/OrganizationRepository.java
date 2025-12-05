package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.Organization;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface OrganizationRepository extends JpaRepository<Organization, Long> {

    Optional<Organization> findBySlug(String slug);

    Optional<Organization> findByEmail(String email);

    boolean existsBySlug(String slug);

    boolean existsByEmail(String email);

    List<Organization> findByPlanType(Organization.PlanType planType);

    @Query("SELECT o FROM Organization o WHERE o.twilioEnabled = true AND o.twilioSubaccountSid IS NOT NULL")
    List<Organization> findAllWithTwilioEnabled();

    @Query("SELECT o FROM Organization o WHERE o.boldsignEnabled = true")
    List<Organization> findAllWithBoldsignEnabled();

    @Query("SELECT o FROM Organization o WHERE o.name LIKE %:query% OR o.slug LIKE %:query% OR o.email LIKE %:query%")
    List<Organization> searchOrganizations(@Param("query") String query);
}
