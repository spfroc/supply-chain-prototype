-- 常用分类属性种子。属性定义、标准选项和分类关联均使用稳定编码，供所有环境初始化。
INSERT INTO attribute_definition
(code,name,group_name,attribute_type,input_type,unit,required_flag,filterable,searchable,visible_flag,allow_custom,sort_order,status) VALUES
('ORIGIN','产地','基本信息','BASIC','TEXT',NULL,0,0,1,1,1,60,1),
('CERTIFICATION','认证信息','基本信息','EXTENDED','CHECKBOX',NULL,0,1,1,1,1,70,1),
('DIMENSIONS','产品尺寸','规格参数','BASIC','TEXT','mm',0,0,0,1,1,80,1),
('WEIGHT','产品重量','规格参数','BASIC','NUMBER','kg',0,0,0,1,0,90,1),

('CPU_MODEL','处理器型号','核心配置','BASIC','TEXT',NULL,1,1,1,1,1,110,1),
('MEMORY_SIZE','内存容量','核心配置','SPEC','SELECT','GB',1,1,1,1,0,120,1),
('STORAGE_SIZE','存储容量','核心配置','SPEC','SELECT','GB',1,1,1,1,0,130,1),
('SCREEN_SIZE','屏幕尺寸','显示参数','BASIC','NUMBER','英寸',0,1,1,1,0,140,1),
('RESOLUTION','屏幕分辨率','显示参数','BASIC','SELECT',NULL,0,1,1,1,1,150,1),
('GPU_MODEL','显卡型号','核心配置','BASIC','TEXT',NULL,0,1,1,1,1,160,1),
('OPERATING_SYSTEM','操作系统','软件信息','BASIC','SELECT',NULL,0,1,1,1,1,170,1),

('PAPER_SIZE','纸张规格','纸张参数','SPEC','SELECT',NULL,1,1,1,1,0,210,1),
('PAPER_WEIGHT','纸张克重','纸张参数','SPEC','SELECT','g/㎡',1,1,1,1,0,220,1),
('SHEETS_PER_PACK','每包张数','包装信息','BASIC','NUMBER','张',1,0,0,1,0,230,1),
('PACKS_PER_CASE','每箱包数','包装信息','SPEC','NUMBER','包',0,0,0,1,0,240,1),

('PRINT_TECHNOLOGY','打印技术','打印参数','BASIC','SELECT',NULL,1,1,1,1,0,310,1),
('COLOR_MODE','打印颜色','打印参数','BASIC','RADIO',NULL,1,1,1,1,0,320,1),
('PRINT_SPEED','打印速度','打印参数','BASIC','NUMBER','页/分钟',0,1,0,1,0,330,1),
('MAX_PAPER_SIZE','最大纸张幅面','纸张处理','BASIC','SELECT',NULL,0,1,0,1,0,340,1),
('AUTO_DUPLEX','自动双面打印','功能特性','BASIC','SWITCH',NULL,0,1,0,1,0,350,1),
('PRINT_CONNECTIVITY','连接方式','接口参数','BASIC','CHECKBOX',NULL,0,1,1,1,1,360,1),

('TOUCH_POINTS','触控点数','触控参数','BASIC','NUMBER','点',0,1,0,1,0,410,1),
('CAMERA_RESOLUTION','摄像头像素','会议功能','BASIC','TEXT',NULL,0,0,0,1,1,420,1),
('VIDEO_INTERFACE','视频接口','接口参数','BASIC','CHECKBOX',NULL,0,1,1,1,1,430,1),

('PORT_COUNT','端口数量','网络参数','SPEC','SELECT','口',1,1,1,1,0,510,1),
('PORT_SPEED','端口速率','网络参数','BASIC','SELECT',NULL,1,1,1,1,0,520,1),
('POE_SUPPORT','PoE供电','功能特性','BASIC','RADIO',NULL,0,1,0,1,0,530,1),
('MANAGEMENT_TYPE','管理方式','功能特性','BASIC','SELECT',NULL,0,1,0,1,0,540,1),
('SWITCHING_CAPACITY','交换容量','性能参数','BASIC','NUMBER','Gbps',0,0,0,1,0,550,1),

