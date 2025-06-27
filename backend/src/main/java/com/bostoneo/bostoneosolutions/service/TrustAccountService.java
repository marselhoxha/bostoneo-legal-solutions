package com.***REMOVED***.***REMOVED***solutions.service;

import com.***REMOVED***.***REMOVED***solutions.dto.TrustAccountDTO;
import com.***REMOVED***.***REMOVED***solutions.dto.TrustAccountTransactionDTO;
import com.***REMOVED***.***REMOVED***solutions.model.TrustAccount;
import com.***REMOVED***.***REMOVED***solutions.model.TrustAccountTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface TrustAccountService {
    TrustAccount createAccount(TrustAccountDTO dto);
    Optional<TrustAccount> getAccount(Long id);
    List<TrustAccount> getAllActiveAccounts();
    TrustAccount updateAccount(Long id, TrustAccountDTO dto);
    void deactivateAccount(Long id);
    
    TrustAccountTransaction recordDeposit(TrustAccountTransactionDTO dto);
    TrustAccountTransaction recordWithdrawal(TrustAccountTransactionDTO dto);
    TrustAccountTransaction recordTransfer(Long fromAccountId, Long toAccountId, TrustAccountTransactionDTO dto);
    
    Page<TrustAccountTransaction> getTransactionsByAccount(Long accountId, Pageable pageable);
    Page<TrustAccountTransaction> getTransactionsByClient(Long clientId, Pageable pageable);
    List<TrustAccountTransaction> getUnreconciledTransactions(Long accountId);
    
    BigDecimal getClientBalance(Long clientId, Long accountId);
    BigDecimal getTotalClientBalances(Long accountId);
    
    void reconcileTransactions(Long accountId, List<Long> transactionIds, LocalDate reconciliationDate);
    boolean validateAccountBalance(Long accountId);
}