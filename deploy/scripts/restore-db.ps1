param(
  [Parameter(Mandatory=$true)][string]$DumpFile,
  [string]$DatabaseUrl = $env:DATABASE_URL
)

if (-not (Test-Path $DumpFile)) {
  Write-Error "Dump file not found: $DumpFile"
  exit 1
}
if (-not $DatabaseUrl) {
  Write-Error "DATABASE_URL is not set. Pass -DatabaseUrl or set `$env:DATABASE_URL."
  exit 1
}

pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$DatabaseUrl" "$DumpFile"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "Database restored from: $DumpFile"