('FRAME_MATERIAL','框架材质','材质参数','BASIC','TEXT',NULL,0,1,0,1,1,610,1),
('LOAD_CAPACITY','承重','规格参数','BASIC','NUMBER','kg',0,1,0,1,0,620,1),
('ADJUSTABLE_FEATURES','可调节功能','功能特性','BASIC','CHECKBOX',NULL,0,1,0,1,1,630,1),

('RECORDER_STORAGE','存储容量','录音参数','SPEC','SELECT','GB',1,1,1,1,0,710,1),
('BATTERY_LIFE','续航时间','电池参数','BASIC','NUMBER','小时',0,1,0,1,0,720,1),
('RECORDING_FORMAT','录音格式','录音参数','BASIC','CHECKBOX',NULL,0,1,0,1,1,730,1),
('NOISE_REDUCTION','智能降噪','智能功能','BASIC','SWITCH',NULL,0,1,0,1,0,740,1),
('TRANSCRIPTION','录音转写','智能功能','BASIC','SWITCH',NULL,0,1,0,1,0,750,1),

('COOLING_CAPACITY','制冷量','性能参数','BASIC','NUMBER','W',1,0,0,1,0,810,1),
('ENERGY_GRADE','能效等级','能效参数','BASIC','SELECT',NULL,1,1,1,1,0,820,1),
('INVERTER_TYPE','变频类型','性能参数','BASIC','RADIO',NULL,0,1,0,1,0,830,1),
('APPLICABLE_AREA','适用面积','使用参数','BASIC','TEXT','㎡',0,1,0,1,1,840,1),
('RATED_POWER','额定功率','电气参数','BASIC','NUMBER','W',0,0,0,1,0,850,1),

('TIP_SIZE','笔尖粗细','书写参数','SPEC','SELECT','mm',1,1,1,1,0,910,1),
('INK_COLOR','墨水颜色','书写参数','SPEC','SELECT',NULL,1,1,1,1,0,920,1),
('REFILLABLE','是否可替芯','功能特性','BASIC','SWITCH',NULL,0,1,0,1,0,930,1),

('SOCKET_COUNT','插孔数量','插孔参数','SPEC','SELECT','位',1,1,1,1,0,1010,1),
('CABLE_LENGTH','线缆长度','规格参数','SPEC','SELECT','米',1,1,1,1,0,1020,1),
('USB_PORT_COUNT','USB接口数量','接口参数','BASIC','NUMBER','个',0,1,0,1,0,1030,1),
('MASTER_SWITCH','总控开关','安全功能','BASIC','SWITCH',NULL,0,1,0,1,0,1040,1),
('SURGE_PROTECTION','浪涌保护','安全功能','BASIC','SWITCH',NULL,0,1,0,1,0,1050,1);

