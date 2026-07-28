INSERT INTO category (id, name, parent_id, level, sort_order) VALUES
  (1, '办公设备', NULL, 1, 10),
  (2, '电脑整机', 1, 2, 10),
  (3, '商务笔记本', 2, 3, 10),
  (4, '办公耗材', NULL, 1, 20),
  (5, '打印耗材', 4, 2, 10),
  (6, '复印纸', 5, 3, 10);

INSERT INTO brand (id, name, sort_order) VALUES (1, '联想', 10), (2, '得力', 20);

INSERT INTO product_spu (id, spu_code, title, category_id, brand_id, summary, status) VALUES
  (1, 'SPU-202607-0001', '联想 ThinkBook 16+ 商务本', 3, 1, 'Ultra 7 · 32G · 1TB', 1),
  (2, 'SPU-202607-0002', '得力 A4 多功能复印纸', 6, 2, '70g · 500张×8包', 1);

INSERT INTO product_sku (id, spu_id, sku_code, spec_json, market_price, member_price, stock, status) VALUES
  (1, 1, 'SKU-TB16-U7-32-1T', JSON_OBJECT('处理器','Ultra 7','内存','32G','硬盘','1TB'), 7299.00, 6899.00, 86, 1),
  (2, 2, 'SKU-DELI-A4-70G-8', JSON_OBJECT('克重','70g','包装','8包/箱'), 229.00, 209.00, 328, 1);

INSERT INTO enterprise (id, name, credit_code, contact_name, contact_phone, audit_status, status) VALUES
  (1, '山东高速数字科技有限公司', '91370000DEMO000001', '张经理', '13800002108', 2, 1);

INSERT INTO enterprise_user (id, enterprise_id, username, password_hash, real_name, phone, role_code, status) VALUES
  (1, 1, 'demo', '$2a$12$placeholder.replace.before.production', '张经理', '13800002108', 'ENTERPRISE_ADMIN', 1);

INSERT INTO agreement (id, agreement_no, enterprise_id, name, amount, effective_date, expiry_date, status) VALUES
  (1, 'AGR-2026-0086', 1, '2026年度办公设备采购框架协议', 2800000.00, '2026-07-01', '2027-06-30', 1);

INSERT INTO agreement_item (agreement_id, sku_id, agreement_price, status) VALUES
  (1, 1, 6480.00, 1),
  (1, 2, 186.00, 1);
