@echo off
chcp 936 >nul
setlocal EnableExtensions EnableDelayedExpansion
REM ============================================================
REM  Mtrip 开发环境 SQL 补灌(Windows 原生 / 无 Docker)
REM  scripts\db-apply.ps1(容器版)的本机 MySQL 等价实现:
REM    - 直接调用本机 mysql.exe 对 DB_HOST:DB_PORT 执行指定 SQL 文件
REM    - 仓库 SQL 均幂等(CREATE TABLE IF NOT EXISTS / 守卫式 ALTER)且
REM      头部自带 USE mtrip_xxx;,可安全重复灌入运行中的库
REM    - 按传入顺序逐个执行,任一失败继续跑完其余并汇总,退出码 1
REM
REM  用法:
REM    db-apply.bat database\merchant\03-group-store.sql
REM    db-apply.bat database\seed\02-menu.sql database\seed\04-merchant-menu.sql
REM    (相对路径以仓库根为基准;请逐个列出并按依赖排序)
REM
REM  连接配置(与 start-svc.bat / db-migrate.bat 同源):
REM    优先级:进程环境变量 > %USERPROFILE%\.mtrip\mtrip.env > 内置默认
REM    补灌初始化 SQL 通常需要建库/建表权限,可用环境变量覆盖为 root 账号:
REM      DB_ROOT_USER=root  DB_ROOT_PASSWORD=xxx
REM    MYSQL_EXE  mysql.exe 完整路径(默认取 PATH 中的 mysql)
REM    ENV_FILE   统一配置文件路径(默认 %USERPROFILE%\.mtrip\mtrip.env)
REM
REM  注意:仅用于开发环境补灌历史/初始化 SQL。版本化迁移一律用
REM        db-migrate.bat(Windows)/ db-migrate.sh(Linux),账本可追溯。
REM ============================================================

if "%~1"=="" goto :usage

REM ---------- 路径 ----------
set "SCRIPT_DIR=%~dp0"
for %%d in ("%SCRIPT_DIR%..") do set "REPO_ROOT=%%~fd"

REM ---------- 定位 mysql.exe ----------
set "MYSQL=%MYSQL_EXE%"
if not defined MYSQL for %%i in (mysql.exe) do set "MYSQL=%%~$PATH:i"
if not defined MYSQL (
  echo [FAIL] 未找到 mysql.exe。请把 MySQL bin 目录加入 PATH,或设置环境变量 MYSQL_EXE 指向 mysql.exe。
  exit /b 1
)

REM ---------- 读连接配置(优先级:进程环境变量 > mtrip.env > 内置默认) ----------
if not defined ENV_FILE set "ENV_FILE=%USERPROFILE%\.mtrip\mtrip.env"
if exist "%ENV_FILE%" (
  for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%ENV_FILE%") do (
    if /i "%%A"=="DB_HOST"     if not defined DB_HOST_ENV set "DB_HOST_ENV=%%B"
    if /i "%%A"=="DB_PORT"     if not defined DB_PORT_ENV set "DB_PORT_ENV=%%B"
    if /i "%%A"=="DB_USERNAME" if not defined ENV_USER    set "ENV_USER=%%B"
    if /i "%%A"=="DB_PASSWORD" if not defined ENV_PWD     set "ENV_PWD=%%B"
  )
)
if not defined DB_HOST if defined DB_HOST_ENV set "DB_HOST=!DB_HOST_ENV!"
if not defined DB_HOST set "DB_HOST=127.0.0.1"
if not defined DB_PORT if defined DB_PORT_ENV set "DB_PORT=!DB_PORT_ENV!"
if not defined DB_PORT set "DB_PORT=3306"
if not defined DB_USERNAME if defined ENV_USER set "DB_USERNAME=!ENV_USER!"
if not defined DB_USERNAME set "DB_USERNAME=mtrip"
if not defined DB_PASSWORD if defined ENV_PWD set "DB_PASSWORD=!ENV_PWD!"
if defined DB_ROOT_USER set "DB_USERNAME=%DB_ROOT_USER%"
if defined DB_ROOT_PASSWORD set "DB_PASSWORD=%DB_ROOT_PASSWORD%"

REM ---------- 临时凭证文件(规避密码特殊字符转义) ----------
set "WORK_DIR=%TEMP%\mtrip-db-apply-%RANDOM%"
mkdir "%WORK_DIR%" >nul 2>&1
set "MCRED=%WORK_DIR%\my.cnf"
> "%MCRED%" (
  echo [client]
  echo user="%DB_USERNAME%"
  echo password="%DB_PASSWORD%"
)
set "MCRED_OPT=--defaults-file=%MCRED%"

REM ---------- 连通性 ----------
"!MYSQL!" %MCRED_OPT% -h "!DB_HOST!" -P "!DB_PORT!" -e "SELECT 1" >nul 2>&1
if errorlevel 1 (
  echo [FAIL] 无法连接 MySQL !DB_HOST!:!DB_PORT!（账号 !DB_USERNAME!）,请检查服务、账号密码与授权。
  goto :fail
)

REM ---------- 逐个执行 ----------
set "TOTAL=0"
set "FAILED_N=0"
:next_file
if "%~1"=="" goto :summary
set /a TOTAL+=1
set "F=%~1"
REM 绝对路径(盘符开头或 UNC)直接使用,否则相对仓库根
set "ABS=0"
if "!F:~1,1!"==":" set "ABS=1"
if "!F:~0,1!"=="\" set "ABS=1"
if "%ABS%"=="0" set "F=%REPO_ROOT%\%F%"
for %%f in ("!F!") do set "F=%%~ff"
if not exist "!F!" (
  echo [!TOTAL!] [x] 找不到:%~1
  set /a FAILED_N+=1
  shift
  goto :next_file
)
for %%f in ("!F!") do set "NAME=%%~nxf"
echo [!TOTAL!] 执行 !NAME! ...
"!MYSQL!" %MCRED_OPT% -h "!DB_HOST!" -P "!DB_PORT!" --default-character-set=utf8mb4 < "!F!"
if errorlevel 1 (
  echo     [x] 失败:!NAME!
  set /a FAILED_N+=1
) else (
  echo     [ok] !NAME!
)
shift
goto :next_file

:summary
if not "%FAILED_N%"=="0" (
  echo.
  echo 失败 %FAILED_N% 个 / 共 %TOTAL% 个
  goto :fail
)
echo.
echo 全部成功(%TOTAL% 个脚本)
goto :ok_exit

:usage
echo 用法: %~nx0 ^<file1.sql^> [file2.sql ...]   (相对路径以仓库根为基准)
exit /b 2

:ok_exit
call :cleanup
exit /b 0

:fail
call :cleanup
exit /b 1

:cleanup
if defined WORK_DIR if exist "%WORK_DIR%" rd /s /q "%WORK_DIR%"
exit /b 0
