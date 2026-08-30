# WSL2 部署方案(Windows 10,免 Docker Desktop)

> 目的:**不安装 Docker Desktop**,直接在 WSL2 里跑原生 Docker Engine(docker-ce),启动 Mtrip 全栈(MySQL + Redis + 8 微服务 + 网关)。
> 适用:**Windows 10**(Win11 步骤相同)。
> 与本目录其它文档的关系:本文只讲**如何把 WSL2 环境从零搭起来并跑通**;搭好之后的日常启停命令看 [`使用说明.md`](使用说明.md)(mtrip.sh 完整命令),docker compose 原语看 [`README.md`](README.md)。
>
> **命令分两类,已在每段用注释标注**:`# 【PowerShell 管理员】` 在 Windows 开始菜单右键 PowerShell「以管理员身份运行」;`# 【WSL / Ubuntu】` 在 WSL 的 Ubuntu 终端里执行。

---

## 0. 为什么选 WSL2 而不是 Docker Desktop

| | Docker Desktop | **WSL2 + 原生 docker-ce(本文)** |
| --- | --- | --- |
| 授权费 | 公司 >250 人 **或** 年营收 >$1000万 需付费 | **完全免费开源** |
| 引擎实质 | 底层也是跑在 WSL2 里 | 直接在 WSL2 里,少一层 GUI/桥接 |
| 用哪套脚本 | `deploy\*.bat`(自动拉起 Docker Desktop.exe) | **`deploy/mtrip.sh`**(在 WSL 里跑) |
| GUI | 有 | 无(纯命令行) |

> 结论:`.bat` 是给 Docker Desktop 写的;走 WSL2 方案就**改用 `mtrip.sh`**,功能一一对应(build / start / restart / health / logs / stop / clean)。

架构:

```
Windows 10  ──localhost 自动转发──►  WSL2 (Ubuntu + dockerd)  ──►  11 个容器
浏览器/Navicat 直接访问 localhost:8081 / 3307 / 6380         gateway/mysql/redis/8×service
```

---

## 1. 前置条件

1. **Win10 版本**:按 `Win+R` → 输入 `winver`,要求 **版本 1903(内部版本 18362)以上**;推荐 **21H2 / 22H2**(`wsl --install` 一键命令需要 2004 / 19041 以上,低于此见 1.2 手动路径)。
2. **开启 CPU 虚拟化**:任务管理器 → 性能 → CPU,右下角「虚拟化:已启用」。若是「已禁用」,进主板 BIOS 打开 `Intel VT-x` / `AMD-V`。

### 1.1 一键装 WSL2(推荐,Win10 2004+ / Win11)

```powershell
# 【PowerShell 管理员】
wsl --install -d Ubuntu
```

该命令自动:开启 WSL 与虚拟机平台功能、装 WSL2 内核、装 Ubuntu。**装完按提示重启电脑**。

### 1.2 手动开启(仅当 1.1 报错 / 系统版本偏低)

```powershell
# 【PowerShell 管理员】
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
# —— 重启电脑 ——
```

重启后装 WSL2 内核更新包:访问 <https://aka.ms/wsl2kernel> 下载 `wsl_update_x64.msi` 装上,然后:

```powershell
# 【PowerShell 管理员】
wsl --set-default-version 2
wsl --install -d Ubuntu        # 或到 Microsoft Store 搜 "Ubuntu" 安装
```

### 1.3 首次进入 Ubuntu

开始菜单点 **Ubuntu**,首次启动会让你设 **Linux 用户名 + 密码**(与 Windows 账户无关,密码请记住,后面 `sudo` 要用)。

装好后回到 PowerShell 确认是 **VERSION 2**:

```powershell
# 【PowerShell 管理员】
wsl --update            # 升级到最新 WSL(systemd 需要新版本)
wsl -l -v               # 期望看到 Ubuntu 的 VERSION 列是 2
```

---

## 2. 开启 systemd(让 Docker 能开机自启)

新版 WSL 支持 systemd,开启后可用 `systemctl` 管理 docker 并让它自启。

