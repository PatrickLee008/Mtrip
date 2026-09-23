@echo off
chcp 936 >nul
setlocal EnableExtensions EnableDelayedExpansion
REM ============================================================
REM  Mtrip 数据库版本迁移(Windows 原生 / 无 Docker 无 WSL)
REM  scripts\db-migrate.sh 的 bat 等价实现,账本/校验语义完全一致:
REM    - 按 database\migrations\VYYYYMMDDHHMMSS__lower-kebab.sql 全局版本增量执行
REM    - 账本 mtrip_system.schema_migrations 记录 SHA-256/Git/执行节点/耗时
REM    - 已登记版本被改写、状态非 applied、倒序补迁移、账本有 running/failed 即阻断
REM    - 每次执行走 GET_LOCK 咨询锁 mtrip_schema_migrations 防并发
REM
REM  用法:
REM    db-migrate.bat            对比并执行待执行迁移(等价 db-migrate.sh 默认 apply)
REM    db-migrate.bat status     只列待执行版本,不写库(等价 --status)
REM    db-migrate.bat dry-run    同 status,供发布前预检(等价 --dry-run)
REM    db-migrate.bat validate   只做迁移文件命名/唯一性校验,完全不连库(等价 --validate)
REM    db-migrate.bat help       显示本帮助
REM
REM  连接配置(与 start-svc.bat 同源,默认读 %USERPROFILE%\.mtrip\mtrip.env):
REM    DB_HOST / DB_PORT / DB_USERNAME / DB_PASSWORD(需对 mtrip_system 有建表权限)
REM    优先级:进程环境变量 > mtrip.env > 内置默认(127.0.0.1:3306/mtrip)
REM    DB_ROOT_USER / DB_ROOT_PASSWORD 可整体覆盖执行账号。
REM    MYSQL_EXE   mysql.exe 完整路径(默认取 PATH 中的 mysql)
REM    ENV_FILE    统一配置文件路径(默认 %USERPROFILE%\.mtrip\mtrip.env)
REM    GIT_EXE     git.exe 完整路径(默认取 PATH 中的 git,仅用于登记 git_commit)
REM
REM  说明:本脚本用 --defaults-file 临时凭证文件传密码,规避密码中 @ 等特殊字符
REM        的命令行转义问题,执行完毕即删除。生产发布仍以 auto-deploy.sh +
REM        db-migrate.sh(Linux/Docker)为准,本脚本面向 Windows 本地开发/联调。
REM ============================================================

REM ---------- 参数 ----------
set "MODE=apply"
if "%~1"=="" goto :mode_done
set "MODE="
for %%m in (validate status dry-run) do if /i "%~1"=="%%m" set "MODE=%%m"
if /i "%~1"=="--validate" set "MODE=validate"
if /i "%~1"=="--status"   set "MODE=status"
if /i "%~1"=="--dry-run"  set "MODE=dry-run"
if /i "%~1"=="-h"         set "MODE=help"
if /i "%~1"=="--help"     set "MODE=help"
if /i "%~1"=="help"       set "MODE=help"
if not defined MODE set "MODE=bad"
if not "%~2"=="" set "MODE=bad"
:mode_done
if "%MODE%"=="help" goto :help
if "%MODE%"=="bad"  goto :bad_arg

REM ---------- 路径与常量 ----------
set "SCRIPT_DIR=%~dp0"
for %%d in ("%SCRIPT_DIR%..") do set "REPO_ROOT=%%~fd"
set "MIG_DIR=%REPO_ROOT%\database\migrations"
set "LEDGER_DDL=%REPO_ROOT%\database\init\01-schema-migrations.sql"
set "WORK_DIR=%TEMP%\mtrip-db-migrate-%RANDOM%"
mkdir "%WORK_DIR%" >nul 2>&1
if not exist "%WORK_DIR%" (
  echo [FAIL] 无法创建临时工作目录 %WORK_DIR%
  goto :fail_nocleanup
)
set "MCRED=%WORK_DIR%\my.cnf"
set "FILES=%WORK_DIR%\files.txt"
set "LOCK_TIMEOUT=%MYSQL_MIGRATION_LOCK_TIMEOUT%"
if not defined LOCK_TIMEOUT set "LOCK_TIMEOUT=60"

