$p = Join-Path $PSScriptRoot '..\..\merchant-web\src\locales\en-US.ts'
$p = [System.IO.Path]::GetFullPath($p)
$l = [System.IO.File]::ReadAllLines($p)
$out = $l[0..274] + $l[480..($l.Count - 1)]
[System.IO.File]::WriteAllLines($p, $out, (New-Object System.Text.UTF8Encoding($false)))
Write-Output ('lines: ' + $l.Count + ' -> ' + $out.Count)
