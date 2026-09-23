# Windows 原生运行 Mtrip 后端(Swow,不依赖 Linux/Docker)

> 目的:在 Windows 上**不装 Docker、不用 WSL**,用 **Swow** 引擎原生 `php bin/hyperf.php start` 跑起 8 个 Hyperf 微服务,连**本机原生 MySQL(3306)/ Redis(6379)**,方便原生断点调试。
>
> **与生产完全隔离**:生产照旧用 `deploy/` 下的 Docker + Swoole + Linux,本目录**不动任何生产文件**(不改 `composer.json`、`server.php`)。唯一例外:`bin/hyperf.php` 加了**一行 pcntl 守卫的扫描器切换**——Windows 无 `pcntl` 时用 `ProcScanHandler`,Linux 生产有 `pcntl` 仍走默认 `PcntlScanHandler`,**生产行为零变化**(见 §3 与「常见坑」)。

---

## 0. 配置加载原理(为什么这里没有一堆 `.env`)

Hyperf 默认只从**服务根目录**读 `.env`(`bin/hyperf.php` 里的 `BASE_PATH`),不支持 `--env-file` 指定别处。**但 `.env` 文件不是必需的** —— Hyperf 最终读的是**环境变量**,`.env` 只是把变量灌进环境的一种方式。生产 Docker 就是**零 `.env`**、全靠 compose 的 `environment:` 注入环境变量。

所以这里的做法 = **和 Docker 同一个机制**:

```
mtrip.env(项目外,你自己维护一份)
   │  start-svc.bat 逐行 set 进环境变量
   ▼
环境变量  ──►  php bin/hyperf.php start  ──►  Hyperf env() 读到
```

好处:配置**统一成一个文件**、放项目外、仓库不收录、Docker 读不到 → 天然零泄漏,也不用改任何仓库代码。

> 8 个服务的 DB/Redis/密钥等环境变量**完全一致**,唯一区别是 `HTTP_PORT`(9501~9508),由启动脚本按服务传入。所以一份配置够用。

---

## 1. 一次性准备

### 1.1 装 Swow 扩展(替代 Swoole,Swoole 无 Windows 原生版)