REM ---------- 定位 mysql.exe(validate 模式不连库,跳过检测) ----------
set "MYSQL=%MYSQL_EXE%"
if not defined MYSQL for %%i in (mysql.exe) do set "MYSQL=%%~$PATH:i"
if not defined MYSQL if /i not "%MODE%"=="validate" (
  echo [FAIL] 未找到 mysql.exe。请把 MySQL bin 目录加入 PATH,或设置环境变量 MYSQL_EXE 指向 mysql.exe。
  goto :fail
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

REM ---------- 临时凭证文件(引号包裹,兼容密码中的特殊字符;validate 跳过) ----------
if /i not "%MODE%"=="validate" > "%MCRED%" (
  echo [client]
  echo user="%DB_USERNAME%"
  echo password="%DB_PASSWORD%"
)
set "MCRED_OPT=--defaults-file=%MCRED%"

REM ---------- 迁移目录检查 ----------
if not exist "%MIG_DIR%\" (
  echo [FAIL] 迁移目录不存在: %MIG_DIR%
  goto :fail
)
if exist "%MIG_DIR%\*\" (
  echo [FAIL] 迁移目录必须保持单层,不能使用子目录
  goto :fail
)

REM ---------- 文件名列表(ASCII 安全排序) ----------
dir /b "%MIG_DIR%\*.sql" 2>nul | sort > "%FILES%"
set "TOTAL=0"
for /f usebackq^ delims^=^ eol^= %%n in ("%FILES%") do set /a TOTAL+=1
if not "%TOTAL%"=="0" goto :files_ok
if "%MODE%"=="apply" (
  echo [INFO] 无迁移文件,视为已是最新版本
) else (
  echo [FAIL] 迁移目录为空: %MIG_DIR%
  goto :fail
)
:files_ok

if "%MODE%"=="validate" goto :validate_only

REM ---------- 登记信息与凭证探测 ----------
set "GIT_COMMIT="
set "GITCMD=%GIT_EXE%"
if not defined GITCMD for %%i in (git.exe) do set "GITCMD=%%~$PATH:i"
if defined GITCMD for /f "usebackq delims=" %%v in (`"!GITCMD!" -C "%REPO_ROOT%" rev-parse HEAD 2^>^&1`) do set "GIT_COMMIT=%%v"
REM 合法 commit 必为 40 位;长度不符或含空白则用占位
if not "!GIT_COMMIT:~40,1!"=="" set "GIT_COMMIT="
set "GIT_COMMIT2="
for /f "tokens=1" %%v in ("!GIT_COMMIT!") do set "GIT_COMMIT2=%%v"
if not "!GIT_COMMIT2!"=="!GIT_COMMIT!" set "GIT_COMMIT="
if not defined GIT_COMMIT set "GIT_COMMIT=0000000000000000000000000000000000000000"