```bash
# 【WSL / Ubuntu】
sudo tee /etc/wsl.conf >/dev/null <<'EOF'
[boot]
systemd=true
EOF
```

改完让 WSL 完全重启一次(**这一步在 PowerShell 执行**):

```powershell
# 【PowerShell 管理员】
wsl --shutdown
```

再重新打开 Ubuntu,验证 systemd 生效:

```bash
# 【WSL / Ubuntu】
systemctl is-system-running     # 输出 running 或 degraded 都算 systemd 已起(degraded 只是有非关键服务没起)
```

> 若你的 WSL 版本太旧不支持 systemd(`systemctl` 报错),也能用,只是每次开机要手动 `sudo service docker start`(见 §10)。建议先 `wsl --update` 升级。

---

## 3. 在 WSL 里安装 Docker Engine(不是 Docker Desktop)

以下都在 **Ubuntu 终端**里执行。

### 3.1 装 docker-ce + compose 插件(官方 apt 源)

```bash
# 【WSL / Ubuntu】
# 1) 基础依赖
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg

# 2) 导入 Docker 官方 GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# 3) 添加 apt 源
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
| sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 4) 安装引擎 + CLI + compose 插件 + buildx
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

> **国内网络拉不动**:把上面第 2、3 步的 `download.docker.com` 换成清华镜像 `https://mirrors.tuna.tsinghua.edu.cn/docker-ce`,或直接用官方一键脚本 `curl -fsSL https://get.docker.com | sudo sh`(脚本支持 `--mirror Aliyun`)。

### 3.2 让当前用户免 sudo 用 docker

```bash
# 【WSL / Ubuntu】
sudo usermod -aG docker $USER
```

**改完必须重开 WSL 让用户组生效**:

```powershell
# 【PowerShell 管理员】
wsl --shutdown
```

### 3.3 启动 Docker 并设为自启

```bash
# 【WSL / Ubuntu】   —— 有 systemd 时
sudo systemctl enable --now docker
docker run --rm hello-world      # 出现 "Hello from Docker!" 即成功
docker compose version           # 确认 compose 插件在(mtrip.sh 依赖它)
```

> 没有 systemd 时改用:`sudo service docker start`(每次开机手动跑,或写进 shell 启动文件)。

### 3.4(可选)配置国内镜像加速

`docker compose build` 会拉 mysql / redis / openresty / hyperf 等基础镜像,国内建议加速:

```bash
# 【WSL / Ubuntu】
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json >/dev/null <<'EOF'
{
  "registry-mirrors": ["https://docker.mirrors.ustc.edu.cn", "https://hub-mirror.c.163.com"]
}
EOF
sudo systemctl restart docker      # 无 systemd 用:sudo service docker restart
docker info | grep -A3 "Registry Mirrors"
```

> 公共加速地址时有失效,若拉取仍超时可换其它可用镜像源。

---

## 4. 取得代码

**方案 A(推荐,性能好):把仓库 clone 到 WSL 内部文件系统**

WSL 的 Linux 原生盘(ext4)读写快,`docker-compose.override.yml` 的源码热挂载不卡:

```bash
# 【WSL / Ubuntu】
cd ~
git clone <你的仓库地址> Mtrip
cd Mtrip/deploy
```

**方案 B(省事,但慢):直接用 Windows 上现有的仓库**

WSL 里 Windows 盘挂在 `/mnt/`,E 盘即 `/mnt/e`:

```bash
# 【WSL / Ubuntu】
cd /mnt/e/GIT/jiaxu/Mtrip/deploy
```

> 方案 B 注意两点(跨 `/mnt` 有坑):
> 1. `chmod +x` 在 `/mnt` 上可能不生效,**改用 `bash mtrip.sh ...` 调用**(不要 `./mtrip.sh`)。
> 2. 若仓库在 Windows 上以 CRLF 检出,`mtrip.sh` 会报 `$'\r': command not found`,先修换行:`sed -i 's/\r$//' mtrip.sh`。
> 3. bind-mount 到 `/mnt/e` 的容器文件 I/O 明显慢于方案 A,大量改代码/构建时体感差别大。

