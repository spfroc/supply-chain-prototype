CREATE TABLE order_event (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_main_id BIGINT UNSIGNED NOT NULL,
  event_type VARCHAR(40) NOT NULL,
  from_status TINYINT NULL,
  to_status TINYINT NULL,
  description VARCHAR(500) NOT NULL,
  operator_type VARCHAR(20) NOT NULL DEFAULT 'ADMIN',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_order_event_order_time (order_main_id, created_at),
  CONSTRAINT fk_order_event_order FOREIGN KEY (order_main_id) REFERENCES order_main(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO order_event(order_main_id,event_type,to_status,description,operator_type,created_at)
SELECT id,'ORDER_CREATED',0,'订单创建','CLIENT',created_at FROM order_main;
