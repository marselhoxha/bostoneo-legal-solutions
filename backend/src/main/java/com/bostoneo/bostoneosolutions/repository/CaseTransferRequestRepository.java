package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.enumeration.TransferStatus;
import com.bostoneo.bostoneosolutions.enumeration.TransferUrgency;
import com.bostoneo.bostoneosolutions.model.CaseTransferRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface CaseTransferRequestRepository extends JpaRepository<CaseTransferRequest, Long> {
    
    /**
     * Find pending transfer requests
     */
    Page<CaseTransferRequest> findByStatus(TransferStatus status, Pageable pageable);
    
    /**
     * Find transfer requests for a case
     */
    @Query("SELECT ctr FROM CaseTransferRequest ctr WHERE ctr.legalCase.id = :caseId " +
           "ORDER BY ctr.requestedAt DESC")
    List<CaseTransferRequest> findByCaseId(@Param("caseId") Long caseId);
    
    /**
     * Find transfer requests from a user
     */
    @Query("SELECT ctr FROM CaseTransferRequest ctr WHERE ctr.fromUser.id = :userId " +
           "ORDER BY ctr.requestedAt DESC")
    Page<CaseTransferRequest> findByFromUserId(@Param("userId") Long userId, Pageable pageable);
    
    /**
     * Find transfer requests to a user
     */
    @Query("SELECT ctr FROM CaseTransferRequest ctr WHERE ctr.toUser.id = :userId " +
           "AND ctr.status = 'PENDING' ORDER BY ctr.urgency DESC, ctr.requestedAt ASC")
    List<CaseTransferRequest> findPendingByToUserId(@Param("userId") Long userId);
    
    /**
     * Find urgent pending requests
     */
    @Query("SELECT ctr FROM CaseTransferRequest ctr WHERE ctr.status = 'PENDING' " +
           "AND ctr.urgency IN :urgencies ORDER BY ctr.urgency DESC, ctr.requestedAt ASC")
    List<CaseTransferRequest> findUrgentPendingRequests(
        @Param("urgencies") List<TransferUrgency> urgencies
    );
    
    /**
     * Find requests needing approval by a user
     */
    @Query("SELECT ctr FROM CaseTransferRequest ctr WHERE ctr.status = 'PENDING' " +
           "AND ctr.toUser.id = :userId")
    List<CaseTransferRequest> findRequestsNeedingApproval(@Param("userId") Long userId);
    
    /**
     * Count pending requests by urgency
     */
    @Query("SELECT ctr.urgency, COUNT(ctr) FROM CaseTransferRequest ctr " +
           "WHERE ctr.status = 'PENDING' GROUP BY ctr.urgency")
    List<Object[]> countPendingByUrgency();
    
    /**
     * Find completed transfers in date range
     */
    @Query("SELECT ctr FROM CaseTransferRequest ctr WHERE ctr.status = 'APPROVED' " +
           "AND ctr.processedAt BETWEEN :startDate AND :endDate")
    List<CaseTransferRequest> findCompletedTransfers(
        @Param("startDate") LocalDateTime startDate,
        @Param("endDate") LocalDateTime endDate
    );
    
    /**
     * Check for existing pending request
     */
    @Query("SELECT CASE WHEN COUNT(ctr) > 0 THEN true ELSE false END " +
           "FROM CaseTransferRequest ctr WHERE ctr.legalCase.id = :caseId " +
           "AND ctr.fromUser.id = :fromUserId AND ctr.status = 'PENDING'")
    boolean existsPendingRequest(
        @Param("caseId") Long caseId,
        @Param("fromUserId") Long fromUserId
    );
}