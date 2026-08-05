<#
.SYNOPSIS
  向运行中的 MySQL 容器增量执行 database/ 下的 SQL 脚本,无需 down -v 重建。

.DESCRIPTION
  仓库所有 SQL 均幂等(CREATE TABLE IF NOT EXISTS / 守卫式 ALTER)且头部自带
  `USE mtrip_xxx;`,因此可安全重复灌入运行中的库。本脚本按传入顺序逐个执行:
  docker cp 进容器 → 容器内 sh 用 `<` 重定向执行(避免 Windows 管道中文乱码)。
  密码走 MYSQL_PWD 环境变量,规避 @ 特殊字符的引号问题。

.PARAMETER Files
  一个或多个 .sql 路径(支持通配)。相对路径以仓库根为基准。

.EXAMPLE
  # 补挂本次新增的 6 个 merchant 脚本(按依赖顺序)
  ./scripts/db-apply.ps1 `
    database/merchant/03-group-store.sql `
    database/merchant/04-admin-account-type.sql `
    database/merchant/05-merchant-rbac.sql `
    database/merchant/06-supplier-rbac.sql `
    database/seed/04-merchant-menu.sql `
    database/seed/05-supplier-menu.sql

.EXAMPLE
  # 单个文件
  ./scripts/db-apply.ps1 database/goods/04-consumer-filter.sql

.NOTES
  仅用于开发环境增量更新;彻底重建仍用 docker compose down -v; up -d --build。
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0, ValueFromRemainingArguments = $true)]
    [string[]] $Files,

    [string] $Container    = "mtrip-mysql-1",
    [string] $RootPassword = "root@2026"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot   # scripts/ 的上一级 = 仓库根

# 容器是否在跑
$running = docker ps --filter "name=$Container" --filter "status=running" --format "{{.Names}}"
if ($running -notcontains $Container) {
    Write-Host "[x] 容器 $Container 未运行,请先 docker compose up -d" -ForegroundColor Red
    exit 1
}

# 展开通配、去重、校验存在
$resolved = @()
foreach ($pat in $Files) {
    $full = if ([System.IO.Path]::IsPathRooted($pat)) { $pat } else { Join-Path $repoRoot $pat }
    $hits = Get-ChildItem -Path $full -File -ErrorAction SilentlyContinue
    if (-not $hits) { Write-Host "[x] 找不到:$pat" -ForegroundColor Red; exit 1 }
    $resolved += $hits.FullName
}

$failed = @()
$i = 0
foreach ($f in $resolved) {
    $i++
    $name = Split-Path $f -Leaf
    Write-Host ("[{0}/{1}] 执行 {2} ..." -f $i, $resolved.Count, $name) -ForegroundColor Cyan

    # 送进容器再在容器内执行,按文件 utf8mb4 读取,避免宿主管道重编码
    docker cp "$f" "${Container}:/tmp/mtrip-apply.sql" | Out-Null
    docker exec -e "MYSQL_PWD=$RootPassword" $Container `
        sh -c "mysql -uroot --default-character-set=utf8mb4 < /tmp/mtrip-apply.sql"

    if ($LASTEXITCODE -ne 0) {
        Write-Host "    [x] 失败(exit $LASTEXITCODE):$name" -ForegroundColor Red
        $failed += $name
    } else {
        Write-Host "    [ok] $name" -ForegroundColor Green
    }
}

docker exec $Container sh -c "rm -f /tmp/mtrip-apply.sql" 2>$null | Out-Null

if ($failed.Count -gt 0) {
    Write-Host "`n失败 $($failed.Count) 个:$($failed -join ', ')" -ForegroundColor Red
    exit 1
}
Write-Host "`n全部成功($($resolved.Count) 个脚本)" -ForegroundColor Green
