CREATE TABLE client_session (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  token_hash CHAR(64) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_client_session_token (token_hash),
  KEY idx_client_session_user (user_id),
  KEY idx_client_session_expiry (expires_at),
  CONSTRAINT fk_client_session_user FOREIGN KEY (user_id) REFERENCES enterprise_user(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

UPDATE enterprise_user SET password_hash='{noop}demo-password' WHERE id=1;
