# Git 发布流程

## 发布为什么需要 Git

Mtrip 的自动部署脚本 `scripts/auto-deploy.sh` 本身就是以 Git 为入口:

1. 检查工作区必须干净。
2. `git fetch origin <branch>`。
3. 判断本地是否落后远端。
4. 只允许 `ff-only` 快进。
5. 根据 before/after diff 决定前端构建、后端重启、APP 孪生池同步、网关重启和 DB 告警。

因此 Ops 发布页新增 Git 操作区,用于在部署前明确仓库状态。

## 当前 Ops 已接入

- Git 状态:`git status -sb`
- Fetch:`git fetch --prune origin`
- Pull:`git pull --ff-only`
- 最近提交:`git log --oneline -8`
- 发布 dry-run:`scripts/auto-deploy.sh --dry-run`
- DB 备份:`scripts/db-backup.sh`
- Health:`deploy/mtrip.sh health`
- 单服务操作:`mtrip.sh logs/restart/build <service>`

所有命令都走白名单,页面不能传任意 shell。

## 安全策略

- 默认 `enableActions=false`,页面只展示状态。
- 开启动作后,Git pull 也只允许 `--ff-only`,不做 rebase、merge commit、reset。
- 如果工作区 dirty,发布页会提示,不建议继续 pull/deploy。
- 所有动作写 `data/audit.log`。

## 后续完整发布编排

目标流程:

1. Git status:确认分支、HEAD、dirty 状态。
2. Git fetch:拉远端引用。
3. Dry-run:展示会变更哪些服务。
4. DB backup:发布前备份。
5. Deploy:执行 `auto-deploy.sh`。
6. Health:发布后健康检查。
7. Release manifest:写入 `deploy/release.json`。
8. Audit:保存完整发布记录。

单服务发布目标:

1. 选择服务。
2. 展示该服务最近提交/相关 diff。
3. 选择 restart 或 build。
4. 自动检测是否需要同步 `*-app` 孪生服务。
5. 执行后检查 health 与日志错误。
