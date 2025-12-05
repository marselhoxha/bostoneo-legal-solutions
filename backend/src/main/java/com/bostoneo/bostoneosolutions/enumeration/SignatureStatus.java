package com.bostoneo.bostoneosolutions.enumeration;

/**
 * Status of a signature request
 */
public enum SignatureStatus {
    DRAFT,              // Created but not sent
    SENT,               // Sent to signers
    VIEWED,             // Viewed by at least one signer
    PARTIALLY_SIGNED,   // Some signers have signed
    SIGNED,             // All signers have signed
    COMPLETED,          // Fully completed and finalized
    DECLINED,           // Declined by a signer
    EXPIRED,            // Past expiration date
    VOIDED              // Cancelled by sender
}
