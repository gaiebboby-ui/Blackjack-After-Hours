param([switch]$WithTests)
$ErrorActionPreference='Stop'
Set-Location $PSScriptRoot
& npm.cmd run build
if($LASTEXITCODE -ne 0){throw 'Web build failed'}
$sdkRoot = if($env:ANDROID_HOME){$env:ANDROID_HOME}else{Join-Path $env:LOCALAPPDATA 'Android\Sdk'}
if(!(Test-Path (Join-Path $sdkRoot 'platforms\android-36'))){throw 'Android SDK 36 is required'}
[IO.File]::WriteAllText((Join-Path $PSScriptRoot 'android\local.properties'),'sdk.dir='+$sdkRoot.Replace('\','/').Replace(':','\:'))
$installedGradle=Get-ChildItem (Join-Path $env:USERPROFILE '.gradle\wrapper\dists\gradle-9.1.0-all\*\gradle-9.1.0\bin\gradle.bat') -ErrorAction SilentlyContinue | Select-Object -First 1
$gradleLauncher=if($installedGradle){$installedGradle.FullName}else{Join-Path $PSScriptRoot 'android\gradlew.bat'}
$buildTasks=@(':app:assembleDebug')
if($WithTests){$buildTasks+= ':app:assembleDebugAndroidTest'}
& $gradleLauncher --project-dir android --gradle-user-home (Join-Path $PSScriptRoot 'artifacts\gradle-cache') @buildTasks --no-daemon --console=plain
if($LASTEXITCODE -ne 0){throw 'Android build failed'}
New-Item -ItemType Directory -Path (Join-Path $PSScriptRoot 'artifacts') -Force | Out-Null
$appVersion=(Get-Content -Raw (Join-Path $PSScriptRoot 'package.json') | ConvertFrom-Json).version
$outputFile=Join-Path $PSScriptRoot ('artifacts\Blackjack-After-Hours-'+$appVersion+'.apk')
Copy-Item -LiteralPath 'android\app\build\outputs\apk\debug\app-debug.apk' -Destination $outputFile -Force
Write-Host "APK: $outputFile"