1. 看你本机 PHP 版本/架构/线程安全:`php -v`(需 **PHP ≥ 8.1**;CLI 常驻建议用 **NTS x64**)。
2. 到 <https://github.com/swow/swow/releases> 下载**匹配**的 `php_swow-php8.1-x64-nts-VSxx.dll`(版本、x64、ts/nts、VS 编译器四项都要对得上)。
3. 拷进 PHP 的 `ext\` 目录,在 `php.ini` 加一行:`extension=swow`。
4. 验证:`php --ri swow` 能打印扩展信息即成功。

> composer **装不了这个扩展**(它是 C 扩展,不是 PHP 包)。也可 `composer require swow/swow` 后用 `vendor/bin/swow-builder --install` 现编,但 Windows 上直接下预编译 DLL 最省事。

### 1.2 安装 Swow 版依赖(用已生成的 composer-swow.json)

生产 `composer.json` 里是 `hyperf/engine`(Swoole),Swow 要换成 `hyperf/engine-swow`。**8 个服务的 `composer-swow.json` 已生成好**(与各自 `composer.json` 完全一致,仅把 `hyperf/engine` 换成 `ext-swow` + `hyperf/engine-swow`),原 `composer.json` 一字未动。

在**每个服务目录**里用该清单装依赖(装进本地 vendor,不碰 composer.lock):

```powershell
cd backend/services/system-service
$env:COMPOSER='composer-swow.json'; composer install; Remove-Item Env:\COMPOSER
# 其余 7 个服务同样操作(user/goods/order/merchant/finance/marketing/payment)
```

> - `vendor/` 只有一份,`hyperf/engine` 与 `hyperf/engine-swow` **不能共存**(都提供 `Hyperf\Engine\*`);用 `composer-swow.json` 装出来的就是 Swow 版,生产镜像在容器内用原 `composer.json` 自己装,互不影响。
> - `ext-swow` 已声明为平台依赖:想在装 DLL(1.1)前先跑 install,加 `--ignore-platform-req=ext-swow`。
> - 这 8 个文件从 `composer.json` 派生,可不提交(`.gitignore` 加 `composer-swow.json` / `composer-swow.lock`)。改了某服务 `composer.json` 后,一行重生成(仓库根目录,Git Bash):
>   ```bash
>   for s in system user goods order merchant finance marketing payment; do f="backend/services/$s-service"; sed 's#"hyperf/engine": "\^2\.10",#"ext-swow": "*",\n        "hyperf/engine-swow": "^2.0",#' "$f/composer.json" > "$f/composer-swow.json"; done
>   ```

### 1.3 本机 MySQL:建库 + 建 mtrip 账号 + 灌数据

**① 建库 + 建号(用你本机 root 登录 MySQL 执行一次)**

```sql
CREATE DATABASE IF NOT EXISTS mtrip_system  CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
CREATE DATABASE IF NOT EXISTS mtrip_business CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
CREATE USER IF NOT EXISTS 'mtrip'@'localhost' IDENTIFIED BY 'mtrip@2026';
CREATE USER IF NOT EXISTS 'mtrip'@'%'         IDENTIFIED BY 'mtrip@2026';
GRANT ALL PRIVILEGES ON mtrip_system.*  TO 'mtrip'@'localhost';
GRANT ALL PRIVILEGES ON mtrip_system.*  TO 'mtrip'@'%';
GRANT ALL PRIVILEGES ON mtrip_business.* TO 'mtrip'@'localhost';
GRANT ALL PRIVILEGES ON mtrip_business.* TO 'mtrip'@'%';
FLUSH PRIVILEGES;
```

> `utf8mb4_bin` 与生产一致(见 `databases.php` 和 compose 的 `--collation-server`)。与其他开发共用同一台 MySQL 没问题 —— 靠**库名隔离**,只多出 `mtrip_system`/`mtrip_business` 两个库,不碰别人的库。

**② 灌表结构 + 数据(推荐:从你现在跑着的 Docker MySQL 直接 dump 过来)**

你现在 Docker 里的 MySQL(宿主 3307)已经自动初始化好全部 ~130 个 SQL,直接搬最省事:

```bash
# 从 Docker MySQL(3307)导出两个库
mysqldump -h 127.0.0.1 -P 3307 -u root -proot@2026 --single-transaction --routines --events \
  --databases mtrip_system mtrip_business > mtrip-dump.sql

# 导入本机原生 MySQL(3306)
mysql -h 127.0.0.1 -P 3306 -u root -p < mtrip-dump.sql
```

> 纯不碰 Docker 的替代法:按 `deploy/docker-compose.yml` 里 mysql 服务 `initdb` 挂载的**顺序**,依次对 `127.0.0.1:3306` 执行 `database/` 下的 SQL(顺序敏感、约 130 个),或用 `scripts/db-apply.ps1` 逐个补灌。比 dump 法繁琐易错,能用 dump 就用 dump。

### 1.4 放置统一配置文件

把模板复制到项目**外**的固定位置(默认 `%USERPROFILE%\.mtrip\mtrip.env`),按需改值:

```powershell
mkdir "$env:USERPROFILE\.mtrip" -Force
Copy-Item deploy/swow-windows/mtrip.env.example "$env:USERPROFILE\.mtrip\mtrip.env"
```

值已按你的选择预置好(`127.0.0.1:3306` / `mtrip` 账号 / Redis `db=1`),一般无需再改。放别处的话,改 `start-svc.bat` 顶部的 `ENV_FILE` 即可。

---

## 2. 日常启动

```bat
REM 一键起全部 8 个服务(各开一个窗口看日志)
deploy\swow-windows\start-all.bat

REM 或单独起某个服务
deploy\swow-windows\start-svc.bat goods-service 9503
```

- 端口:system 9501 / user 9502 / goods 9503 / order 9504 / merchant 9505 / finance 9506 / marketing 9507 / payment 9508。
- 联调可直连 `http://127.0.0.1:95xx`;需要走网关(`/api/v1/...` 分发)时,另跑一个 OpenResty 指向这些本地端口即可(可选)。

