param(
  [string]$BackupDir = ".\backups",
  [string]$DatabaseUrl = $env:DATABASE_URL
)

if (-not $DatabaseUrl) {
  Write-Error "DATABASE_URL is not set. Pass -DatabaseUrl or set `$env:DATABASE_URL."
  exit 1
}

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$outFile = Join-Path $BackupDir "mobileum_sales_demo_$timestamp.dump"

pg_dump --format=custom --no-owner --no-privileges --dbname="$DatabaseUrl" --file="$outFile"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Database backup created: $outFile"
