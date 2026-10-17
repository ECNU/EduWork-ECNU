#Requires -Version 7.0
param([Parameter(Mandatory)][string]$CoreRoot,[Parameter(Mandatory)][string]$EditionRoot,[Parameter(Mandatory)][string]$Product)
$ErrorActionPreference='Stop';$PSNativeCommandUseErrorActionPreference=$true
$identity=Get-Content -LiteralPath (Join-Path $Product 'assembly.json') -Raw | ConvertFrom-Json
$env:EDUWORK_CORE_ROOT=$CoreRoot
$env:EDUWORK_TEST_RUNTIME=Join-Path $Product 'd'
$env:EDUWORK_TEST_DSH_VERSION=$identity.dshVersion
$env:DSH_OIDC_PACKAGE_ROOT=Join-Path $env:EDUWORK_TEST_RUNTIME 'node_modules/@eduwork/dsh-oidc'
$env:ECNU_ACCOUNT_PACKAGE_ROOT=Join-Path $env:EDUWORK_TEST_RUNTIME 'node_modules/@chatecnu-work/dsh-ecnu-account-resources'
Push-Location $EditionRoot
try {
    node --import ./edition/test/runtime-resolver.mjs --test edition/test/*.test.mjs edition/plugins/chatecnu-active-heartbeat/test/*.test.mjs edition/plugins/ecnu-account-resources/test/*.test.mjs edition/plugins/provider-vision-fallback/test/*.test.js edition/plugins/provider-vision-fallback/test/*.test.mjs edition/plugins/tool-ecnu-campus-search/test/*.test.js edition/plugins/tool-ecnu-campus-search/test/*.test.mjs
} finally { Pop-Location }