---

## 3. 与生产 Docker 的隔离(重要)

| | 生产 / Docker | 本目录 / Windows 原生 |
| --- | --- | --- |
| 引擎 | Swoole(`hyperf/engine`) | Swow(`hyperf/engine-swow`,`composer-swow.json`) |
| 配置来源 | `deploy/.env` → compose `${..}` → 容器 `environment:` | `%USERPROFILE%\.mtrip\mtrip.env` → `start-svc.bat` set → 环境变量 |
| DB/Redis | 容器内网 `mysql:3306` / `redis:6379` | 本机 `127.0.0.1:3306` / `6379`(db=1) |
| 依赖清单 | `composer.json` / `composer.lock`(容器内装) | `composer-swow.json`(本地 vendor) |
| 注解扫描器 | `PcntlScanHandler`(容器有 `pcntl`,`pcntl_fork` 扫描) | `ProcScanHandler`(Windows 无 `pcntl`,`proc_open` 派生子进程扫描) |

**两套零交叉**:生产不读 `mtrip.env`(它在项目外),本地不读 `deploy/.env`;`composer.json` 一字未改。你问的"生产还是用 `deploy/.env` 吗"——**是的,生产完全照旧**。

> `bin/hyperf.php` 里那行改动是 `Hyperf\Di\ClassLoader::init(null, null, extension_loaded('pcntl') ? null : new Hyperf\Di\ScanHandler\ProcScanHandler())`。生产 Linux 镜像带 `pcntl`,三元恒取 `null` → 等价于原来的 `init()`(默认 `PcntlScanHandler`),**字节级同构、零风险**;仅 Windows 原生(无 `pcntl`)才切到 `ProcScanHandler`。

---

## 4. 常见坑

| 症状 | 原因 / 解决 |
| --- | --- |
| `php --ri swow` 无输出 | DLL 版本/架构/ts-nts 不匹配,或 `php.ini` 没加 `extension=swow`。重下匹配的 DLL。 |
| 启动报 `Class Hyperf\Engine\... not found` | 该服务没用 `composer-swow.json` 装依赖。回到 1.2 重装。 |
| `Fatal error: Missing pcntl extension`(`PcntlScanHandler`) | Windows PHP 无 `pcntl`。`bin/hyperf.php` 已用 `extension_loaded('pcntl') ? null : new ProcScanHandler()` 守卫,正常应自动走 `ProcScanHandler`;若仍报错,多半是从生产分支覆盖了 `bin/hyperf.php` 把这行丢了,补回即可。 |
| 配置没生效 / 连错库 | `mtrip.env` 存成了 UTF-8 **带 BOM**(首个变量名被污染)。改存 ANSI 或 UTF-8 无 BOM。 |
| `SQLSTATE... Access denied for user 'mtrip'` | 1.3 的建号/授权没执行,或密码不符。重跑那段 SQL。 |
| `server.php` 里 `SWOOLE_PROCESS` 未定义 | engine-swow 的 `constants.php` 会 polyfill 这些常量;若仍报错,确认 engine-swow 已装好(1.2)。 |
| `worker_num` / `socket_buffer_size` 等看着没生效 | 这些是 Swoole server 调优项,Swow 进程模型不同,部分被静默忽略,属正常。 |
| 想让 curl 调 app 接口免签名/免加密 | 把 `mtrip.env` 的 `MTRIP_CLIENT_SIGN` / `MTRIP_PAYLOAD_ENCRYPT` 设 `false`。 |

---

## 附:文件清单

| 文件 | 作用 |
| --- | --- |
| `mtrip.env.example` | 统一配置模板(复制到项目外维护) |
| `start-svc.bat` | 单服务启动器(注入环境变量 + 传端口 + 起 php) |
| `start-all.bat` | 一键起全部 8 个服务 |
| `../backend/services/*/composer-swow.json` | Swow 版依赖清单(已生成,引擎换 engine-swow) |
| `README-swow-windows.md` | 本文档 |

> 生产验证仍以 `Swoole + Linux`(Docker/WSL2/K8s)为准;Swow + 原生 Windows 建议只用于**本地开发调试**。
