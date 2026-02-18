# TC Manager - Windows 10 Installation Script
# Run as Administrator: Right-click PowerShell -> Run as Administrator
# Then: .\install-windows.ps1

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  TC Manager - نصب ویندوز 10" -ForegroundColor Cyan
Write-Host "  نوآوران جنوب شرق" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "خطا: این اسکریپت باید با دسترسی Administrator اجرا شود" -ForegroundColor Red
    Write-Host "راهنما: روی PowerShell کلیک راست کنید و 'Run as Administrator' را انتخاب کنید" -ForegroundColor Yellow
    pause
    exit 1
}

# Check Node.js installation
Write-Host "1. بررسی نصب Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "   ✓ Node.js نصب شده: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Node.js نصب نشده است" -ForegroundColor Red
    Write-Host "   لطفاً Node.js را از https://nodejs.org دانلود و نصب کنید" -ForegroundColor Yellow
    pause
    exit 1
}

# Create .env file
Write-Host "2. ایجاد فایل پیکربندی..." -ForegroundColor Yellow
$serverDir = "$PSScriptRoot\..\server"
if (-not (Test-Path "$serverDir\.env")) {
    Copy-Item "$serverDir\.env.example" "$serverDir\.env"
    Write-Host "   ✓ فایل .env ایجاد شد" -ForegroundColor Green
}

# Install dependencies
Write-Host "3. نصب وابستگی‌ها..." -ForegroundColor Yellow
Set-Location $serverDir
npm install --production
Write-Host "   ✓ نصب کامل شد" -ForegroundColor Green

Write-Host ""
Write-Host "نصب موفق! برای اجرا از start-windows.bat استفاده کنید" -ForegroundColor Green
pause
