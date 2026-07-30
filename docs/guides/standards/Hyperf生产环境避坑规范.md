# Hyperf 生产环境避坑规范

> 适用:Hyperf 3.x + Swoole,Mtrip 全部后端微服务(backend/services/*)。
> 一句话总纲:**Hyperf 线上问题的两大根源是"常驻内存数据污染"与"阻塞 IO 破坏协程调度",所有编码围绕这两点自查。**
> 与 Lumen/FPM 最大差异:进程常驻内存,变量跨请求留存;改代码必须重启服务才生效。

## 一、协程核心规范(最高优先级)

1. **严禁静态变量/全局变量/类成员属性存储请求级数据**(用户、商户、站点、token 等)。
   - ❌ `public static $userInfo;`、`$_GLOBALS['data']`、控制器可变成员属性
   - ✅ 协程上下文:`Hyperf\Context\Context::get()/set()`,本项目统一走
     `Mtrip\Shared\Context\{AdminContext, UserContext, ClientContext}` 封装
   - 多商户系统最高危 bug:静态属性跨协程复用 → A 商户看到 B 商户数据(越权)
   - 例外:与请求无关的进程级只读/计数数据允许静态(如 `OrderNoGenerator::$sequence`
     进程内序列,必须注释说明并保证不含请求数据)
2. **禁止协程内使用阻塞 IO**:
   - ❌ 原生 mysqli/PDO 直连、`file_get_contents` 请求外部 URL、未 hook 的 curl
   - ✅ DB 走 `Hyperf\DbConnection\Db`(连接池)、Redis 走 `hyperf/redis`、
     HTTP 外呼走 `hyperf/guzzle`(sink+swoole handler)并**必须设置超时**
   - 小文件读写允许;大文件/大量磁盘 IO 需评估(会阻塞当前 worker 协程调度)
3. **非协程环境不可读写 Context**:自定义 Process、Crontab、AsyncQueue 消费侧没有
   HTTP 请求上下文,拿不到登录用户/商户 ID;任务入参只传原始数据(数组/ID),
   禁止传 Request 对象或依赖 `AdminContext::get()`。
4. `defer` 跟随当前协程生命周期,不做跨协程资源回收,内部不抛业务异常。
5. **所有 `go()/Coroutine::create()` 内部必须包裹 try-catch**,未捕获异常直接销毁协程:
   ```php
   go(function () {
       try {
           // 业务代码
       } catch (\Throwable $e) {
           $logger->error($e->getMessage() . PHP_EOL . $e->getTraceAsString());
       }
   });
   ```
   当前项目无裸 `go()` 用法,新增时按此模板。

## 二、连接池(DB / Redis)

1. **池子不要设大**:所有服务实例连接总和 < MySQL `max_connections`。
   本项目基线:`DB_MAX_CONNECTIONS` env 驱动,默认 10(8 服务 × 2 worker × 10 = 160);
   生产按实例数重新核算,禁止开发配置直接上生产。
2. **防 `MySQL server has gone away`**:Hyperf 的 DB/Redis 池按 `max_idle_time`
   判定空闲失效重连(`heartbeat` 参数对 DB/Redis 池不生效,是 amqp/nsq 等
   KeepaliveConnection 用的)。约束:**`max_idle_time`(本项目 60s)必须小于
   MySQL `wait_timeout` 与中间层(LB/代理)空闲断连时间**。
3. **禁止 `new PDO` / `new Redis` 绕过连接池**;统一注入或 `Db::` / `RedisFactory` 获取。
4. 连接用完由框架自动归还;禁止把连接对象存入类属性/静态变量长期持有。

## 三、内存、进程模型与生产配置

1. **max_request 平滑重启防内存泄漏**:worker 处理 N 个请求后平滑退出重建。
   本项目 `server.settings`:`max_request = env(MAX_REQUEST, 10000)` + `max_request_grace = 200`。
2. 进程职责分离:
   - Worker:处理 HTTP 请求,重度耗时任务丢异步队列,禁止长时间同步阻塞
   - Task:适合阻塞型任务(第三方同步调用/大文件),内部不写协程代码
   - 自定义 Process/Crontab:独立运行,无 HTTP 上下文(见一.3)
3. 禁止在 Worker 启动回调、类构造函数、静态代码块里建 DB/Redis 连接(启动瞬间打爆 DB);
   延迟到用时从池获取。
4. **生产必须开启注解缓存** `scan_cacheable=true`(env `SCAN_CACHEABLE` 控制,
   deploy compose 默认 false 仅限开发);关闭时每次启动全量扫描注解,CPU 暴涨。
5. **改代码必须重启容器/服务**(`docker compose restart <svc>`);开发可用 watch,
   生产禁止 watch,只用平滑重启;生产禁用 xdebug。

## 四、异常、日志、超时

1. **所有 IO 调用必须有超时**:DB(pool `connect_timeout/wait_timeout` 已设)、
   Redis、HTTP Client、未来的 RPC。没有超时,一个慢第三方接口会耗尽协程,服务假死。
   新增 Redis 调用注意 phpredis 默认无读超时,长阻塞命令(如 `brPop`)必须显式传超时。
2. **禁止裸吞异常**:`catch` 至少记录 `getMessage()+getTraceAsString()`;
   业务异常(`BusinessException`)向上抛给全局处理器。
   例外(须注释):解密失败兜底返回空串/掩码、审计日志写入失败不阻断业务响应。
3. **生产不回传异常堆栈**:全局 `AppExceptionHandler` 对未知异常只返回
   `Result::error(SERVER_ERROR)`,完整堆栈仅落日志——保持该行为,新服务复用该处理器。
4. 日志:本项目容器内写 `runtime/logs/` 并挂载至 `deploy/logs/<服务名>/`(排查约定);
   若上 K8s/多副本,优先改 stdout 由采集器收集,避免高并发本地文件 IO 阻塞协程。
   `MTRIP_REQUEST_LOG` 全量请求日志为排查模式,**生产保持 false**。
5. 链路 trace_id 透传(HTTP → 服务 → 日志)当前未实现,列入待办;新增跨服务调用时优先补齐。

## 五、异步队列(引入 async-queue 时生效)

1. 消费侧是协程环境,遵守协程全部规范;不能读 HTTP Context,入参只传原始数据。
2. **支付/订单队列必须幂等**:重试会重复消费,防重复创建订单/重复退款
   (本项目已有 SubmitLockMiddleware/FormId 幂等,队列侧要另做业务幂等键)。
3. 单任务不超过消费超时,长任务拆分;消费进程数克制(进程数 × 池大小 = DB 连接消耗)。

## 六、微服务间调用(引入 RPC/服务间 HTTP 时生效)

1. 客户端必设 `connect_timeout + receive_timeout`,下游挂掉不设超时会协程耗尽雪崩。
2. 配置熔断降级(`hyperf/circuit-breaker`),防下游故障拖垮自身。
3. 只传基础数据,禁止传大对象/资源句柄;**RPC 服务端同样做参数校验与权限校验**,
   不信任上游入参。
4. 注册中心(Nacos/etcd)注意心跳与多实例部署。当前架构为网关(OpenResty)直达各服务,
   暂无 RPC;新增时补充本节配置。

## 七、安全编码(多商户平台重点)

1. 商户 ID、站点 ID、登录用户每次请求从 Context 取
   (`AdminContext` + `applySiteScope/assertSiteScope`),禁止缓存到成员属性。
2. 全部入参走 `AbstractController` 取参方法 + 校验;敏感字段 AES 加密落库、
   列表脱敏(`MaskHelper`)、超管才可见明文。
3. Crontab 任务无 HTTP 上下文,不依赖 request;耗时任务避开高峰期。

## 八、上线检查清单(逐项打勾)

- [ ] `APP_ENV=prod`,关闭 debug
- [ ] `SCAN_CACHEABLE=true`(注解缓存)
- [ ] `MAX_REQUEST` 生效(默认 10000)+ `max_request_grace`
- [ ] DB/Redis 池参数按生产实例数核算(总连接数 < MySQL max_connections)
- [ ] `max_idle_time` < MySQL `wait_timeout` 及 LB 空闲断连时间
- [ ] 所有第三方调用有超时;引入 RPC 后熔断器开启
- [ ] `MTRIP_REQUEST_LOG=false`;`MTRIP_CLIENT_SIGN/MTRIP_PAYLOAD_ENCRYPT/MTRIP_SUBMIT_LOCK=true`
- [ ] 全部 `*-change-me` 密钥(JWT/AES/管理端登录)替换为强随机值
- [ ] 关闭 watch 热重载,只用平滑重启;不装 xdebug
- [ ] 监控告警:错误数、协程数、连接池占用、内存、QPS

## 附:本项目现状核查(2026-07 审计)

| 检查项 | 结论 |
| --- | --- |
| 静态/全局变量存请求数据 | ✅ 无;仅 `OrderNoGenerator::$sequence` 进程级序列(安全,有注释) |
| 请求上下文 | ✅ 统一 `Context` 封装(Admin/User/ClientContext),中间件写入 |
| 阻塞 IO(file_get_contents/curl/new PDO/new Redis) | ✅ 未使用,DB/Redis 全走连接池 |
| 裸 `go()` /自定义进程/Crontab/队列 | ✅ 当前未使用(引入时按本规范) |
| 控制器/服务可变成员属性 | ✅ 无(依赖注入均只读) |
| 空 catch | ✅ 均为解密兜底/审计日志失败不阻断,带注释 |
| 异常堆栈泄漏 | ✅ `AppExceptionHandler` 未知异常只返回错误码,堆栈落日志 |
| 连接池 | ✅ max 10(env 可调),`max_idle_time=60s` 防 gone away |
| max_request | 🔧 已修复:100000 无 grace → env 驱动 10000 + grace 200 |
| 注解缓存 | 🔧 已修复:compose 硬编码 false → `${SCAN_CACHEABLE:-false}`,生产置 true |
| trace_id 链路透传 | ⏳ 待办(引入跨服务调用时优先实现) |
| 日志 stdout 化 | ⏳ 待办(K8s/多副本部署时切换;当前挂载 deploy/logs 为约定排查方式) |
