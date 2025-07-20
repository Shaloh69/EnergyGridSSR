-- =============================================
-- EMERGENCY FIX - Kill Duplicate Registration Processes
-- =============================================

USE uclm_energy_audit;

-- 1. KILL the stuck registration processes
-- (Replace with actual process IDs from your SHOW PROCESSLIST)

-- 2. Clear any partial transactions
ROLLBACK;

-- 3. Reset connection state
SET AUTOCOMMIT = 1;
SET FOREIGN_KEY_CHECKS = 1;

-- 4. Check if the user was actually created
SELECT id, email, first_name, last_name, role, created_at 
FROM users 
WHERE email = 'shemstest@gmil.com';

-- 5. If user exists but registration is still failing, the issue is duplicate attempts
-- If user doesn't exist, try manual insertion to test:
-- INSERT INTO users (email, password, first_name, last_name, role, department, phone, is_active) 
-- VALUES ('shemstest@gmil.com', '$2a$12$nLiXAsQONYN9M0ElfIW2leSQ/G30lVWTGPvcnGB8RY4cPlYEu48dC', 'Shem Joshua', 'Dumpor', 'admin', 'Engineering', '09275605517', 1);

-- 6. Clear any remaining locks
FLUSH TABLES;

-- 7. Verify database is working
SELECT 'Database should be unlocked now - restart your server' as status;