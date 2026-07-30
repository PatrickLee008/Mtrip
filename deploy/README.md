# Mtrip 部署与重启操作指南

> 适用环境:Windows Docker Desktop 本地联调 | 所有命令在 `deploy/` 目录下执行(PowerShell)

## 1. 首次启动 / 完整重建

```powershell
cd deploy
Copy-Item .env.example .env    # 首次需要,已有 .env 跳过
docker compose up -d --build   # 构建镜像并启动全部服务(分钟级)
```

启动完成后入口:

| 入口 | 地址 |
| --- | --- |
| 网关(admin + app 接口统一入口) | http://localhost:8081 |
| 各微服务直连(healthz 探活) | 9501~9508(system/user/goods/order/merchant/finance/marketing/payment) |
| MySQL | localhost:3307(root / 见 .env) |
| Redis | localhost:6380 |

## 2. 日常改动后如何重启(按场景选,勿一律 --build)

| 场景 | 命令 | 耗时 |
| --- | --- | --- |
| 只改 PHP 代码(`app/`、`config/`、`shared/src`) | `docker compose restart user-service`(或不带服务名重启全部) | ~2 秒/个 |
| 改了 `docker-compose.yml` / `.env` 环境变量 | `docker compose up -d`,然后 `docker compose restart gateway` | ~10 秒 |
| 新增 composer 依赖 / 改 Dockerfile | `docker compose up -d --build xxx-service` | 分钟级 |
| 改了数据库初始化 SQL(需重跑建表) | `docker compose down -v; docker compose up -d --build`(**清空数据卷,慎用**) | 分钟级 |

热重启原理:`docker-compose.override.yml` 把本地 `app/`、`config/`、`backend/shared/src` 挂载进容器覆盖镜像内代码,
`restart` 后 Hyperf 重新扫描即生效,无需重建镜像。

## 3. 已知坑:重建容器后网关 502

`docker compose up -d` 重建业务容器会导致容器 IP 变化,而 OpenResty 网关启动时已解析并缓存旧上游 IP,
表现为**服务 healthz 正常但网关转发全部 502**。修复:

```powershell
docker compose restart gateway
```

纯 `docker compose restart xxx-service` 热重启不换 IP,不会触发此问题。

## 4. 部署后验证

```powershell
# 1) 容器状态全部 Up
docker compose ps

# 2) 服务探活(以 user-service 为例;注意用 curl.exe,PowerShell 的 curl 是 Invoke-WebRequest 别名)
curl.exe -s http://localhost:9502/healthz
# 期望:{"status":"ok","service":"user-service"}

# 3) 网关链路(无签名头预期返回 401,说明链路与签名中间件正常;502 则按第 3 节重启网关)
curl.exe -s -o NUL -w "%{http_code}" http://localhost:8081/api/v1/app/auth/login -X POST

# 4) 环境变量注入检查(以提交防重开关为例)
docker exec mtrip-user-service-1 sh -c "env | grep MTRIP_SUBMIT"
```

## 5. 日志与排查

- 服务日志挂载在 `deploy/logs/<服务名>/`:`hyperf.log`(异常,按天滚动)、`request.log`(全量请求,`MTRIP_REQUEST_LOG=true` 时)
- 实时看容器输出:`docker compose logs -f user-service`
- 常用开关(改 `.env` 后须 `docker compose up -d` + 重启网关,详见 `.env` 内注释):
  `MTRIP_REQUEST_LOG` / `MTRIP_CLIENT_SIGN` / `MTRIP_PAYLOAD_ENCRYPT` / `MTRIP_SUBMIT_LOCK`

## 6. 停止

```powershell
docker compose stop      # 停止但保留容器与数据
docker compose down      # 删除容器,保留数据卷(下次 up 数据仍在)
docker compose down -v   # 连数据卷一起删(数据库清空,重新初始化建表)
```