-- 标准选项。选项标签是前台显示值，编码供接口和数据迁移稳定引用。
INSERT INTO attribute_option(attribute_id,option_code,option_label,sort_order)
SELECT id,'8','8',10 FROM attribute_definition WHERE code='MEMORY_SIZE' UNION ALL
SELECT id,'16','16',20 FROM attribute_definition WHERE code='MEMORY_SIZE' UNION ALL
SELECT id,'32','32',30 FROM attribute_definition WHERE code='MEMORY_SIZE' UNION ALL
SELECT id,'64','64',40 FROM attribute_definition WHERE code='MEMORY_SIZE' UNION ALL
SELECT id,'256','256',10 FROM attribute_definition WHERE code='STORAGE_SIZE' UNION ALL
SELECT id,'512','512',20 FROM attribute_definition WHERE code='STORAGE_SIZE' UNION ALL
SELECT id,'1024','1024',30 FROM attribute_definition WHERE code='STORAGE_SIZE' UNION ALL
SELECT id,'1920X1080','1920×1080',10 FROM attribute_definition WHERE code='RESOLUTION' UNION ALL
SELECT id,'2560X1440','2560×1440',20 FROM attribute_definition WHERE code='RESOLUTION' UNION ALL
SELECT id,'3840X2160','3840×2160',30 FROM attribute_definition WHERE code='RESOLUTION' UNION ALL
SELECT id,'WINDOWS11','Windows 11',10 FROM attribute_definition WHERE code='OPERATING_SYSTEM' UNION ALL
SELECT id,'UOS','统信UOS',20 FROM attribute_definition WHERE code='OPERATING_SYSTEM' UNION ALL
SELECT id,'KYLIN','麒麟系统',30 FROM attribute_definition WHERE code='OPERATING_SYSTEM' UNION ALL
SELECT id,'NONE','无预装系统',40 FROM attribute_definition WHERE code='OPERATING_SYSTEM';

INSERT INTO attribute_option(attribute_id,option_code,option_label,sort_order)
SELECT id,'A3','A3',10 FROM attribute_definition WHERE code IN ('PAPER_SIZE','MAX_PAPER_SIZE') UNION ALL
SELECT id,'A4','A4',20 FROM attribute_definition WHERE code IN ('PAPER_SIZE','MAX_PAPER_SIZE') UNION ALL
SELECT id,'A5','A5',30 FROM attribute_definition WHERE code='PAPER_SIZE' UNION ALL
SELECT id,'70','70',10 FROM attribute_definition WHERE code='PAPER_WEIGHT' UNION ALL
SELECT id,'75','75',20 FROM attribute_definition WHERE code='PAPER_WEIGHT' UNION ALL
SELECT id,'80','80',30 FROM attribute_definition WHERE code='PAPER_WEIGHT' UNION ALL
SELECT id,'LASER','激光',10 FROM attribute_definition WHERE code='PRINT_TECHNOLOGY' UNION ALL
SELECT id,'INKJET','喷墨',20 FROM attribute_definition WHERE code='PRINT_TECHNOLOGY' UNION ALL
SELECT id,'MONO','黑白',10 FROM attribute_definition WHERE code='COLOR_MODE' UNION ALL
SELECT id,'COLOR','彩色',20 FROM attribute_definition WHERE code='COLOR_MODE' UNION ALL
SELECT id,'USB','USB',10 FROM attribute_definition WHERE code='PRINT_CONNECTIVITY' UNION ALL
SELECT id,'ETHERNET','有线网络',20 FROM attribute_definition WHERE code='PRINT_CONNECTIVITY' UNION ALL
SELECT id,'WIFI','Wi-Fi',30 FROM attribute_definition WHERE code='PRINT_CONNECTIVITY';

INSERT INTO attribute_option(attribute_id,option_code,option_label,sort_order)
SELECT id,'8','8',10 FROM attribute_definition WHERE code='PORT_COUNT' UNION ALL
SELECT id,'16','16',20 FROM attribute_definition WHERE code='PORT_COUNT' UNION ALL
SELECT id,'24','24',30 FROM attribute_definition WHERE code='PORT_COUNT' UNION ALL
SELECT id,'48','48',40 FROM attribute_definition WHERE code='PORT_COUNT' UNION ALL
SELECT id,'100M','百兆',10 FROM attribute_definition WHERE code='PORT_SPEED' UNION ALL
SELECT id,'1G','千兆',20 FROM attribute_definition WHERE code='PORT_SPEED' UNION ALL
SELECT id,'2_5G','2.5G',30 FROM attribute_definition WHERE code='PORT_SPEED' UNION ALL
SELECT id,'UNMANAGED','非网管',10 FROM attribute_definition WHERE code='MANAGEMENT_TYPE' UNION ALL
SELECT id,'WEB','Web网管',20 FROM attribute_definition WHERE code='MANAGEMENT_TYPE' UNION ALL
SELECT id,'FULL','全网管',30 FROM attribute_definition WHERE code='MANAGEMENT_TYPE' UNION ALL
SELECT id,'YES','支持',10 FROM attribute_definition WHERE code='POE_SUPPORT' UNION ALL
SELECT id,'NO','不支持',20 FROM attribute_definition WHERE code='POE_SUPPORT';

