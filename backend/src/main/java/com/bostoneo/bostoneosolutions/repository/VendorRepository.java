package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.Vendor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface VendorRepository extends JpaRepository<Vendor, Long> {
    // Add custom query methods here if needed
} 