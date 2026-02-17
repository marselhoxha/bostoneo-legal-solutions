-- Fix calendar permission names to be consistent with controller
-- First update the CREATE permission
UPDATE permissions 
SET name = 'CALENDAR:CREATE' 
WHERE name = 'CREATE:CALENDAR';

-- Update the UPDATE permission
UPDATE permissions 
SET name = 'CALENDAR:EDIT' 
WHERE name = 'UPDATE:CALENDAR';

-- Update the DELETE permission
UPDATE permissions 
SET name = 'CALENDAR:DELETE' 
WHERE name = 'DELETE:CALENDAR';

-- Update the READ permission
UPDATE permissions 
SET name = 'CALENDAR:VIEW' 
WHERE name = 'READ:CALENDAR';

-- Update the SYNC permission
UPDATE permissions 
SET name = 'CALENDAR:SYNC' 
WHERE name = 'SYNC:CALENDAR'; 