param([ValidateSet('Init', 'Start', 'Status', 'Stop')][string]$Action = 'Status')
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
# Explicit files: never load the development override or the developer's .env.
$compose = @('compose', '--project-name', 'mtrip-s7', '--env-file', (Join-Path $repo 'deploy/s7.env.example'), '-f', (Join-Path $repo 'deploy/docker-compose.yml'), '-f', (Join-Path $repo 'deploy/docker-compose.s7.yml'))
switch ($Action) {
    'Init' { & docker @compose up -d --no-build --pull never mysql redis }
    'Start' {
        & docker @compose --parallel 1 up -d --no-build --pull never
        if ($LASTEXITCODE -ne 0) { throw 'S7 container startup failed' }
        $services = @('system', 'user', 'goods', 'order', 'merchant', 'finance', 'marketing', 'payment')
        for ($i = 0; $i -lt $services.Count; $i++) {
            $containerName = "mtrip-s7-$($services[$i])-service-1"
            $port = 9501 + $i
            $probe = '$r=json_decode(@file_get_contents("http://127.0.0.1:' + $port + '/healthz"),true); exit(($r["status"]??"")==="ok"?0:1);'
            $ready = $false
            for ($attempt = 0; $attempt -lt 20; $attempt++) {
                & docker exec $containerName php -r $probe 2>$null
                if ($LASTEXITCODE -eq 0) { $ready = $true; break }
                Start-Sleep -Seconds 2
            }
            if (!$ready) { throw "$containerName is not healthy; inspect its logs before retrying" }
            Write-Output "$containerName healthz OK"
        }
        # Nginx resolves upstream names at startup; refresh after a container recovers with a new IP.
        & docker exec mtrip-s7-gateway-1 /usr/local/openresty/nginx/sbin/nginx -s reload
    }
    'Status' { & docker @compose ps }
    # Stop only; preserve dedicated volumes and evidence. No automatic deletion.
    'Stop' { & docker @compose stop }
}
if ($LASTEXITCODE -ne 0) { throw "S7 $Action failed" }
