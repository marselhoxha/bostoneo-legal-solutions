package com.***REMOVED***.***REMOVED***solutions.repository;

import com.***REMOVED***.***REMOVED***solutions.model.Client;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.ListCrudRepository;
import org.springframework.data.repository.PagingAndSortingRepository;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ClientRepository extends PagingAndSortingRepository<Client, Long>, ListCrudRepository<Client, Long> {
    
    // Use custom query with proper parameter binding to fix the SQL parameter issue
    @Query("SELECT c FROM Client c WHERE c.name LIKE CONCAT('%', :name, '%')")
    Page<Client> findByNameContaining(@Param("name") String name, Pageable pageable);
    
    // Find client by email
    @Query("SELECT c FROM Client c WHERE c.email = :email")
    List<Client> findByEmail(@Param("email") String email);
    
    // Find client by exact name (case insensitive)
    @Query("SELECT c FROM Client c WHERE LOWER(c.name) = LOWER(:name)")
    List<Client> findByNameIgnoreCase(@Param("name") String name);
    
    // Get clients who have time entries
    @Query("SELECT DISTINCT c FROM Client c " +
           "JOIN LegalCase lc ON c.name = lc.clientName " +
           "JOIN TimeEntry te ON lc.id = te.legalCaseId " +
           "WHERE te.billable = true AND te.invoiceId IS NULL " +
           "ORDER BY c.name")
    List<Client> findClientsWithUnbilledTimeEntries();
}
