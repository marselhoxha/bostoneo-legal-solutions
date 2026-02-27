-- V5: Clean up audit log noise from dual AOP aspects and GET-endpoint auditing
--
-- Root causes fixed in code:
-- 1) Deleted duplicate config/AuditAspect.java (was creating entries alongside aspect/AuditLogAspect.java)
-- 2) Fixed async context loss in AuditLogAspect (user_id was NULL in CompletableFuture.runAsync)
-- 3) Removed @AuditLog from all GET endpoints (only write operations audited now)
--
-- This migration cleans up the historical noise:

-- Step 1: Remove all entries with NULL user_id (no attribution = no audit value)
DELETE FROM audit_log WHERE user_id IS NULL;

-- Step 2: Remove GET-endpoint noise (descriptions from @AuditLog on read operations, misclassified as CREATE)
DELETE FROM audit_log
WHERE description LIKE 'Viewed%'
   OR description LIKE 'Searched%'
   OR description LIKE 'view %'
   OR description LIKE 'search %';
