@echo off
REM TC Manager - Windows Start Script
REM نوآوران جنوب شرق - سیستم مدیریت شمارنده‌های ترافیک

echo ============================================
echo   TC Manager - Traffic Counter Manager
echo   نوآوران جنوب شرق
echo ============================================
echo.

cd /d "%~dp0..\server"

echo در حال راه‌اندازی سرور...
echo.

node index.js

pause
