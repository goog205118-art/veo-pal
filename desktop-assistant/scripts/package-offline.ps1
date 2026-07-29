$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$packageJson = Get-Content -LiteralPath (Join-Path $root "package.json") -Raw | ConvertFrom-Json
$version = $packageJson.version
$dist = Join-Path $root "dist"
$source = Join-Path $dist "win-unpacked"
$bundle = Join-Path $dist "offline-package"
$appDir = Join-Path $bundle "Wally Office Assistant"
$archive = Join-Path $dist "WallyOfficeAssistantOffline-$version.zip"

if (-not (Test-Path -LiteralPath $source)) {
    throw "Missing dist\win-unpacked. Run npm run dist:dir first."
}

if (Test-Path -LiteralPath $bundle) {
    Remove-Item -LiteralPath $bundle -Recurse -Force
}
if (Test-Path -LiteralPath $archive) {
    Remove-Item -LiteralPath $archive -Force
}

New-Item -ItemType Directory -Force -Path $bundle | Out-Null
Copy-Item -LiteralPath $source -Destination $appDir -Recurse -Force

$installScript = @'
$ErrorActionPreference = "Stop"

$source = Join-Path $PSScriptRoot "Wally Office Assistant"
$target = Join-Path $env:LOCALAPPDATA "WallyOfficeAssistant"
$exe = Join-Path $target "Wally Office Assistant.exe"

Get-Process -Name "Wally Office Assistant" -ErrorAction SilentlyContinue | Stop-Process -Force

if (Test-Path -LiteralPath $target) {
    Remove-Item -LiteralPath $target -Recurse -Force
}
Copy-Item -LiteralPath $source -Destination $target -Recurse -Force

$protocolKey = "HKCU:\Software\Classes\wally-office"
New-Item -Path $protocolKey -Force | Out-Null
Set-Item -Path $protocolKey -Value "URL:Wally Office Assistant"
Set-ItemProperty -Path $protocolKey -Name "URL Protocol" -Value "" -Force
New-Item -Path "$protocolKey\DefaultIcon" -Force | Out-Null
Set-Item -Path "$protocolKey\DefaultIcon" -Value "`"$exe`",0"
New-Item -Path "$protocolKey\shell\open\command" -Force | Out-Null
Set-Item -Path "$protocolKey\shell\open\command" -Value "`"$exe`" `"%1`""

$runKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
New-Item -Path $runKey -Force | Out-Null
Set-ItemProperty -Path $runKey -Name "Wally Office Assistant" -Value "`"$exe`"" -Force

Start-Process -FilePath $exe
Write-Host "Wally Office Assistant installed and started."
'@

$uninstallScript = @'
$ErrorActionPreference = "Stop"

$target = Join-Path $env:LOCALAPPDATA "WallyOfficeAssistant"
$runKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$protocolKey = "HKCU:\Software\Classes\wally-office"

Get-Process -Name "Wally Office Assistant" -ErrorAction SilentlyContinue | Stop-Process -Force

Remove-ItemProperty -Path $runKey -Name "Wally Office Assistant" -ErrorAction SilentlyContinue
Remove-Item -Path $protocolKey -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Wally Office Assistant uninstalled."
'@

$installLauncher = @'
@echo off
setlocal
powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%~dp0install.ps1"
pause
'@

$uninstallLauncher = @'
@echo off
setlocal
powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%~dp0uninstall.ps1"
pause
'@

$startLauncher = @'
@echo off
setlocal
set "APP=%LOCALAPPDATA%\WallyOfficeAssistant\Wally Office Assistant.exe"
if exist "%APP%" (
  start "" "%APP%"
) else (
  echo Wally Office Assistant is not installed yet.
  echo Please run install.ps1 or double click install.cmd first.
  pause
)
'@

$readme = @"
Wally Office Assistant 离线安装包

安装：
1. 双击 install.cmd
2. 如果 Windows 弹出安全提示，选择“仍要运行”
3. 安装完成后会自动启动桌面助手

备用安装：
右键 install.ps1，选择“使用 PowerShell 运行”

卸载：
双击 uninstall.cmd

手动启动：
双击 start-assistant.cmd

安装后能力：
- 注册 wally-office://start
- 写入当前用户开机自启
- 安装到 %LOCALAPPDATA%\WallyOfficeAssistant
- 网页端会自动检测 127.0.0.1:8765-8784
"@

Set-Content -LiteralPath (Join-Path $bundle "install.ps1") -Value $installScript -Encoding UTF8
Set-Content -LiteralPath (Join-Path $bundle "uninstall.ps1") -Value $uninstallScript -Encoding UTF8
Set-Content -LiteralPath (Join-Path $bundle "install.cmd") -Value $installLauncher -Encoding ASCII
Set-Content -LiteralPath (Join-Path $bundle "uninstall.cmd") -Value $uninstallLauncher -Encoding ASCII
Set-Content -LiteralPath (Join-Path $bundle "start-assistant.cmd") -Value $startLauncher -Encoding ASCII
Set-Content -LiteralPath (Join-Path $bundle "README.txt") -Value $readme -Encoding UTF8

$bundleItems = Get-ChildItem -LiteralPath $bundle -Force
Compress-Archive -LiteralPath $bundleItems.FullName -DestinationPath $archive -Force
Write-Host $archive
