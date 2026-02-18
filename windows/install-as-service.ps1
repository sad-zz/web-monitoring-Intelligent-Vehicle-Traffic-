# TC Manager - Install as Windows Service
# نصب TC Manager به عنوان سرویس ویندوز (اجرا 24/7)
# Run as Administrator

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  TC Manager - نصب Windows Service" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check Administrator
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "خطا: نیاز به دسترسی Administrator" -ForegroundColor Red
    pause
    exit 1
}

# Install node-windows globally
Write-Host "1. نصب node-windows..." -ForegroundColor Yellow
npm install -g node-windows
if ($LASTEXITCODE -eq 0) {
    Write-Host "   ✓ node-windows نصب شد" -ForegroundColor Green
} else {
    Write-Host "   ✗ خطا در نصب" -ForegroundColor Red
    pause
    exit 1
}

# Create service script
$serviceScript = @"
var Service = require('node-windows').Service;

var svc = new Service({
    name: 'TC Manager',
    description: 'TC Manager - Traffic Counter Management System',
    script: require('path').join(__dirname, '..', 'server', 'index.js'),
    nodeOptions: [],
    env: [{
        name: 'NODE_ENV',
        value: 'production'
    }]
});

svc.on('install', function() {
    console.log('✓ Service installed successfully');
    svc.start();
});

svc.on('alreadyinstalled', function() {
    console.log('Service is already installed');
});

svc.install();
"@

$scriptPath = "$PSScriptRoot\..\install-service.js"
$serviceScript | Out-File -FilePath $scriptPath -Encoding UTF8

# Install service
Write-Host "2. نصب سرویس..." -ForegroundColor Yellow
node $scriptPath

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  سرویس با موفقیت نصب شد!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "سرویس 'TC Manager' در حال اجرا است" -ForegroundColor Green
Write-Host "برای مدیریت سرویس از Services (services.msc) استفاده کنید" -ForegroundColor Yellow
Write-Host ""
pause
