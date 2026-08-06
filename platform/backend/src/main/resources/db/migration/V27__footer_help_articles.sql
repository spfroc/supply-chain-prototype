UPDATE portal_resource
SET description='<h2>企业采购流程</h2><p>浏览商品或场景方案，确认商品数量与配送地址后提交订单。平台采用线下银行转账，到账后由运营人员更新付款状态并安排发货。</p><h2>价格说明</h2><p>已生效协议中的商品使用协议价格；没有协议或商品未加入协议时，按照商品原价结算。</p>'
WHERE resource_type='CONTENT' AND title='采购指南' AND (description IS NULL OR description='');

UPDATE portal_resource
SET description='<h2>售后申请</h2><p>订单完成后可在订单详情中查看商品物流信息并发起退款或售后申请。实际退换货范围以商品售后说明和双方确认结果为准。</p><h2>服务支持</h2><p>如需协助，请在工作时间联系平台服务人员，并提供订单号、商品及问题说明。</p>'
WHERE resource_type='CONTENT' AND title='售后服务说明' AND (description IS NULL OR description='');

INSERT INTO portal_resource(resource_type,title,subtitle,description,link_url,sort_order,status)
SELECT 'CONTENT','付款方式','了解银行转账付款、到账确认及订单处理流程',
       '<h2>线下银行转账</h2><p>订单提交后请按照订单付款说明完成银行转账。平台运营人员核对到账信息后，手动将订单更新为已付款并进入备货流程。</p><p>转账时建议在附言中填写订单号，便于快速核对。</p>',
       '/web/content',30,1
WHERE NOT EXISTS(SELECT 1 FROM portal_resource WHERE resource_type='CONTENT' AND title='付款方式' AND deleted_at IS NULL);

INSERT INTO portal_resource(resource_type,title,subtitle,description,link_url,sort_order,status)
SELECT 'CONTENT','发票说明','发票由第三方开具，平台记录开票信息和处理状态',
       '<h2>发票申请</h2><p>请在企业中心维护准确的发票抬头、统一社会信用代码及接收信息。平台仅记录发票申请和开具结果，发票由第三方服务开具。</p>',
       '/web/content',40,1
WHERE NOT EXISTS(SELECT 1 FROM portal_resource WHERE resource_type='CONTENT' AND title='发票说明' AND deleted_at IS NULL);

INSERT INTO portal_resource(resource_type,title,subtitle,description,link_url,sort_order,status)
SELECT 'CONTENT','配送说明','支持同一商品按数量拆分到多个收货地址',
       '<h2>多地址配送</h2><p>确认订单时，可将同一 SKU 的购买数量分配到多个企业收货地址。每个配送明细可独立记录物流公司、运单号和签收状态。</p>',
       '/web/content',50,1
WHERE NOT EXISTS(SELECT 1 FROM portal_resource WHERE resource_type='CONTENT' AND title='配送说明' AND deleted_at IS NULL);

INSERT INTO portal_resource(resource_type,title,subtitle,description,link_url,sort_order,status)
SELECT 'CONTENT','企业账户与成员','企业主账号可以维护成员资料与账号状态',
       '<h2>企业成员管理</h2><p>企业注册时创建的第一个账号作为主账号。主账号可在企业中心维护成员，管理成员资料及启用状态；平台管理人员也可在管理后台协助维护企业用户。</p>',
       '/web/content',60,1
WHERE NOT EXISTS(SELECT 1 FROM portal_resource WHERE resource_type='CONTENT' AND title='企业账户与成员' AND deleted_at IS NULL);