---

## 5. 一键起服务

在 `deploy/` 目录里(**方案 A** 用 `./mtrip.sh`,**方案 B** 用 `bash mtrip.sh`):

```bash
# 【WSL / Ubuntu】—— 以方案 A 为例
sudo apt-get install -y curl      # health 探活要用 curl,通常已自带
chmod +x mtrip.sh                 # 方案 A 需要;方案 B 跳过并改用 bash 调用

./mtrip.sh build                  # 首次:构建镜像 + 启动全部(分钟级,自动生成 .env、建 uploads/)
./mtrip.sh health                 # 验证:8 微服务 + 网关全绿即 OK
```

`build` 成功后脚本会打印入口。`.env` 由脚本从 `.env.example` 自动复制生成(本地默认值即可跑,生产务必改密钥与密码)。

| 入口 | 地址(Windows 浏览器/工具直接访问) | 账号/说明 |
| --- | --- | --- |
| 网关(admin/app/merchant/supplier 统一入口) | http://localhost:8081 | `.env` 的 `GATEWAY_HOST_PORT` |
| 微服务直连 healthz | http://localhost:9501 ~ 9508 | system/user/goods/order/merchant/finance/marketing/payment |
| MySQL | localhost:**3307** | `mtrip` / `mtrip@2026`(root:`root@2026`) |
| Redis | localhost:**6380** | — |
| 管理后台默认登录 | 见下方 admin-web | `admin` / `Admin@123456` |

---

## 6. 从 Windows 访问 WSL 里的服务

WSL2 **默认把 WSL 里监听的端口转发到 Windows 的 localhost**,所以:

- Windows 浏览器直接开 <http://localhost:8081> 就能连到 WSL 里的网关;
- Navicat / DBeaver 连 `localhost:3307`(MySQL)、`localhost:6380`(Redis)照常;
- 无需手动做端口映射。

> 极少数情况下 localhost 转发失效(如装了某些 VPN/网络工具),可在 WSL 里 `hostname -I` 拿到 WSL 的 IP,直接用 `http://<该IP>:8081`。

---

## 7. 前端(admin-web / client-app)在哪跑

后端全栈在 WSL 的 docker 里;**前端可留在 Windows 跑,也可以在 WSL 跑**,都通过 `localhost:8081` 连网关,二选一即可:

- **Windows 侧(简单)**:照 `CLAUDE.md`,在 Windows 的 `admin-web/` 里 `npm install; npm run dev`,浏览器开 http://localhost:5173,接口走 localhost:8081 网关。
- **WSL 侧**:在 WSL 里装 Node 后于 `admin-web/` 跑 `npm run dev` —— 若代码是方案 A clone 在 WSL 内,这样最顺。

移动端 `client-app`(Expo)同理:`npm run typecheck` / `npm start`。

---

## 8. 日常命令速查

在 `deploy/` 下(方案 A `./mtrip.sh`,方案 B `bash mtrip.sh`)。完整说明见 [`使用说明.md`](使用说明.md)。

| 场景 | 命令 | 耗时 |
| --- | --- | --- |
| 启动全部(不重建) | `./mtrip.sh start` | ~10 秒 |
| 只改了 PHP 代码,热重启 | `./mtrip.sh restart goods-service` | ~2 秒 |
| 改了 Dockerfile / 加了 composer 依赖 | `./mtrip.sh build user-service` | 分钟级 |
| 改了网关路由 `openresty/conf.d/mtrip.conf` | `./mtrip.sh restart gateway` | ~2 秒 |
| 网关全 502(重建后 IP 变) | `./mtrip.sh restart gateway` | ~2 秒 |
| 部署后探活 | `./mtrip.sh health` | 秒级 |
| 看某服务日志 | `./mtrip.sh logs order-service` | Ctrl+C 退 |
| 停止(保留数据) | `./mtrip.sh stop` | — |
| 删容器保数据卷 | `./mtrip.sh down` | — |
| 清库重来(**删数据**) | `./mtrip.sh clean` 然后 `./mtrip.sh build` | 分钟级 |

