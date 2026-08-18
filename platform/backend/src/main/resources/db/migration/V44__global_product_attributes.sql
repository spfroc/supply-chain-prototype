ALTER TABLE attribute_definition
  ADD COLUMN global_flag TINYINT NOT NULL DEFAULT 0 COMMENT '1全局通用 0按分类生效' AFTER allow_custom,
  ADD KEY idx_attribute_global_status (global_flag,status,sort_order);

