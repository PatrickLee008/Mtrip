# Mtrip Ops

Mtrip Ops 是独立于 Mtrip 业务代码的轻量运维控制台。它用一个 Node.js 单体进程提供服务端渲染页面,用于查看平台状态、服务健康、容器状态、业务日志、流量趋势和发布预检。

当前版本是零依赖 MVP:不需要 npm install,直接使用 Node.js 内置模块运行。后续需要历史指标、全文检索和账号体系时,再引入 SQLite 与模板/路由库。

## 快速启动

```bash
cd mtrip-ops
cp ops.config.example.json ops.config.json
npm start
```

默认监听:

```text
http://127.0.0.1:56700
```

本机 Docker 需要 sudo 时,默认配置使用非交互命令:

```json
"dockerCommand": ["sudo", "-n", "docker"]
```

运行用户需具备 Docker sudo 免密权限;否则诊断页会提示 `sudo` 密码或权限错误。

## 当前功能

- 总览页:网关、8 个主池服务、5 个 APP 孪生池服务健康检查,并展示请求样本、慢请求和 5xx 错误。
- 服务页:按服务展示 health、请求量、慢请求、5xx、Docker CPU/内存/网络负载;Docker 不可用时降级显示原因。
- 日志中心:支持关键词、服务、文件、状态码、慢请求、5xx 筛选,同时保留文件 tail 查看。
- 发布管理:支持全局 dry-run、DB 备份、全局 health、单服务日志/热重启/build 的白名单操作入口。
- 审计页:展示命令开始/结束事件,审计源为 `data/audit.log`。
- 文档页:内置方案、计划、安全模型、成熟软件调研。

## 安全默认值

- 默认只读:`enableActions=false`。
- 仅绑定本机:`host=127.0.0.1`。
- 子进程命令只走白名单,不用 shell 拼接用户输入。
- 发布/健康命令输出写入 `data/audit.log`。

生产使用前建议放在 VPN/堡垒机/SSH tunnel 后面,不要公网裸露。

## 目录

```text
mtrip-ops/
├── docs/                       # 方案、计划、安全模型、调研记录
├── public/                     # CSS 与少量浏览器脚本
├── src/                        # Node 单体应用源码
├── systemd/                    # systemd 示例
├── data/                       # 本地运行数据,不入 Git
├── ops.config.example.json     # 配置样例
└── package.json
```


## 使用提醒

当前已经不是纯 MVP,而是完整应用骨架:核心模块、页面结构和安全边界已搭好。后续会继续补实时图表、业务库只读看板、真实在线用户、告警通知、发布审批和更精细的单服务灰度发布。

## 界面模板

左侧主题切换器内置 4 套模板和 2 种密度:

- 玻璃:浅色玻璃拟态,适合日常运维。
- 黑色经典:深色稳重风格,适合监控室。
- 浅色专业:高对比浅色后台风格,适合长时间表格查看。
- 终端矩阵:绿色终端风格,适合大屏展示。
- 紧凑/舒展:紧凑模式优先展示更多内容,舒展模式适合讲解和投屏。

主题和密度保存在浏览器 `localStorage`,不影响服务端配置。

## 版本与发布时间

`/services` 已支持展示镜像、启动时间、运行时长、版本号、发布时间、Git SHA 和发布说明。启动时间/运行时长来自 Docker inspect;版本号/发布时间/发布说明需要 `deploy/release.json`、Docker labels 或环境变量提供。配置方式见 `mtrip-ops/docs/05-发布版本信息配置.md`。

## APP 孪生池状态说明

`/services` 会读取 `docker ps -a` 判断 APP 孪生池是否真实存在:

- `running`:容器存在且运行。
- `stopped/exited`:容器存在但未运行。
- `missing`:容器不存在,通常说明启动时没有加载 `docker-compose.app-pool.yml`。

当前网关 `/api/v1/app/*` 固定指向 APP 孪生池,不会自动回退主池。若 APP 孪生容器 missing/stopped,页面会显示路由风险,表示 C 端接口可能 502。

## 下一步计划

后续执行计划见 `mtrip-ops/docs/07-下一步执行计划.md`,页面入口为 `/docs/07`。
