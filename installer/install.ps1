# 历史剪贴板 - 安装脚本
# 将应用安装到 %LocalAppData%\Programs\历史剪贴板 并创建快捷方式

$ErrorActionPreference = "Stop"
$AppName = "历史剪贴板"
$InstallDir = "$env:LOCALAPPDATA\Programs\$AppName"
$DesktopShortcut = "$env:USERPROFILE\Desktop\$AppName.lnk"
$StartMenuDir = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\$AppName"
$StartMenuShortcut = "$StartMenuDir\$AppName.lnk"
$SourceDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "正在安装 $AppName..." -ForegroundColor Cyan

# 1. 复制文件
Write-Host "  复制文件到 $InstallDir ..."
if (Test-Path $InstallDir) { Remove-Item $InstallDir -Recurse -Force }
Copy-Item "$SourceDir\*" $InstallDir -Recurse -Exclude "install.ps1"

# 2. 创建开始菜单
Write-Host "  创建开始菜单快捷方式..."
New-Item -ItemType Directory -Path $StartMenuDir -Force | Out-Null
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($StartMenuShortcut)
$Shortcut.TargetPath = "$InstallDir\历史剪贴板.exe"
$Shortcut.WorkingDirectory = $InstallDir
$Shortcut.Description = "Windows 历史剪贴板管理工具"
$Shortcut.Save()

# 3. 创建桌面快捷方式
Write-Host "  创建桌面快捷方式..."
$Shortcut = $WshShell.CreateShortcut($DesktopShortcut)
$Shortcut.TargetPath = "$InstallDir\历史剪贴板.exe"
$Shortcut.WorkingDirectory = $InstallDir
$Shortcut.Description = "Windows 历史剪贴板管理工具"
$Shortcut.Save()

Write-Host "✅ $AppName 安装完成！" -ForegroundColor Green
Write-Host ""
Write-Host "桌面和开始菜单已创建快捷方式，双击即可启动。" -ForegroundColor Yellow
