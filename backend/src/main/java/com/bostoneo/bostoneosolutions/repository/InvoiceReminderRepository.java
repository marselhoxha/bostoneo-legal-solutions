package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.InvoiceReminder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface InvoiceReminderRepository extends JpaRepository<InvoiceReminder, Long> {

    /**
     * @deprecated Use findByOrganizationIdAndInvoiceId instead for tenant isolation
     */
    @Deprecated
    List<InvoiceReminder> findByInvoiceId(Long invoiceId);

    /**
     * @deprecated Use findByOrganizationIdAndStatusAndScheduledDate instead for tenant isolation
     */
    @Deprecated
    List<InvoiceReminder> findByStatusAndScheduledDate(InvoiceReminder.ReminderStatus status, LocalDate scheduledDate);

    /**
     * @deprecated Use findByOrganizationIdAndStatus instead for tenant isolation
     */
    @Deprecated
    List<InvoiceReminder> findByStatus(InvoiceReminder.ReminderStatus status);

    /**
     * @deprecated Use findByOrganizationIdAndScheduledDateBeforeAndStatus instead for tenant isolation
     */
    @Deprecated
    List<InvoiceReminder> findByScheduledDateBeforeAndStatus(LocalDate date, InvoiceReminder.ReminderStatus status);

    // ==================== TENANT-FILTERED METHODS ====================

    @Query("SELECT r FROM InvoiceReminder r WHERE r.invoice.organizationId = :organizationId")
    Page<InvoiceReminder> findByOrganizationId(@Param("organizationId") Long organizationId, Pageable pageable);

    @Query("SELECT r FROM InvoiceReminder r WHERE r.invoice.organizationId = :organizationId AND r.invoice.id = :invoiceId")
    List<InvoiceReminder> findByOrganizationIdAndInvoiceId(@Param("organizationId") Long organizationId, @Param("invoiceId") Long invoiceId);

    @Query("SELECT r FROM InvoiceReminder r WHERE r.invoice.organizationId = :orgId AND r.status = :status AND r.scheduledDate = :scheduledDate")
    List<InvoiceReminder> findByOrganizationIdAndStatusAndScheduledDate(
            @Param("orgId") Long organizationId,
            @Param("status") InvoiceReminder.ReminderStatus status,
            @Param("scheduledDate") LocalDate scheduledDate);

    @Query("SELECT r FROM InvoiceReminder r WHERE r.invoice.organizationId = :orgId AND r.status = :status")
    List<InvoiceReminder> findByOrganizationIdAndStatus(@Param("orgId") Long organizationId, @Param("status") InvoiceReminder.ReminderStatus status);

    @Query("SELECT r FROM InvoiceReminder r WHERE r.invoice.organizationId = :orgId AND r.scheduledDate < :date AND r.status = :status")
    List<InvoiceReminder> findByOrganizationIdAndScheduledDateBeforeAndStatus(
            @Param("orgId") Long organizationId,
            @Param("date") LocalDate date,
            @Param("status") InvoiceReminder.ReminderStatus status);
}