@echo off
chcp 936 >nul
REM ============================================================
REM  一键启动全部 8 个微服务(每个服务单开一个窗口,方便看日志)
REM  端口固定:system 9501 / user 9502 / goods 9503 / order 9504 /
REM            merchant 9505 / finance 9506 / marketing 9507 / payment 9508
REM ============================================================
setlocal
set "HERE=%~dp0"

REM 可选:在这里统一指定配置文件 / services 目录(不设则用 start-svc.bat 内默认)
REM set "ENV_FILE=%USERPROFILE%\.mtrip\mtrip.env"
REM set "REPO_SERVICES=E:\GIT\jiaxu\Mtrip\backend\services"

start "system-service 9501"    cmd /k "%HERE%start-svc.bat system-service 9501"
start "user-service 9502"      cmd /k "%HERE%start-svc.bat user-service 9502"
start "goods-service 9503"     cmd /k "%HERE%start-svc.bat goods-service 9503"
start "order-service 9504"     cmd /k "%HERE%start-svc.bat order-service 9504"
start "merchant-service 9505"  cmd /k "%HERE%start-svc.bat merchant-service 9505"
start "finance-service 9506"   cmd /k "%HERE%start-svc.bat finance-service 9506"
start "marketing-service 9507" cmd /k "%HERE%start-svc.bat marketing-service 9507"
start "payment-service 9508"   cmd /k "%HERE%start-svc.bat payment-service 9508"

echo.
echo 已在 8 个窗口分别启动服务。关闭对应窗口即停止该服务。
echo 网关(OpenResty)仍需单独跑;或本地直接按 http://127.0.0.1:95xx 直连各服务联调。
endlocal
