param([switch]$WithTests, [switch]$RunTests, [switch]$Release)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$sdkRoot = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
if (!(Test-Path (Join-Path $sdkRoot 'platforms/android-36'))) { throw 'Android SDK 36 is required' }
$signingNames = @('BLACKJACK_KEYSTORE_PATH','BLACKJACK_KEYSTORE_PASSWORD','BLACKJACK_KEY_ALIAS','BLACKJACK_KEY_PASSWORD')
$previousSigning = @{}
foreach ($name in $signingNames) { $previousSigning[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
try {
if ($Release -and !$env:BLACKJACK_KEYSTORE_PATH) {
    $configPath = if ($env:BLACKJACK_SIGNING_CONFIG) { $env:BLACKJACK_SIGNING_CONFIG } else { Join-Path $PSScriptRoot 'artifacts/signing/signing.json' }
    if (!(Test-Path -LiteralPath $configPath)) { throw 'Run Setup-AndroidSigning.ps1 first, or supply signing environment variables.' }
    $config = Get-Content -Raw -LiteralPath $configPath | ConvertFrom-Json
    $env:BLACKJACK_KEYSTORE_PATH = [IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $configPath) $config.storeFile))
    $env:BLACKJACK_KEYSTORE_PASSWORD = $config.storePassword
    $env:BLACKJACK_KEY_ALIAS = $config.keyAlias
    $env:BLACKJACK_KEY_PASSWORD = $config.keyPassword
}
if ($Release) {
    foreach ($name in @('BLACKJACK_KEYSTORE_PATH','BLACKJACK_KEYSTORE_PASSWORD','BLACKJACK_KEY_ALIAS','BLACKJACK_KEY_PASSWORD')) {
        if (![Environment]::GetEnvironmentVariable($name, 'Process')) { throw "Missing release signing variable: $name" }
    }
    if (!(Test-Path -LiteralPath $env:BLACKJACK_KEYSTORE_PATH)) { throw 'Signing key does not exist' }
}
& npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Web build failed' }
[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'android/local.properties'), 'sdk.dir=' + $sdkRoot.Replace('\','/').Replace(':','\:'))
$installedGradle = Get-ChildItem (Join-Path $env:USERPROFILE '.gradle/wrapper/dists/gradle-9.1.0-all/*/gradle-9.1.0/bin/gradle.bat') -ErrorAction SilentlyContinue | Select-Object -First 1
$gradleLauncher = if ($installedGradle) { $installedGradle.FullName } else { Join-Path $PSScriptRoot 'android/gradlew.bat' }
[string[]]$buildTasks = if ($Release) { @(':app:assembleRelease') } else { @(':app:assembleDebug') }
if ($WithTests -or $RunTests) { $buildTasks += ':app:assembleDebugAndroidTest' }
if ($RunTests) { $buildTasks += ':app:connectedDebugAndroidTest' }
& $gradleLauncher --project-dir android --gradle-user-home (Join-Path $PSScriptRoot 'artifacts/gradle-cache') @buildTasks --no-daemon --console=plain
if ($LASTEXITCODE -ne 0) { throw 'Android build or device tests failed' }
New-Item -ItemType Directory -Path (Join-Path $PSScriptRoot 'artifacts') -Force | Out-Null
$appVersion = (Get-Content -Raw (Join-Path $PSScriptRoot 'package.json') | ConvertFrom-Json).version
$variant = if ($Release) { 'release' } else { 'debug' }
$suffix = if ($Release) { '' } else { '-debug' }
$outputFile = Join-Path $PSScriptRoot "artifacts/Blackjack-After-Hours-$appVersion$suffix.apk"
Copy-Item -LiteralPath "android/app/build/outputs/apk/$variant/app-$variant.apk" -Destination $outputFile -Force
Write-Host "APK: $outputFile"
} finally {
    foreach ($name in $signingNames) { [Environment]::SetEnvironmentVariable($name, $previousSigning[$name], 'Process') }
}
