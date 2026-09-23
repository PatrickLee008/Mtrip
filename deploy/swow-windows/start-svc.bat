@echo off
chcp 936 >nul
REM ============================================================
REM  Mtrip 单服务启动器(Windows 原生 / Swow)
REM  用法:  start-svc.bat <服务目录名> <HTTP端口>
REM  例:    start-svc.bat system-service 9501
REM
REM  原理:把统一配置文件里的 KEY=VALUE 逐行 set 进环境变量,再拉起
REM        php bin/hyperf.php start。Hyperf 直接读环境变量 —— 项目根
REM        目录【不需要】任何 .env,与生产 Docker 的注入方式一致。
REM ============================================================
setlocal

REM ── 1) 统一配置文件位置(项目外,自己维护;可用环境变量覆盖)──
if not defined ENV_FILE set "ENV_FILE=%USERPROFILE%\.mtrip\mtrip.env"

REM ── 2) 仓库 services 目录(按你的实际路径改;可用环境变量覆盖)──
if not defined REPO_SERVICES set "REPO_SERVICES=E:\GIT\jiaxu\Mtrip\backend\services"

if "%~2"=="" (
  echo [用法] start-svc.bat ^<服务目录名^> ^<HTTP端口^>
  echo        例: start-svc.bat system-service 9501
  exit /b 1
)
if not exist "%ENV_FILE%" (
  echo [错误] 找不到配置文件: %ENV_FILE%
  echo        请先把 mtrip.env.example 复制到该位置并按需修改。
  exit /b 1
)
if not exist "%REPO_SERVICES%\%~1\bin\hyperf.php" (
  echo [错误] 找不到服务: %REPO_SERVICES%\%~1
  exit /b 1
)

REM ── 3) 读统一配置,逐行注入环境变量(# 开头为注释,自动跳过)──
for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%ENV_FILE%") do set "%%A=%%B"

REM ── 4) 本服务专属端口(覆盖配置文件里可能残留的 HTTP_PORT)──
set "HTTP_PORT=%~2"

REM ── 5) 启动 ──
cd /d "%REPO_SERVICES%\%~1"
echo [启动] %~1  HTTP_PORT=%HTTP_PORT%  DB=%DB_HOST%:%DB_PORT%/%DB_SYSTEM_DATABASE%  REDIS=%REDIS_HOST%:%REDIS_PORT%/db%REDIS_DB%
php bin/hyperf.php start

endlocal