> 数据库增量 SQL 走 `scripts/db-apply.ps1`(Windows 侧)或在 WSL 里对 `localhost:3307` 直接执行,不必清库。

---

## 9. 常见坑

| 症状 | 原因 / 解决 |
| --- | --- |
| `mtrip.sh: $'\r': command not found` | 文件被转成 CRLF。`sed -i 's/\r$//' mtrip.sh`(方案 B 常见)。 |
| `permission denied: ./mtrip.sh` | 方案 A:`chmod +x mtrip.sh`;方案 B(在 /mnt 上 chmod 不生效):改用 `bash mtrip.sh ...`。 |
| `Cannot connect to the Docker daemon` | docker 没起。有 systemd:`sudo systemctl start docker`;无 systemd:`sudo service docker start`。 |
| `docker` 每条都要 sudo | 没加入 docker 组或没重开 WSL。`sudo usermod -aG docker $USER` 后 `wsl --shutdown` 再进。 |
| 重开 WSL 后 docker 又没了 | 无 systemd 时不会自启。开 §2 的 systemd,或把 `sudo service docker start` 写进 `~/.bashrc`。 |
| `localhost:8081` 连不上但容器是 Up | 极少见的 localhost 转发失效。用 `hostname -I` 拿 WSL IP 直连;或 `wsl --shutdown` 重启 WSL。 |
| `3307`/`8081` 端口被占 | 改 `deploy/.env` 的 `MYSQL_HOST_PORT` / `GATEWAY_HOST_PORT` 后 `./mtrip.sh start`。 |
| 构建/运行很慢(方案 B) | 代码在 `/mnt/e`,跨盘 I/O 慢。改用方案 A(clone 进 WSL `~/`)。 |
| WSL 吃满内存 | 11 个容器较重。在 Windows 用户目录建 `%UserProfile%\.wslconfig` 限流/给量:见下。 |

**`.wslconfig`(可选,Windows 侧调 WSL 资源上限)** —— 建在 `C:\Users\<你>\.wslconfig`,改完 `wsl --shutdown` 生效:

```ini
[wsl2]
memory=6GB
processors=4
swap=2GB
```

---

## 10. 无 systemd 时的替代启动

若不便开 systemd,用 SysV 方式管理 docker:

```bash
# 【WSL / Ubuntu】
sudo service docker start        # 启动
sudo service docker status       # 查看
```

想每次开 WSL 自动起,可在 `~/.bashrc` 末尾加一行(会在首次开终端时以 sudo 拉起,可能要输密码):

```bash
# 【WSL / Ubuntu】
echo 'sudo service docker status >/dev/null 2>&1 || sudo service docker start' >> ~/.bashrc
```

---

## 11. 停止 / 清理 / 卸载

```bash
# 【WSL / Ubuntu】—— 应用层
./mtrip.sh stop                  # 停容器,保数据
./mtrip.sh clean                 # 删容器 + 数据卷(清库,需输 yes 确认)
```

```powershell
# 【PowerShell 管理员】—— 环境层
wsl --shutdown                   # 关掉 WSL(释放内存)
wsl --unregister Ubuntu          # 彻底删除该 Ubuntu 发行版及其中所有数据(含 docker 镜像/卷),慎用
```

---

## 附:与 `.bat` 的对应关系

| Windows `.bat`(Docker Desktop) | WSL2 等价 |
| --- | --- |
| `start.bat` | `./mtrip.sh start`(首次 `./mtrip.sh build`) |
| `stop.bat` | `./mtrip.sh stop` |
| `restart.bat <服务>` | `./mtrip.sh restart <服务>` |
| `status.bat` | `./mtrip.sh status` + `./mtrip.sh health` |
| `reinit.bat` | `./mtrip.sh clean` 然后 `./mtrip.sh build` |
| `logs.bat` | `./mtrip.sh logs [服务]` |
| `update-sql.bat` | `scripts/db-apply.ps1`(Windows 侧)或对 `localhost:3307` 直接执行 SQL |
