-- Add the category column to the legaldocument table
ALTER TABLE legaldocument 
ADD COLUMN category VARCHAR(50) DEFAULT 'OTHER' AFTER type; 
ALTER TABLE legaldocument 
ADD COLUMN category VARCHAR(50) DEFAULT 'OTHER' AFTER type; 
 
 