package com.***REMOVED***.***REMOVED***solutions.testbuilder;

import com.***REMOVED***.***REMOVED***solutions.enumeration.CasePriority;
import com.***REMOVED***.***REMOVED***solutions.enumeration.CaseStatus;
import com.***REMOVED***.***REMOVED***solutions.enumeration.PaymentStatus;
import com.***REMOVED***.***REMOVED***solutions.model.LegalCase;

import java.util.Date;

public class LegalCaseTestBuilder {
    private Long id = 1L;
    private String caseNumber = "CASE-2024-001";
    private String title = "Test Legal Case";
    private String clientName = "John Smith";
    private String clientEmail = "john.smith@example.com";
    private String clientPhone = "+1234567890";
    private String clientAddress = "123 Main St, City, State 12345";
    private CaseStatus status = CaseStatus.OPEN;
    private CasePriority priority = CasePriority.HIGH;
    private String type = "Civil Litigation";
    private String description = "Test case description";
    private String courtName = "Superior Court";
    private String courtroom = "Room 301";
    private String judgeName = "Judge Smith";
    private Date filingDate = new Date();
    private Date nextHearing = new Date(System.currentTimeMillis() + 86400000L * 7); // 7 days from now
    private Date trialDate = new Date(System.currentTimeMillis() + 86400000L * 30); // 30 days from now
    private Double hourlyRate = 250.0;
    private Double totalHours = 0.0;
    private Double totalAmount = 0.0;
    private PaymentStatus paymentStatus = PaymentStatus.PENDING;
    private Date createdAt = new Date();
    private Date updatedAt = new Date();

    public static LegalCaseTestBuilder aLegalCase() {
        return new LegalCaseTestBuilder();
    }

    public LegalCaseTestBuilder withId(Long id) {
        this.id = id;
        return this;
    }

    public LegalCaseTestBuilder withCaseNumber(String caseNumber) {
        this.caseNumber = caseNumber;
        return this;
    }

    public LegalCaseTestBuilder withTitle(String title) {
        this.title = title;
        return this;
    }

    public LegalCaseTestBuilder withStatus(CaseStatus status) {
        this.status = status;
        return this;
    }

    public LegalCaseTestBuilder withClientName(String clientName) {
        this.clientName = clientName;
        return this;
    }

    public LegalCaseTestBuilder withClientEmail(String clientEmail) {
        this.clientEmail = clientEmail;
        return this;
    }

    public LegalCaseTestBuilder withFilingDate(Date filingDate) {
        this.filingDate = filingDate;
        return this;
    }

    public LegalCaseTestBuilder withPaymentStatus(PaymentStatus paymentStatus) {
        this.paymentStatus = paymentStatus;
        return this;
    }

    public LegalCase build() {
        LegalCase legalCase = new LegalCase();
        legalCase.setId(id);
        legalCase.setCaseNumber(caseNumber);
        legalCase.setTitle(title);
        legalCase.setClientName(clientName);
        legalCase.setClientEmail(clientEmail);
        legalCase.setClientPhone(clientPhone);
        legalCase.setClientAddress(clientAddress);
        legalCase.setStatus(status);
        legalCase.setPriority(priority);
        legalCase.setType(type);
        legalCase.setDescription(description);
        legalCase.setCourtName(courtName);
        legalCase.setCourtroom(courtroom);
        legalCase.setJudgeName(judgeName);
        legalCase.setFilingDate(filingDate);
        legalCase.setNextHearing(nextHearing);
        legalCase.setTrialDate(trialDate);
        legalCase.setHourlyRate(hourlyRate);
        legalCase.setTotalHours(totalHours);
        legalCase.setTotalAmount(totalAmount);
        legalCase.setPaymentStatus(paymentStatus);
        legalCase.setCreatedAt(createdAt);
        legalCase.setUpdatedAt(updatedAt);
        return legalCase;
    }
}