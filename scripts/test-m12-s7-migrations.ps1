$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$mysql = 'mtrip-s7-mysql-1'
$stamp = Get-Date -Format 'yyyyMMddHHmmss'
$upgrade = "mtrip_s7_upgrade_$stamp"
$restore = "mtrip_s7_restore_$stamp"
function Sql([string]$query) {
    $result = $query | docker exec -i $mysql sh -c 'MYSQL_PWD=$MYSQL_ROOT_PASSWORD exec mysql -uroot --batch --skip-column-names --default-character-set=utf8mb4'
    if ($LASTEXITCODE -ne 0) { throw 'S7 SQL failed; dedicated evidence databases retained' }
    return $result
}
$inspection = docker inspect $mysql
if ($LASTEXITCODE -ne 0) { throw 'S7 MySQL container is unavailable' }
$project = ($inspection | ConvertFrom-Json)[0].Config.Labels.'com.docker.compose.project'
if ($project -ne 'mtrip-s7') { throw 'Only the mtrip-s7 MySQL container is allowed' }
Sql "CREATE DATABASE $upgrade CHARACTER SET utf8mb4 COLLATE utf8mb4_bin; CREATE DATABASE $restore CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;"
$legacy = "USE $upgrade;" + [Environment]::NewLine
$migrations = @()
# Use real Compose dependencies, excluding ONLY M12 27-32 for the legacy fixture.
foreach ($line in Get-Content (Join-Path $repo 'deploy/docker-compose.yml')) {
    if ($line -notmatch '\.\./(database/[^:]+\.sql):/docker-entrypoint-initdb.d/([^:]+):ro') { continue }
    $source = $Matches[1]
    if ($source -eq 'database/init/00-create-databases.sql') { continue }
    if ($source -match 'database/merchant/(27|28|29|30|31|32)-') { $migrations += $source; continue }
    $legacy += (Get-Content (Join-Path $repo $source) -Raw -Encoding utf8).Replace('mtrip_business', $upgrade).Replace('mtrip_system', $upgrade) + [Environment]::NewLine
}
if ($migrations.Count -ne 6) { throw 'Expected exactly six M12 migrations in Compose' }
Sql $legacy | Out-Null
Sql @"
USE $upgrade;
INSERT INTO merchant_info(id,site_id,merchant_name,credit_code,legal_person,contact_name,contact_phone,status) VALUES(70001,991,'S7 legacy hotel','S7-LEGACY','Synthetic','Synthetic','',4);
INSERT INTO merchant_admin(id,site_id,merchant_id,username,password,real_name) VALUES(70001,991,70001,'s7-legacy','not-a-login-hash','Legacy account');
INSERT INTO merchant_verify_document(id,site_id,merchant_id,doc_type,name,status,file_url,reviewer_name) VALUES(70001,991,70001,'hotel_license','Legacy license',1,'/uploads/kyc/s7-legacy.pdf','Legacy reviewer');
INSERT INTO merchant_notify(id,site_id,merchant_id,title,message,channels,status,read_by,read_at) VALUES(70001,991,70001,'Legacy notice','Retain this record','inapp',1,70001,'2026-01-01 00:00:00');
INSERT INTO merchant_warning(id,site_id,merchant_id,reason,status,issued_by) VALUES(70001,991,70001,'Legacy revoked warning',2,'Legacy reviewer');
INSERT INTO merchant_violation(id,site_id,merchant_id,rule_title,status,action) VALUES(70001,991,70001,'Legacy policy',2,'Legacy resolution');
INSERT INTO compliance_history(id,site_id,merchant_id,event,reviewer) VALUES(70001,991,70001,'Legacy audit event','Legacy reviewer');
INSERT INTO sys_role(id,role_name) VALUES(70001,'S7 legacy role');
INSERT INTO sys_role_menu(role_id,menu_id) VALUES(70001,301);
"@ | Out-Null
$snapshot = @"
USE $upgrade;
SELECT merchant_name,credit_code,status FROM merchant_info WHERE id=70001;
SELECT username,password FROM merchant_admin WHERE id=70001;
SELECT doc_type,name,status,file_url,reviewer_name FROM merchant_verify_document WHERE id=70001;
SELECT title,message,channels,status,read_by,read_at FROM merchant_notify WHERE id=70001;
SELECT reason,status,issued_by FROM merchant_warning WHERE id=70001;
SELECT rule_title,status,action FROM merchant_violation WHERE id=70001;
SELECT event,reviewer FROM compliance_history WHERE id=70001;
SELECT role_id,menu_id FROM sys_role_menu ORDER BY role_id,menu_id;
"@
$before = (Sql $snapshot) -join [Environment]::NewLine
foreach ($round in 1..2) {
    foreach ($source in $migrations) {
        Sql ((Get-Content (Join-Path $repo $source) -Raw -Encoding utf8).Replace('mtrip_business', $upgrade).Replace('mtrip_system', $upgrade)) | Out-Null
    }
    if (((Sql $snapshot) -join [Environment]::NewLine) -cne $before) { throw "Legacy records or grants changed during migration round $round" }
    $defaults = Sql "USE $upgrade; SELECT CONCAT(status_version,':',COALESCE(active_suspension_id,'null')) FROM merchant_info WHERE id=70001; SELECT CONCAT(two_fa_status,':',auth_version,':',LENGTH(two_fa_secret_enc)) FROM merchant_admin WHERE id=70001; SELECT COUNT(*) FROM merchant_notify_read WHERE notify_id=70001 AND account_id=70001; SELECT COUNT(*) FROM merchant_status_history WHERE merchant_id=70001;"
    if (($defaults -join ',') -ne '0:null,0:1:0,1,0') { throw "Unexpected migration defaults: $defaults" }
    Write-Output "PASS: migration round $round preserves legacy records/grants, account isolation, explicit reader and no fabricated status history"
}
# Synthetic backup stays inside the isolated container; never overwrite a developer dump.
$dump = "/tmp/$upgrade.sql"
docker exec $mysql sh -c 'MYSQL_PWD=$MYSQL_ROOT_PASSWORD exec mysqldump -uroot --single-transaction --no-tablespaces --set-gtid-purged=OFF --skip-comments "$1" > "$2"' sh $upgrade $dump
if ($LASTEXITCODE -ne 0) { throw 'S7 backup failed' }
docker exec $mysql sh -c 'MYSQL_PWD=$MYSQL_ROOT_PASSWORD exec mysql -uroot "$1" < "$2"' sh $restore $dump
if ($LASTEXITCODE -ne 0) { throw 'S7 restore failed' }
$tables = Sql "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='$upgrade' ORDER BY TABLE_NAME;"
$checks = ($tables | ForEach-Object { "CHECKSUM TABLE $upgrade.$_ EXTENDED; CHECKSUM TABLE $restore.$_ EXTENDED;" }) -join [Environment]::NewLine
$rows = @(Sql $checks)
if ($tables.Count -eq 0 -or $rows.Count -ne 2 * $tables.Count) { throw 'Incomplete restore checksum results' }
for ($i = 0; $i -lt $rows.Count; $i += 2) {
    $original = ($rows[$i] -split [char]9)[1]
    $restored = ($rows[$i+1] -split [char]9)[1]
    if ($original -notmatch '^\d+$' -or $original -ne $restored) { throw "Restore checksum mismatch: $($rows[$i])" }
}
Write-Output "PASS: backup/restore checksums match for $($tables.Count) tables"
Write-Output "Evidence retained only in $mysql : $upgrade ; $restore ; $dump"
