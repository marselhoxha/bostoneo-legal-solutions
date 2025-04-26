package com.bostoneo.bostoneosolutions.repository;

import com.bostoneo.bostoneosolutions.model.Receipt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ReceiptRepository extends JpaRepository<Receipt, Long> {
} 