INSERT INTO attribute_option(attribute_id,option_code,option_label,sort_order)
SELECT id,'16','16',10 FROM attribute_definition WHERE code='RECORDER_STORAGE' UNION ALL
SELECT id,'32','32',20 FROM attribute_definition WHERE code='RECORDER_STORAGE' UNION ALL
SELECT id,'64','64',30 FROM attribute_definition WHERE code='RECORDER_STORAGE' UNION ALL
SELECT id,'128','128',40 FROM attribute_definition WHERE code='RECORDER_STORAGE' UNION ALL
SELECT id,'MP3','MP3',10 FROM attribute_definition WHERE code='RECORDING_FORMAT' UNION ALL
SELECT id,'WAV','WAV',20 FROM attribute_definition WHERE code='RECORDING_FORMAT' UNION ALL
SELECT id,'PCM','PCM',30 FROM attribute_definition WHERE code='RECORDING_FORMAT' UNION ALL
SELECT id,'LEVEL1','一级能效',10 FROM attribute_definition WHERE code='ENERGY_GRADE' UNION ALL
SELECT id,'LEVEL2','二级能效',20 FROM attribute_definition WHERE code='ENERGY_GRADE' UNION ALL
SELECT id,'LEVEL3','三级能效',30 FROM attribute_definition WHERE code='ENERGY_GRADE' UNION ALL
SELECT id,'VARIABLE','变频',10 FROM attribute_definition WHERE code='INVERTER_TYPE' UNION ALL
SELECT id,'FIXED','定频',20 FROM attribute_definition WHERE code='INVERTER_TYPE';

INSERT INTO attribute_option(attribute_id,option_code,option_label,sort_order)
SELECT id,'0_38','0.38',10 FROM attribute_definition WHERE code='TIP_SIZE' UNION ALL
SELECT id,'0_5','0.5',20 FROM attribute_definition WHERE code='TIP_SIZE' UNION ALL
SELECT id,'0_7','0.7',30 FROM attribute_definition WHERE code='TIP_SIZE' UNION ALL
SELECT id,'BLACK','黑色',10 FROM attribute_definition WHERE code='INK_COLOR' UNION ALL
SELECT id,'BLUE','蓝色',20 FROM attribute_definition WHERE code='INK_COLOR' UNION ALL
SELECT id,'RED','红色',30 FROM attribute_definition WHERE code='INK_COLOR' UNION ALL
SELECT id,'4','4',10 FROM attribute_definition WHERE code='SOCKET_COUNT' UNION ALL
SELECT id,'6','6',20 FROM attribute_definition WHERE code='SOCKET_COUNT' UNION ALL
SELECT id,'8','8',30 FROM attribute_definition WHERE code='SOCKET_COUNT' UNION ALL
SELECT id,'10','10',40 FROM attribute_definition WHERE code='SOCKET_COUNT' UNION ALL
SELECT id,'1_8','1.8',10 FROM attribute_definition WHERE code='CABLE_LENGTH' UNION ALL
SELECT id,'3','3',20 FROM attribute_definition WHERE code='CABLE_LENGTH' UNION ALL
SELECT id,'5','5',30 FROM attribute_definition WHERE code='CABLE_LENGTH' UNION ALL
SELECT id,'10','10',40 FROM attribute_definition WHERE code='CABLE_LENGTH';

-- 一级分类通用属性（自动向下继承）。
INSERT IGNORE INTO category_attribute(category_id,attribute_id,sort_order)
SELECT c.id,a.id,a.sort_order FROM category c JOIN attribute_definition a ON a.code IN ('ORIGIN','CERTIFICATION','DIMENSIONS','WEIGHT')
WHERE c.level=1 AND c.deleted_at IS NULL;

