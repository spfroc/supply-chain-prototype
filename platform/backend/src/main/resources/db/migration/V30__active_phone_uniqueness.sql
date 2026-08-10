ALTER TABLE enterprise_user
  ADD COLUMN active_phone VARCHAR(30)
    GENERATED ALWAYS AS (IF(deleted_at IS NULL, NULLIF(TRIM(phone), ''), NULL)) STORED,
  ADD UNIQUE KEY uk_enterprise_user_active_phone (active_phone);

ALTER TABLE sys_admin_user
  ADD COLUMN active_phone VARCHAR(30)
    GENERATED ALWAYS AS (IF(deleted_at IS NULL, NULLIF(TRIM(phone), ''), NULL)) STORED,
  ADD UNIQUE KEY uk_admin_user_active_phone (active_phone);
