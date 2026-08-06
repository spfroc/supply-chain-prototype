ALTER TABLE order_main
    MODIFY COLUMN agreement_id BIGINT UNSIGNED NULL COMMENT '有效协议ID；无协议按商品市场价下单时为空';

