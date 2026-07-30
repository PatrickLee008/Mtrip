<#
  Mtrip 质量基线检查脚本(README「质量基线」一节的统一执行入口)

  用法:powershell -ExecutionPolicy Bypass -File scripts/check.ps1
  按序执行:
    1. backend 全量 php -l 语法检查(排除 vendor/runtime/node_modules)
    2. shared 纯逻辑单测 php backend/shared/tests/run.php
    3. admin-web npm run build(vue-tsc + vite build)
    4. client-app npm run typecheck(tsc --noEmit)
  任一步骤失败立即以非零退出码结束
#>

$ErrorActionPreference = 'Continue'
$repoRoot = Split-Path -Parent $PSScriptRoot
$script:results = @()

function Complete-Step {
    param([string]$Name, [int]$Code)
    $script:results += [pscustomobject]@{ Step = $Name; ExitCode = $Code }
    if ($Code -ne 0) {
        Write-Host ''
        Write-Host "[FAIL] $Name (exit=$Code)" -ForegroundColor Red
        $script:results | Format-Table -AutoSize | Out-Host
        exit 1
    }
    Write-Host "[PASS] $Name" -ForegroundColor Green
}

# ---------- 1/4 backend 全量 php -l ----------
Write-Host '==> [1/4] backend php -l'
$phpFiles = Get-ChildItem -Path (Join-Path $repoRoot 'backend') -Recurse -Filter *.php |
    Where-Object { $_.FullName -notmatch '\\(vendor|runtime|node_modules)\\' }
$lintErrors = 0
foreach ($f in $phpFiles) {
    $out = & php -l $f.FullName 2>&1
    if ($LASTEXITCODE -ne 0) {
        $lintErrors++
        Write-Host ($out -join "`n") -ForegroundColor Red
    }
}
Write-Host ("php -l 检查 {0} 个文件,{1} 个语法错误" -f @($phpFiles).Count, $lintErrors)
if ($lintErrors -gt 0) { Complete-Step 'backend php -l' 1 } else { Complete-Step 'backend php -l' 0 }

# ---------- 2/4 shared 纯逻辑单测 ----------
Write-Host '==> [2/4] php backend/shared/tests/run.php'
& php (Join-Path $repoRoot 'backend/shared/tests/run.php')
Complete-Step 'shared tests' $LASTEXITCODE

# ---------- 3/4 admin-web 构建(vue-tsc 零 TS 报错) ----------
Write-Host '==> [3/4] admin-web npm run build'
Push-Location (Join-Path $repoRoot 'admin-web')
try { cmd /c 'npm run build'; $code = $LASTEXITCODE } finally { Pop-Location }
Complete-Step 'admin-web build' $code

# ---------- 4/4 client-app 类型检查 ----------
Write-Host '==> [4/4] client-app npm run typecheck'
Push-Location (Join-Path $repoRoot 'client-app')
try { cmd /c 'npm run typecheck'; $code = $LASTEXITCODE } finally { Pop-Location }
Complete-Step 'client-app typecheck' $code

Write-Host ''
Write-Host '全部质量基线检查通过' -ForegroundColor Green
$script:results | Format-Table -AutoSize | Out-Host
exit 0