-- 三级分类专属属性。
INSERT IGNORE INTO category_attribute(category_id,attribute_id,sort_order)
SELECT c.id,a.id,a.sort_order FROM category c JOIN attribute_definition a
WHERE c.name='商务笔记本' AND a.code IN ('CPU_MODEL','MEMORY_SIZE','STORAGE_SIZE','SCREEN_SIZE','RESOLUTION','GPU_MODEL','OPERATING_SYSTEM');
INSERT IGNORE INTO category_attribute(category_id,attribute_id,sort_order)
SELECT c.id,a.id,a.sort_order FROM category c JOIN attribute_definition a
WHERE c.name='复印纸' AND a.code IN ('PAPER_SIZE','PAPER_WEIGHT','SHEETS_PER_PACK','PACKS_PER_CASE');
INSERT IGNORE INTO category_attribute(category_id,attribute_id,sort_order)
SELECT c.id,a.id,a.sort_order FROM category c JOIN attribute_definition a
WHERE c.name='激光打印机' AND a.code IN ('PRINT_TECHNOLOGY','COLOR_MODE','PRINT_SPEED','MAX_PAPER_SIZE','AUTO_DUPLEX','PRINT_CONNECTIVITY');
INSERT IGNORE INTO category_attribute(category_id,attribute_id,sort_order)
SELECT c.id,a.id,a.sort_order FROM category c JOIN attribute_definition a
WHERE c.name='触控一体机' AND a.code IN ('SCREEN_SIZE','RESOLUTION','TOUCH_POINTS','CAMERA_RESOLUTION','OPERATING_SYSTEM','VIDEO_INTERFACE');
INSERT IGNORE INTO category_attribute(category_id,attribute_id,sort_order)
SELECT c.id,a.id,a.sort_order FROM category c JOIN attribute_definition a
WHERE c.name='千兆交换机' AND a.code IN ('PORT_COUNT','PORT_SPEED','POE_SUPPORT','MANAGEMENT_TYPE','SWITCHING_CAPACITY');
INSERT IGNORE INTO category_attribute(category_id,attribute_id,sort_order)
SELECT c.id,a.id,a.sort_order FROM category c JOIN attribute_definition a
WHERE c.name='人体工学椅' AND a.code IN ('FRAME_MATERIAL','LOAD_CAPACITY','ADJUSTABLE_FEATURES');
INSERT IGNORE INTO category_attribute(category_id,attribute_id,sort_order)
SELECT c.id,a.id,a.sort_order FROM category c JOIN attribute_definition a
WHERE c.name='智能录音笔' AND a.code IN ('RECORDER_STORAGE','BATTERY_LIFE','RECORDING_FORMAT','NOISE_REDUCTION','TRANSCRIPTION');
INSERT IGNORE INTO category_attribute(category_id,attribute_id,sort_order)
SELECT c.id,a.id,a.sort_order FROM category c JOIN attribute_definition a
WHERE c.name='壁挂式空调' AND a.code IN ('COOLING_CAPACITY','ENERGY_GRADE','INVERTER_TYPE','APPLICABLE_AREA','RATED_POWER');
INSERT IGNORE INTO category_attribute(category_id,attribute_id,sort_order)
SELECT c.id,a.id,a.sort_order FROM category c JOIN attribute_definition a
WHERE c.name='中性笔' AND a.code IN ('TIP_SIZE','INK_COLOR','REFILLABLE');
INSERT IGNORE INTO category_attribute(category_id,attribute_id,sort_order)
SELECT c.id,a.id,a.sort_order FROM category c JOIN attribute_definition a
WHERE c.name='插线板' AND a.code IN ('SOCKET_COUNT','CABLE_LENGTH','RATED_POWER','USB_PORT_COUNT','MASTER_SWITCH','SURGE_PROTECTION');
