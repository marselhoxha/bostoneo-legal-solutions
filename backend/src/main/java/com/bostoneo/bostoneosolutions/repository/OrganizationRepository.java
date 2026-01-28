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

    @Query("SELECT COUNT(u) FROM User u WHERE u.organizationId = :organizationId")
    Integer countUsersByOrganizationId(@Param("organizationId") Long organizationId);

    @Query("SELECT COUNT(c) FROM LegalCase c WHERE c.organizationId = :organizationId")
    Integer countCasesByOrganizationId(@Param("organizationId") Long organizationId);

    @Query("SELECT COUNT(f) FROM Folder f WHERE f.organizationId = :organizationId")
    Integer countDocumentsByOrganizationId(@Param("organizationId") Long organizationId);

    @Query("SELECT COUNT(c) FROM Client c WHERE c.organizationId = :organizationId")
    Integer countClientsByOrganizationId(@Param("organizationId") Long organizationId);

    /**
     * SECURITY: Find organization by Twilio phone number for webhook tenant isolation.
     * Used to determine which organization owns the incoming SMS.
     */
    @Query("SELECT o FROM Organization o WHERE o.twilioPhoneNumber = :phoneNumber OR o.twilioPhoneNumber = :normalizedPhone")
    Optional<Organization> findByTwilioPhoneNumber(@Param("phoneNumber") String phoneNumber, @Param("normalizedPhone") String normalizedPhone);
}
