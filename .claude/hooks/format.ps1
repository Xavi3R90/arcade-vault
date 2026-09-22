$ErrorActionPreference = 'SilentlyContinue'
$payload = [Console]::In.ReadToEnd() | ConvertFrom-Json
$file = $payload.tool_input.file_path
if (-not $file) { exit 0 }

$cwd = (Get-Location).Path
try { $full = [System.IO.Path]::GetFullPath($file) } catch { exit 0 }

if (-not $full.StartsWith($cwd, [System.StringComparison]::OrdinalIgnoreCase)) { exit 0 }
if (-not (Test-Path -LiteralPath $full)) { exit 0 }

# Normalizar: quitar trailing whitespace por línea y colapsar 3+ saltos consecutivos a 1 línea en blanco
$content = [System.IO.File]::ReadAllText($full)
$content = $content.Replace("`r`n", "`n")
$content = ($content -split "`n" | ForEach-Object { $_.TrimEnd() }) -join "`n"
$content = [regex]::Replace($content, "`n{3,}", "`n`n")
[System.IO.File]::WriteAllText($full, $content, [System.Text.Encoding]::UTF8NoBOM)

# Prettier: maneja ts, tsx, md, json, css, etc.
& npx prettier --write --ignore-unknown --log-level warn -- $full *>$null

# ESLint --fix solo para JS/TS
if ($full -match '\.(mts|ts|tsx|mjs|cjs|js|jsx)$') {
  & npx eslint --fix -- $full *>$null
}

exit 0