REM 执行节点名清洗:非 [A-Za-z0-9._@:-] 一律替换为下划线,截 128(与 sh 版 tr 语义一致)
set "ACTOR=%USERNAME%@%COMPUTERNAME%"
set "SAN_IN=%ACTOR:'='''%"
for /f "usebackq delims=" %%v in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "(('%SAN_IN%') -replace '[^A-Za-z0-9._@:-]','_')[0..127] -join ''" 2^>nul`) do set "ACTOR=%%v"
if not defined DEPLOY_ACTOR set "DEPLOY_ACTOR=%ACTOR%"

REM ---------- 连通性 ----------
"!MYSQL!" %MCRED_OPT% -h "!DB_HOST!" -P "!DB_PORT!" -e "SELECT 1" >nul 2>&1
if errorlevel 1 (
  echo [FAIL] 无法连接 MySQL !DB_HOST!:!DB_PORT!（账号 !DB_USERNAME!）,请检查服务、账号密码与授权。
  goto :fail
)

REM ---------- 账本存在性 ----------
set "LEDGER_EXISTS="
for /f usebackq^ delims^=^ eol^= %%v in (`"!MYSQL!" %MCRED_OPT% -h "!DB_HOST!" -P "!DB_PORT!" -N -B -e "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='mtrip_system' AND TABLE_NAME='schema_migrations'"`) do set "LEDGER_EXISTS=%%v"
if not "!LEDGER_EXISTS!"=="1" (
  if "%MODE%"=="status" goto :ledger_pending_all
  if "%MODE%"=="dry-run" goto :ledger_pending_all
  echo [INFO] 迁移账本不存在,创建 mtrip_system.schema_migrations
  "!MYSQL!" %MCRED_OPT% -h "!DB_HOST!" -P "!DB_PORT!" --default-character-set=utf8mb4 < "!LEDGER_DDL!"
  if errorlevel 1 (
    echo [FAIL] 创建迁移账本失败
    goto :fail
  )
  echo [OK] 已创建 mtrip_system.schema_migrations
)
goto :precheck

:ledger_pending_all
call :log "迁移账本尚未创建;当前 %TOTAL% 个版本均视为待执行"
for /f usebackq^ delims^=^ eol^= %%n in ("%FILES%") do echo   PENDING  %%n
goto :ok_exit

REM ---------- validate:仅命名/重号校验 ----------
:validate_only
set "VF_ERR=0"
set "VCOUNT=0"
for /f "delims==" %%v in ('set SEEN_ 2^>nul') do set "%%v="
for /f usebackq^ delims^=^ eol^= %%n in ("%FILES%") do call :check_name "%%n"
if "%VF_ERR%"=="0" (
  call :log "迁移命名校验通过,共 %VCOUNT% 个版本"
  goto :ok_exit
)
echo [FAIL] 命名校验失败,请修正 database\migrations 下的文件名
goto :fail

:bad_arg
echo 未知参数: %*
echo 支持: 无参数=apply 或 status / dry-run / validate / help,最多一个参数
goto :fail_nocleanup

:help
echo.
echo Mtrip 数据库版本迁移(Windows 原生,无 Docker)
echo.
echo  用法:
echo    db-migrate.bat            对比并执行 database\migrations 下待执行迁移
echo    db-migrate.bat status     只列待执行版本,不写库
echo    db-migrate.bat dry-run    同 status,供发布前预检
echo    db-migrate.bat validate   只做迁移文件命名/唯一性校验,不连库
echo.
echo  连接配置默认读 %USERPROFILE%\.mtrip\mtrip.env(DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD),
echo  可用环境变量覆盖:DB_HOST DB_PORT DB_USERNAME DB_ROOT_USER DB_ROOT_PASSWORD
echo  MYSQL_EXE= mysql.exe 完整路径(默认取 PATH);ENV_FILE= 配置文件路径
echo.
echo  与 scripts\db-migrate.sh 同一套账本(mtrip_system.schema_migrations)与校验规则。
exit /b 0


REM ============================================================
REM  precheck:逐版本与账本比对(命名/SHA-256/状态/顺序/重号)
REM ============================================================
:precheck
set "VF_ERR=0"
set "VCOUNT=0"
set "PEND_COUNT=0"
set "APPLIED_SEEN=0"
set "INTEGRITY_FAILED=0"
for /f "delims==" %%v in ('set SEEN_ 2^>nul') do set "%%v="
for /f usebackq^ delims^=^ eol^= %%n in ("%FILES%") do call :precheck_one "%%n"
if "%VF_ERR%"=="0" goto :vf_pass
echo [FAIL] 迁移文件命名/重号校验失败(见上方提示)
goto :fail
:vf_pass

REM ---------- 账本整体复核 ----------
set "LEDGER_APPLIED="
for /f usebackq^ delims^=^ eol^= %%v in (`"!MYSQL!" %MCRED_OPT% -h "!DB_HOST!" -P "!DB_PORT!" -N -B -e "SELECT COUNT(*) FROM mtrip_system.schema_migrations WHERE status='applied'"`) do set "LEDGER_APPLIED=%%v"
if not defined LEDGER_APPLIED (
  echo [FAIL] 统计迁移账本失败
  goto :fail
)
if not "!LEDGER_APPLIED!"=="!APPLIED_SEEN!" (
  echo [FAIL] 账本有 !LEDGER_APPLIED! 个已执行版本,但仓库只匹配到 !APPLIED_SEEN! 个;禁止删除已发布迁移文件
  set "INTEGRITY_FAILED=1"
)
set "LEDGER_INCOMPLETE="
for /f usebackq^ delims^=^ eol^= %%v in (`"!MYSQL!" %MCRED_OPT% -h "!DB_HOST!" -P "!DB_PORT!" -N -B -e "SELECT COUNT(*) FROM mtrip_system.schema_migrations WHERE status != 'applied'"`) do set "LEDGER_INCOMPLETE=%%v"
if not defined LEDGER_INCOMPLETE (
  echo [FAIL] 统计未完成迁移失败
  goto :fail
)
if not "!LEDGER_INCOMPLETE!"=="0" (
  echo [FAIL] 账本存在 !LEDGER_INCOMPLETE! 个 running/failed 版本,需人工核对后处理
  set "INTEGRITY_FAILED=1"
)
set "MAX_APPLIED="
for /f usebackq^ delims^=^ eol^= %%v in (`"!MYSQL!" %MCRED_OPT% -h "!DB_HOST!" -P "!DB_PORT!" -N -B -e "SELECT COALESCE(MAX(version),'') FROM mtrip_system.schema_migrations WHERE status='applied'"`) do set "MAX_APPLIED=%%v"
if not "%PEND_COUNT%"=="0" (
  set /a "LASTP=PEND_COUNT-1"
  for /L %%i in (0,1,!LASTP!) do call :check_order %%i
)
if "%INTEGRITY_FAILED%"=="0" goto :integrity_pass
goto :fail
:integrity_pass

call :log "版本对比完成: 已执行 %APPLIED_SEEN%, 待执行 %PEND_COUNT%"
if not "%PEND_COUNT%"=="0" (
  set /a "LASTP=PEND_COUNT-1"
  for /L %%i in (0,1,!LASTP!) do echo   PENDING  !PENDN_%%i!
)
if "%MODE%"=="status" goto :ok_exit
if "%MODE%"=="dry-run" goto :ok_exit
if "%PEND_COUNT%"=="0" (
  call :log "数据库已是最新版本"
  goto :selfstatus
)

REM ============================================================
REM  执行待迁移版本(任一失败即停止后续)
REM ============================================================
set "APPLIED_OK=0"
:apply_loop
if %APPLIED_OK% geq %PEND_COUNT% goto :apply_done
call :apply_one %APPLIED_OK%
if errorlevel 1 goto :fail
set /a APPLIED_OK+=1
goto :apply_loop
:apply_done
call :log "全部迁移成功,共执行 %PEND_COUNT% 个版本,进行完整账本复核"
:selfstatus
call "%~f0" status
if errorlevel 1 (
  echo [FAIL] 账本复核未通过
  goto :fail
)
goto :ok_exit

REM ---------- 倒序补迁移检查 ----------
:check_order
set "CO_I=%~1"
if defined MAX_APPLIED if "!PENDV_%CO_I%!" LSS "!MAX_APPLIED!" (
  echo [FAIL] 待执行版本 !PENDV_%CO_I%! 低于已上线最高版本 !MAX_APPLIED!;禁止倒序补迁移
  set "INTEGRITY_FAILED=1"
)
exit /b 0

REM ---------- 单个版本比对 ----------
:precheck_one
set "PO_NAME=%~1"
set "PO_FULL=%MIG_DIR%\%PO_NAME%"
call :check_name "%PO_NAME%"
if errorlevel 1 exit /b 0
if not exist "%PO_FULL%" (
  echo [FAIL] 文件列表与实际不一致,读不到: %PO_NAME%
  set "INTEGRITY_FAILED=1"
  exit /b 0
)
set "PO_VER=!PO_NAME:~1,14!"
set "PO_DESC=%PO_NAME:~17,-4%"
call :sha256 "%PO_FULL%"
if errorlevel 1 (
  echo [FAIL] 无法计算迁移 SHA-256: %PO_NAME%
  set "INTEGRITY_FAILED=1"
  exit /b 0
)
set "PO_SUM=!SUM!"
set "PO_RPATH=database/migrations/%PO_NAME%"
set "PO_ROW="
for /f usebackq^ delims^=^ eol^= %%v in (`"!MYSQL!" %MCRED_OPT% -h "!DB_HOST!" -P "!DB_PORT!" -N -B -e "SELECT CONCAT(checksum,0x7C,status,0x7C,script_path) FROM mtrip_system.schema_migrations WHERE version='!PO_VER!'"`) do set "PO_ROW=%%v"
if defined PO_ROW goto :po_compare
set "PENDN_!PEND_COUNT!=%PO_NAME%"
set "PENDV_!PEND_COUNT!=!PO_VER!"
set "PENDS_!PEND_COUNT!=%PO_DESC%"
set "PENDC_!PEND_COUNT!=!PO_SUM!"
set /a PEND_COUNT+=1
exit /b 0
:po_compare
for /f "tokens=1,2,3 delims=|" %%a in ("!PO_ROW!") do (
  set "PO_CK=%%a"
  set "PO_ST=%%b"
  set "PO_SP=%%c"
)
if not "!PO_CK!"=="!PO_SUM!" (
  echo [FAIL] 版本 !PO_VER! 已登记但文件内容 SHA-256 被改写: %PO_NAME%
  set "INTEGRITY_FAILED=1"
  exit /b 0
)
if not "!PO_SP!"=="!PO_RPATH!" (
  echo [FAIL] 版本 !PO_VER! 已登记但脚本路径被改写: !PO_SP!
  set "INTEGRITY_FAILED=1"
  exit /b 0
)
if not "!PO_ST!"=="applied" (
  echo [FAIL] 版本 !PO_VER! 当前状态为 !PO_ST!,需人工核对后处理
  set "INTEGRITY_FAILED=1"
  exit /b 0
)
set /a APPLIED_SEEN+=1
exit /b 0

REM ---------- 执行单个版本 ----------
:apply_one
set "IX=%~1"
set "AO_NAME=!PENDN_%IX%!"
set "AO_VER=!PENDV_%IX%!"
set "AO_DESC=!PENDS_%IX%!"
set "AO_SUM=!PENDC_%IX%!"
set "AO_FULL=%MIG_DIR%\!AO_NAME!"
set "AO_SQLPATH=!AO_FULL:\=/!"
set "AO_ATTEMPT=!GIT_COMMIT:~0,8!-%RANDOM%%RANDOM%"
call :log "执行 !AO_NAME!"
set "AO_CTL=%WORK_DIR%\ctl-!AO_VER!.sql"
> "%AO_CTL%" echo SET NAMES utf8mb4;
>>"%AO_CTL%" echo SET @mtrip_lock_acquired := GET_LOCK('mtrip_schema_migrations', %LOCK_TIMEOUT%);
>>"%AO_CTL%" echo SET @mtrip_guard_sql := IF(@mtrip_lock_acquired = 1, 'SELECT 1', 'SELECT * FROM mtrip_system.__migration_lock_timeout__');
>>"%AO_CTL%" echo PREPARE mtrip_lock_guard FROM @mtrip_guard_sql;
>>"%AO_CTL%" echo EXECUTE mtrip_lock_guard;
>>"%AO_CTL%" echo DEALLOCATE PREPARE mtrip_lock_guard;
>>"%AO_CTL%" echo INSERT INTO mtrip_system.schema_migrations (version, description, script_path, checksum, status, attempt_id, git_commit, applied_by, started_at) VALUES ('!AO_VER!', '!AO_DESC!', 'database/migrations/!AO_NAME!', '!AO_SUM!', 'running', '!AO_ATTEMPT!', '!GIT_COMMIT!', '!DEPLOY_ACTOR!', NOW(6));
>>"%AO_CTL%" echo SOURCE !AO_SQLPATH!;
>>"%AO_CTL%" echo UPDATE mtrip_system.schema_migrations SET status='applied', finished_at=NOW(6), execution_ms=ROUND(TIMESTAMPDIFF(MICROSECOND, started_at, NOW(6)) / 1000), error_message='' WHERE version='!AO_VER!' AND status='running' AND attempt_id='!AO_ATTEMPT!';
>>"%AO_CTL%" echo DO RELEASE_LOCK('mtrip_schema_migrations');

set "AO_RC=0"
"!MYSQL!" %MCRED_OPT% -h "!DB_HOST!" -P "!DB_PORT!" --default-character-set=utf8mb4 < "%AO_CTL%"
if errorlevel 1 set "AO_RC=1"

set "AO_POST="
for /f usebackq^ delims^=^ eol^= %%v in (`"!MYSQL!" %MCRED_OPT% -h "!DB_HOST!" -P "!DB_PORT!" -N -B -e "SELECT CONCAT(checksum,0x7C,status) FROM mtrip_system.schema_migrations WHERE version='!AO_VER!'"`) do set "AO_POST=%%v"
if not "!AO_POST!"=="!AO_SUM!|applied" goto :ao_notapplied
if "!AO_RC!"=="1" call :log "  已由并发发布进程完成"
echo [OK] !AO_NAME!
del "%AO_CTL%" >nul 2>&1
exit /b 0
:ao_notapplied
if "!AO_RC!"=="0" (
  echo [FAIL] 迁移命令返回成功,但账本状态不是 applied: !AO_NAME!
  del "%AO_CTL%" >nul 2>&1
  exit /b 1
)
"!MYSQL!" %MCRED_OPT% -h "!DB_HOST!" -P "!DB_PORT!" -N -B -e "UPDATE mtrip_system.schema_migrations SET status='failed', finished_at=NOW(6), execution_ms=ROUND(TIMESTAMPDIFF(MICROSECOND, started_at, NOW(6)) / 1000), error_message='mysql client execution failed' WHERE version='!AO_VER!' AND status='running' AND attempt_id='!AO_ATTEMPT!'" >nul 2>&1
echo [FAIL] 迁移失败并停止后续版本: !AO_NAME!；DDL 可能已部分提交,请人工核对
del "%AO_CTL%" >nul 2>&1
exit /b 1

REM ---------- 文件名/版本合法性校验(validate 与 precheck 共用) ----------
REM 要求 V + 14位数字 + __ + 小写短横线描述 + .sql;不用 findstr 长正则(有 255 字符限制)
:check_name
set "CN=%~1"
set "CNBAD=0"
if not "!CN:~0,1!"=="V" set "CNBAD=1"
if /i not "!CN:~-4!"==".sql" set "CNBAD=1"
if not "!CN:~15,2!"=="__" set "CNBAD=1"
set "CDESC=!CN:~17,-4!"
if "%CDESC%"=="" set "CNBAD=1"
if not "!CN:~235,1!"=="" (
  echo [FAIL] 迁移文件名过长,仓库相对路径最多 255 字符: !CN!
  set "VF_ERR=1"
  exit /b 1
)
REM 14 位版本必须全为数字:以数字为 delims 取 token,取到内容即含非法字符(哨兵 ~)
set "CV=!CN:~1,14!"
set "NOND=~"
for /f "tokens=1 delims=0123456789" %%x in ("!CV!") do set "NOND=%%x"
if not "!NOND!"=="~" set "CNBAD=1"
REM 描述部分只允许 a-z 0-9 -(同样用哨兵法;空描述也已在上面拦截)
set "BADCH=~"
for /f "tokens=1 delims=abcdefghijklmnopqrstuvwxyz0123456789-" %%x in ("!CDESC!") do set "BADCH=%%x"
if not "!BADCH!"=="~" set "CNBAD=1"
if "%CNBAD%"=="1" (
  echo [FAIL] 非法迁移文件名: !CN!；要求 VYYYYMMDDHHMMSS__lower-kebab.sql
  set "VF_ERR=1"
  exit /b 1
)
REM 日期有效性(不用 10#/%% 等不可移植写法:数字补 1 前缀后减去补位值,强制十进制解析)
set "CDATE_BAD=0"
set /a "CYR=1!CV:~0,4!-10000, CMO=1!CV:~4,2!-100, CDY=1!CV:~6,2!-100, CHH=1!CV:~8,2!-100, CMI=1!CV:~10,2!-100, CSS=1!CV:~12,2!-100"
if %CYR% LSS 1000 set "CDATE_BAD=1"
if %CMO% LSS 1 set "CDATE_BAD=1"
if %CMO% GTR 12 set "CDATE_BAD=1"
if %CDY% LSS 1 set "CDATE_BAD=1"
if %CHH% GTR 23 set "CDATE_BAD=1"
if %CMI% GTR 59 set "CDATE_BAD=1"
if %CSS% GTR 59 set "CDATE_BAD=1"
set "CMAXD=31"
if %CMO% EQU 4 set "CMAXD=30"
if %CMO% EQU 6 set "CMAXD=30"
if %CMO% EQU 9 set "CMAXD=30"
if %CMO% EQU 11 set "CMAXD=30"
set /a "M4=CYR/4*4-CYR, M100=CYR/100*100-CYR, M400=CYR/400*400-CYR"
set "ISLEAP=0"
if %M4% EQU 0 set "ISLEAP=1"
if %M100% EQU 0 set "ISLEAP=0"
if %M400% EQU 0 set "ISLEAP=1"
if %CMO% EQU 2 set "CMAXD=28"
if %CMO% EQU 2 if %ISLEAP% EQU 1 set "CMAXD=29"
if %CDY% GTR %CMAXD% set "CDATE_BAD=1"
if "%CDATE_BAD%"=="1" (
  echo [FAIL] 迁移版本不是有效的 UTC 日期时间: !CV!
  set "VF_ERR=1"
  exit /b 1
)
REM 版本重号检查:用动态变量存在性判定,避免 echo|findstr 管道在值含特殊字符时出错
if defined SEEN_!CV! (
  echo [FAIL] 迁移版本重复: !CV!
  set "VF_ERR=1"
  exit /b 1
)
set "SEEN_!CV!=1"
set /a VCOUNT+=1
exit /b 0

REM ---------- SHA-256(certutil,输出转小写) ----------
:sha256
set "SUM="
for /f "usebackq skip=1 delims=" %%h in (`certutil -hashfile %1 SHA256 2^>nul`) do if not defined SUM set "SUM=%%h"
if not defined SUM exit /b 1
set "SUM=!SUM: =!"
for %%c in (A B C D E F) do call set "SUM=%%SUM:%%c=%%c%%"
if not "!SUM:~64,1!"=="" exit /b 1
exit /b 0

REM ---------- 带时间戳日志 ----------
:log
call :timestamp
echo [%TS%] %~1
exit /b 0

:timestamp
set "TST=%time%"
if "%TST:~0,1%"==" " set "TST=%TST:~1%"
for /f "tokens=1 delims=." %%t in ("!TST!") do set "TST=%%t"
set "TS=%date:~0,10% !TST!"
exit /b 0

REM ---------- 退出与清理 ----------
:ok_exit
call :cleanup
exit /b 0

:fail
call :cleanup
:fail_nocleanup
exit /b 1

:cleanup
if defined WORK_DIR if exist "%WORK_DIR%" rd /s /q "%WORK_DIR%"
exit /b 0
