-- Make client email optional (not all clients have email addresses)
ALTER TABLE clients ALTER COLUMN email DROP NOT NULL;
