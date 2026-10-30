param()
$ErrorActionPreference = 'Stop'
$signingDirectory = Join-Path $PSScriptRoot 'artifacts/signing'
$backupDirectory = Join-Path $PSScriptRoot '_archive/android-signing-backup'
$configFile = Join-Path $signingDirectory 'signing.json'
if (Test-Path -LiteralPath $configFile) { Write-Host 'Stable signing is already configured.'; exit 0 }
$existingKey = Join-Path $env:USERPROFILE '.android/debug.keystore'
if (!(Test-Path -LiteralPath $existingKey)) { throw 'Existing installation key not found. Supply your own signing configuration; a new key would break updates.' }
$keytool = if ($env:JAVA_HOME) { Join-Path $env:JAVA_HOME 'bin/keytool.exe' } else { 'keytool' }
New-Item -ItemType Directory -Path $signingDirectory, $backupDirectory -Force | Out-Null
$account = [Security.Principal.WindowsIdentity]::GetCurrent().Name
foreach ($directory in @($signingDirectory, $backupDirectory)) {
    & icacls $directory /inheritance:r /grant:r "${account}:(OI)(CI)F" 'SYSTEM:(OI)(CI)F' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Cannot restrict signing directory access' }
}
$targetKey = Join-Path $signingDirectory 'after-hours.keystore'
if (Test-Path -LiteralPath $targetKey) { throw 'Existing key without config found; inspect it before retrying.' }
Copy-Item -LiteralPath $existingKey -Destination $targetKey
$previousPassword = $env:BLACKJACK_NEW_STORE_PASSWORD
$env:BLACKJACK_NEW_STORE_PASSWORD = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(36))
try {
    & $keytool -storepasswd -keystore $targetKey -storepass android -new:env BLACKJACK_NEW_STORE_PASSWORD
    if ($LASTEXITCODE -ne 0) { throw 'Could not secure the copied installation key' }
    $config = @{ storeFile = 'after-hours.keystore'; storePassword = $env:BLACKJACK_NEW_STORE_PASSWORD; keyAlias = 'androiddebugkey'; keyPassword = $env:BLACKJACK_NEW_STORE_PASSWORD }
    [IO.File]::WriteAllText($configFile, ($config | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
    Copy-Item -LiteralPath $targetKey -Destination (Join-Path $backupDirectory 'after-hours.keystore')
    Copy-Item -LiteralPath $configFile -Destination (Join-Path $backupDirectory 'signing.json')
} finally { [Environment]::SetEnvironmentVariable('BLACKJACK_NEW_STORE_PASSWORD', $previousPassword, 'Process') }
Write-Host 'Stable signing configured with an access-restricted local backup.'
Write-Host 'Keep an additional secure off-device backup of the signing directory.'
