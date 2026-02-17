-- Migration to enhance user_roles table with primary role flag and expiration date

-- Add is_primary column to indicate if this is the user's primary role
ALTER TABLE user_roles 
ADD COLUMN is_primary BOOLEAN DEFAULT FALSE;

-- Add expires_at column to support role expiration
ALTER TABLE user_roles 
ADD COLUMN expires_at TIMESTAMP NULL;

-- Add assigned_at column to track when the role was assigned
ALTER TABLE user_roles 
ADD COLUMN assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP; 