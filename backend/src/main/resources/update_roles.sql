-- First, clear existing roles
DELETE FROM UserRoles;
DELETE FROM Roles;

-- Reset auto-increment counter
ALTER TABLE Roles AUTO_INCREMENT = 1;

-- Insert roles with correct permissions
INSERT INTO Roles (name, permission)
VALUES ('ROLE_USER', 'READ:USER,READ:CUSTOMER'),
       ('ROLE_MANAGER', 'READ:USER,READ:CUSTOMER,UPDATE:USER,UPDATE:CUSTOMER'),
       ('ROLE_ADMIN', 'READ:USER,READ:CUSTOMER,CREATE:USER,CREATE:CUSTOMER,UPDATE:USER,UPDATE:CUSTOMER'),
       ('ROLE_SYSADMIN', 'READ:USER,READ:CUSTOMER,CREATE:USER,CREATE:CUSTOMER,UPDATE:USER,UPDATE:CUSTOMER,DELETE:USER,DELETE:CUSTOMER');

-- Insert default admin user role
INSERT INTO UserRoles (user_id, role_id)
SELECT u.id, r.id
FROM Users u, Roles r
WHERE u.email = 'admin@bostoneo.com' AND r.name = 'ROLE_SYSADMIN'; 