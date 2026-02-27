-- V3__fix_roles_table_data.sql
-- Fix roles table: populate display_name, hierarchy_level, is_active for all roles

-- Ensure columns exist
ALTER TABLE roles ADD COLUMN IF NOT EXISTS display_name VARCHAR(100);
ALTER TABLE roles ADD COLUMN IF NOT EXISTS hierarchy_level INTEGER DEFAULT 0;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS is_system_role BOOLEAN DEFAULT false;

-- Update all roles with proper data
UPDATE roles SET display_name = 'Super Administrator', hierarchy_level = 100, is_active = true, is_system_role = true WHERE name = 'ROLE_SUPERADMIN';
UPDATE roles SET display_name = 'Managing Partner', hierarchy_level = 95, is_active = true, is_system_role = false WHERE name = 'MANAGING_PARTNER';
UPDATE roles SET display_name = 'Senior Partner', hierarchy_level = 90, is_active = true, is_system_role = false WHERE name = 'SENIOR_PARTNER';
UPDATE roles SET display_name = 'Equity Partner', hierarchy_level = 88, is_active = true, is_system_role = false WHERE name = 'EQUITY_PARTNER';
UPDATE roles SET display_name = 'Chief Operating Officer', hierarchy_level = 87, is_active = true, is_system_role = false WHERE name = 'COO';
UPDATE roles SET display_name = 'Chief Financial Officer', hierarchy_level = 86, is_active = true, is_system_role = false WHERE name = 'CFO';
UPDATE roles SET display_name = 'Administrator', hierarchy_level = 85, is_active = true, is_system_role = false WHERE name = 'ROLE_ADMIN';
UPDATE roles SET display_name = 'Of Counsel', hierarchy_level = 80, is_active = true, is_system_role = false WHERE name = 'OF_COUNSEL';
UPDATE roles SET display_name = 'Non-Equity Partner', hierarchy_level = 78, is_active = true, is_system_role = false WHERE name = 'NON_EQUITY_PARTNER';
UPDATE roles SET display_name = 'Senior Associate', hierarchy_level = 75, is_active = true, is_system_role = false WHERE name = 'SENIOR_ASSOCIATE';
UPDATE roles SET display_name = 'Attorney', hierarchy_level = 70, is_active = true, is_system_role = false WHERE name = 'ROLE_ATTORNEY';
UPDATE roles SET display_name = 'Associate', hierarchy_level = 65, is_active = true, is_system_role = false WHERE name = 'ASSOCIATE';
UPDATE roles SET display_name = 'Junior Associate', hierarchy_level = 60, is_active = true, is_system_role = false WHERE name = 'JUNIOR_ASSOCIATE';
UPDATE roles SET display_name = 'Practice Manager', hierarchy_level = 55, is_active = true, is_system_role = false WHERE name = 'PRACTICE_MANAGER';
UPDATE roles SET display_name = 'Finance Manager', hierarchy_level = 54, is_active = true, is_system_role = false WHERE name = 'FINANCE_MANAGER';
UPDATE roles SET display_name = 'IT Manager', hierarchy_level = 53, is_active = true, is_system_role = false WHERE name = 'IT_MANAGER';
UPDATE roles SET display_name = 'HR Manager', hierarchy_level = 52, is_active = true, is_system_role = false WHERE name = 'HR_MANAGER';
UPDATE roles SET display_name = 'Finance', hierarchy_level = 50, is_active = true, is_system_role = false WHERE name = 'ROLE_FINANCE';
UPDATE roles SET display_name = 'Senior Paralegal', hierarchy_level = 45, is_active = true, is_system_role = false WHERE name = 'SENIOR_PARALEGAL';
UPDATE roles SET display_name = 'Paralegal', hierarchy_level = 40, is_active = true, is_system_role = false WHERE name = 'PARALEGAL';
UPDATE roles SET display_name = 'Legal Assistant', hierarchy_level = 38, is_active = true, is_system_role = false WHERE name = 'LEGAL_ASSISTANT';
UPDATE roles SET display_name = 'Law Clerk', hierarchy_level = 35, is_active = true, is_system_role = false WHERE name = 'LAW_CLERK';
UPDATE roles SET display_name = 'Secretary', hierarchy_level = 30, is_active = true, is_system_role = false WHERE name = 'ROLE_SECRETARY';
UPDATE roles SET display_name = 'User', hierarchy_level = 10, is_active = true, is_system_role = false WHERE name = 'ROLE_USER';
UPDATE roles SET display_name = 'Client', hierarchy_level = 5, is_active = true, is_system_role = false WHERE name = 'ROLE_CLIENT';
