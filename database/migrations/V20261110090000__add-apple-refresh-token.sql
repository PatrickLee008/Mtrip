SET NAMES utf8mb4;
USE `mtrip_business`;

-- A 254-byte address becomes 376 bytes after AES-GCM/base64 encoding.
SET @apple_email_ddl = IF(
  EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'user_info' AND COLUMN_NAME = 'email' AND CHARACTER_MAXIMUM_LENGTH < 512),
  'ALTER TABLE user_info MODIFY COLUMN email VARCHAR(512) NOT NULL DEFAULT '''' COMMENT ''Encrypted email''',
  'SELECT 1'
);
PREPARE apple_email_stmt FROM @apple_email_ddl;
EXECUTE apple_email_stmt;
DEALLOCATE PREPARE apple_email_stmt;

-- Encrypted at rest with MTRIP_AES_KEY; retained for Apple authorization revocation.
SET @apple_token_ddl = IF(
  EXISTS (SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_social_identity' AND COLUMN_NAME = 'provider_refresh_token'),
  'SELECT 1',
  'ALTER TABLE user_social_identity ADD COLUMN provider_refresh_token TEXT NULL COMMENT ''Encrypted provider refresh token'''
);
PREPARE apple_token_stmt FROM @apple_token_ddl;
EXECUTE apple_token_stmt;
DEALLOCATE PREPARE apple_token_stmt;
