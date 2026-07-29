# 政企采购供应链平台（正式工程）

本目录是正式编码工程，技术基线为 Java 21、Spring Boot 4.1、MySQL 8.4、Redis 8、React 19.2、Vite 和 Docker Compose。

## 当前里程碑

- MySQL 核心模型与 Flyway 迁移：分类、品牌、SPU、SKU、企业、企业用户、协议、协议商品、地址、购物车、主/子订单、订单商品、银行转账、库存流水和操作日志。
- 商品公开查询 API，可按企业返回协议价格。
- 协议商品管理 API：查询、添加现有 SKU、调整协议价格、软移除。
- 后台系统管理：用户、角色、权限、操作日志和基础配置。
- Web/H5 客户端：企业资料、协议商品、购物车、订单查询与幂等下单。
- Admin、Web、H5 三端独立 Vite 构建入口。
- MySQL、Redis、API、三端静态站点的一键 Compose 编排。
- 可加入 `comp` 服务器现有 `global_network`，由现有 Nginx 反向代理。

## 本地启动

1. 复制 `.env.example` 为 `.env`，设置所有 `change_me` 项。
2. 确保 Docker 中存在外部网络：`docker network create global_network`。
3. 在本目录执行 `docker compose up -d --build`。
4. 访问：
   - Web：`http://localhost:18088/web/`
   - H5：`http://localhost:18088/h5/`
   - 管理后台：`http://localhost:18088/admin/`
   - 对外状态检查：`http://localhost:18088/api/public/status`
   - 容器内健康检查：API 的 `:8080/actuator/health`
   - OpenAPI：`http://localhost:18088/api/openapi`

管理接口首个开发里程碑临时使用 HTTP Basic：`admin / change-me-before-production`。接入数据库管理员、JWT/HttpOnly Cookie 后必须删除临时账号，禁止带入生产。

## comp 部署

部署目录约定为 `/home/spf/apps/supply-chain`。Compose 只在 `18088` 暴露前端入口，MySQL、Redis、API 不映射宿主机端口。前端和 API 同时加入服务器现有 `global_network`。

现有 Nginx 配置模板位于 `deploy/nginx/supply-chain.conf`。复制到服务器 `/var/www/docker/apps/nginx/conf.d/` 后先执行：

```bash
docker exec nginx nginx -t
docker exec nginx nginx -s reload
```

局域网 DNS 或客户端 hosts 增加 `182.168.1.114 supply.comp` 后，可使用 `http://supply.comp/`。在域名与证书确定前，也可直接访问 `http://182.168.1.114:18088/`。

## 数据与安全

- 数据库存储在具名卷 `supply-chain_mysql_data`，Redis AOF 存储在 `supply-chain_redis_data`。
- `.env`、OSS、高德、快递100和短信凭证不得提交 Git。
- `V2__seed_development_data.sql` 仅为开发样例，正式生产初始化前应拆成独立 profile。
- `V3__system_management_and_demo_orders.sql` 增加系统权限模型和跨端联调数据。
- 删除协议商品使用软删除；不会删除商品基础库。
- 生效协议调价、增删商品后续必须同时写 `operation_log` 并清理 Redis 价格缓存。

## 自动化回归

完整用例清单位于 `tests/TEST_CASES.md`。部署后在 Windows PowerShell 中执行：

```powershell
$content = Get-Content -Raw -Encoding UTF8 .\tests\api-smoke.ps1
& ([scriptblock]::Create($content))
```

脚本覆盖入口健康、管理接口认证、用户增删改、权限与配置查询、操作日志、协议商品、购物车边界、下单和幂等保护。

## 下一阶段

1. 将临时开发认证替换为数据库账号登录、JWT/Refresh Cookie 与 RBAC 拦截。
2. SPU/SKU、分类、品牌、企业、协议完整 CRUD。
3. 价格引擎、多地址拆单与库存释放补偿。
4. 银行到账确认、发货物流、发票记录。
5. 导航、轮播图、方案与平台关联逐模块迁移至正式 API。
