# 专项升级 02:提交防重与 Redis 分布式锁

> 日期:2026-07 | 状态:已开发完成 | 影响范围:backend/shared、8 个微服务、deploy

## 1. 背景与目标

- 移动端注册接口为「先查后插」,同一手机号并发提交存在竞态,可能重复注册(数据库虽有 `uk_site_mobile_hash` 唯一索引兜底,但冲突异常未转为友好提示,直接 500)
- 管理端/移动端所有提交类业务(POST/PUT/PATCH/DELETE)此前无并发控制,双击/连点/网络重试会重复写入
- 目标:基于 Redis 为全平台提交类接口增加**并发锁**(同一用户/客户端同一接口串行,业务完成即释放)与可选的 **FormId 幂等**控制

## 2. 总体设计

### 2.1 Redis 分布式锁(RedisLock)

- `SET key token NX EX ttl` 抢锁,token 为 16 字节随机串;释放用 Lua「令牌比对一致才 DEL」,防止误删他人锁
- `run(key, ttl, business, failMessage)`:抢锁 → 执行业务 → `finally` 释放;抢锁失败抛 `42902 请求正在处理中,请勿重复提交`
- TTL 仅为进程异常时的死锁兜底,正常路径业务完成立即释放

### 2.2 提交防重中间件(SubmitLockMiddleware,全局注册)

生效范围:`/api/` 前缀 + 写方法(POST/PUT/PATCH/DELETE),其余请求直接放行;管理端与移动端接口统一覆盖。

**提交身份识别**(依序):

1. `Authorization: Bearer` Token 摘要 —— 登录态管理员 / C 端用户
2. `X-Client-Id` + 客户端 IP —— 已签名但未登录的 app 请求(如注册/登录)
3. IP + User-Agent 摘要 —— 完全匿名请求

**两种模式**(按请求头自动选择):

| 模式 | 触发条件 | 行为 |
| --- | --- | --- |
| 并发互斥锁(默认) | 无 `X-Form-Id` | 同身份同接口同时只允许一个在途请求,业务完成即释放;并发重复请求返回 42902 |
| FormId 幂等 | 请求头带 `X-Form-Id` | 同身份 + FormId 在窗口内(默认 300s)只允许**成功**提交一次;业务失败自动回收 FormId 允许重试 |

FormId 使用约定:客户端进入表单页/下单页时生成唯一 FormId(如 UUID),提交与重试均复用同一 FormId,提交成功后重新生成。适合下单、支付等强幂等场景;普通表单不传即走默认互斥锁,前端零改动。

### 2.3 注册接口业务级加锁(user-service)

`UserAuthService::register` 三层防护:

1. 中间件层:同一客户端并发提交注册被互斥锁拦截
2. 业务层:`mtrip:lock:user:register:{siteId}:{mobileHash}` 分布式锁 —— 不同设备/客户端同时注册**同一手机号**也被串行化,锁内「查重 → 插入」原子完成,业务完成即释放
3. 数据层:唯一索引 `uk_site_mobile_hash` 冲突捕获,统一转为 `40901 该手机号已注册`(极端场景兜底)

### 2.4 配置开关

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `MTRIP_SUBMIT_LOCK` | true | 提交防重总开关,**生产必须 true**;压测/联调可临时 false |
| `MTRIP_SUBMIT_LOCK_TTL` | 10 | 并发锁兜底 TTL(秒),正常路径完成即释放 |
| `MTRIP_FORM_ID_TTL` | 300 | FormId 幂等窗口(秒),窗口内同 FormId 重复提交拒绝 |

## 3. 改造清单

### 3.1 后端共享包(backend/shared)

| 文件 | 变更 |
| --- | --- |
| `src/Support/RedisLock.php` | 新建:SET NX EX + 随机令牌 + Lua 原子释放;`run()` 锁内执行助手 |
| `src/Middleware/SubmitLockMiddleware.php` | 新建:写操作提交防重(并发互斥锁 / X-Form-Id 幂等双模式) |
| `src/Constants/ErrorCode.php` | 新增 `REPEAT_SUBMIT = 42902`(HTTP 429,「请求正在处理中,请勿重复提交」) |
| `tests/cases/RedisLockTest.php` | 新建:抢锁互斥/令牌防误删/锁内并发拒绝/异常释放 4 用例 |

### 3.2 8 个微服务

`config/autoload/middlewares.php` 在 `PayloadDecryptMiddleware` 后统一追加 `SubmitLockMiddleware`(system/user/goods/order/merchant/finance/marketing/payment)。控制器无需任何改动。

### 3.3 user-service

| 文件 | 变更 |
| --- | --- |
| `app/Service/UserAuthService.php` | 注入 `RedisLock`;`register()` 加手机号维度分布式锁 + 唯一索引冲突兜底转 40901 |

### 3.4 部署(deploy/)

- `docker-compose.yml`:`&hyperf-env` 透传 `MTRIP_SUBMIT_LOCK` / `MTRIP_SUBMIT_LOCK_TTL` / `MTRIP_FORM_ID_TTL`
- `.env` / `.env.example`:新增「提交防重」配置段

## 4. 前端配合说明(可选,零改动可用)

- 默认互斥锁模式前端**无需任何改动**;收到 `code=42902` 时 admin-web / client-app 现有拦截器会自动 Toast 提示文案
- 需要强幂等的场景(下单/支付)可在请求头附加 `X-Form-Id`:进入页面时生成 UUID,提交失败重试复用,成功后重新生成

## 5. 验证

- `php backend/shared/tests/run.php`:30 用例 108 断言全部通过(含 RedisLock 4 用例)
- 全部改动文件 `php -l` 语法检查通过
- 联调验证建议:并发双发注册请求(同手机号不同 nonce),预期一个成功、一个返回 42902 或 40901;`docker compose up -d --build` 重建后生效
