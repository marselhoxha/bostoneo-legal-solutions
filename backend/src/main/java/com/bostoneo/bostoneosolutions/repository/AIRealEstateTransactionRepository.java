package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.AIRealEstateTransaction;
import com.bostoneo.bostoneosolutions.enumeration.RealEstateTransactionType;
import com.bostoneo.bostoneosolutions.enumeration.PropertyType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface AIRealEstateTransactionRepository extends JpaRepository<AIRealEstateTransaction, Long> {
    
    List<AIRealEstateTransaction> findByCaseIdOrderByCreatedAtDesc(Long caseId);
    
    Page<AIRealEstateTransaction> findByTransactionType(RealEstateTransactionType transactionType, Pageable pageable);
    
    Page<AIRealEstateTransaction> findByPropertyType(PropertyType propertyType, Pageable pageable);
    
    List<AIRealEstateTransaction> findByTransactionType(RealEstateTransactionType transactionType);
    
    List<AIRealEstateTransaction> findByPropertyType(PropertyType propertyType);
    
    List<AIRealEstateTransaction> findByPropertyAddressContainingIgnoreCase(String address);
    
    List<AIRealEstateTransaction> findByBuyerNameContainingIgnoreCase(String buyerName);
    
    List<AIRealEstateTransaction> findBySellerNameContainingIgnoreCase(String sellerName);

    // ==================== TENANT-FILTERED METHODS (SECURITY CRITICAL) ====================

    /**
     * SECURITY: Find all transactions for an organization (tenant isolation)
     */
    List<AIRealEstateTransaction> findByOrganizationId(Long organizationId);

    /**
     * SECURITY: Find transaction by ID within organization (tenant isolation)
     */
    java.util.Optional<AIRealEstateTransaction> findByIdAndOrganizationId(Long id, Long organizationId);

    /**
     * SECURITY: Find by transaction type within organization
     */
    Page<AIRealEstateTransaction> findByTransactionTypeAndOrganizationId(
        com.bostoneo.bostoneosolutions.enumeration.TransactionType transactionType, Long organizationId, Pageable pageable);

    /**
     * SECURITY: Find by property type within organization
     */
    Page<AIRealEstateTransaction> findByPropertyTypeAndOrganizationId(PropertyType propertyType, Long organizationId, Pageable pageable);

    /**
     * SECURITY: Find by case ID within organization
     */
    List<AIRealEstateTransaction> findByCaseIdAndOrganizationIdOrderByCreatedAtDesc(Long caseId, Long organizationId);
}