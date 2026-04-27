-- V53: Widen PI phone columns from VARCHAR(50) to VARCHAR(255).
--
-- Root cause: these three columns are @Convert(EncryptedStringConverter)
-- on the JPA entity, so values are AES-GCM encrypted + base64 encoded
-- before persistence. The ciphertext is significantly longer than the
-- plaintext — a 25-char phone like "800-628-0250 Ext. 6737813" becomes
-- ~76 chars after encryption, easily overflowing VARCHAR(50). Users hit
-- this with phone-with-extension input and the save fails with SQLState
-- 22001 ("value too long for type character varying(50)") — surfaced to
-- the UI as a generic "data integrity error".
--
-- 255 matches the unencrypted `client_phone` column, accommodates any
-- realistic encrypted phone payload, and aligns with the JPA @Column
-- update made in the same change (LegalCase.java length = 255).
--
-- Widening doesn't affect existing data — it's a metadata-only change.

ALTER TABLE legal_cases
  ALTER COLUMN insurance_adjuster_phone TYPE VARCHAR(255);

ALTER TABLE legal_cases
  ALTER COLUMN client_insurance_adjuster_phone TYPE VARCHAR(255);

ALTER TABLE legal_cases
  ALTER COLUMN employer_phone TYPE VARCHAR(255);
