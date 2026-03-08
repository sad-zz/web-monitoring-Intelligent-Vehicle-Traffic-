#!/bin/bash
# =============================================================
# TC Manager - Noavaran Jonoob Shargh
# Usage: bash deploy-all.sh [--fresh]
# =============================================================
set -e

APP_DIR="/opt/tc-manager"
FRESH=0
if [ "$1" = "--fresh" ]; then FRESH=1; fi

echo "========================================"
echo "  TC Manager - Noavaran Jonoob Shargh"
echo "========================================"

systemctl stop tc-manager 2>/dev/null || true

echo "[1/7] Directories..."
mkdir -p $APP_DIR/css $APP_DIR/js $APP_DIR/data $APP_DIR/server/uploads

if [ $FRESH -eq 1 ]; then
    echo "[!] Deleting old database (--fresh)..."
    rm -f $APP_DIR/server/data.db $APP_DIR/server/data.db-wal $APP_DIR/server/data.db-shm
fi

echo "[+] index.html"
cat > "$APP_DIR/index.html" << 'ENDOFFILE_INDEX_HTML'
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>نوآوران جنوب شرق - TC Manager</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>

    <!-- Login Page -->
    <div class="login-overlay" id="login-overlay">
        <div class="login-box">
            <div class="login-logo">
                <div class="logo-icon" style="width:56px;height:56px;font-size:22px;margin:0 auto 12px">TC</div>
                <h2>نوآوران جنوب شرق</h2>
                <p>سامانه مدیریت ترددشمار هوشمند</p>
            </div>
            <form id="login-form">
                <div class="form-group">
                    <label>نام کاربری</label>
                    <input type="text" id="login-user" required dir="ltr" autocomplete="username">
                </div>
                <div class="form-group">
                    <label>رمز عبور</label>
                    <input type="password" id="login-pass" required dir="ltr" autocomplete="current-password">
                </div>
                <div id="login-error" style="color:#ef4444;font-size:13px;margin-bottom:12px;display:none"></div>
                <button type="submit" class="btn btn-primary" style="width:100%;padding:12px;font-size:15px">ورود</button>
            </form>
        </div>
    </div>

    <!-- Sidebar -->
    <aside class="sidebar" id="sidebar">
        <div class="sidebar-header">
            <div class="sidebar-logo">
                <div class="logo-icon">TC</div>
                <div class="logo-text">
                    <span class="logo-title">نوآوران جنوب شرق</span>
                    <span class="logo-sub">TC Manager</span>
                </div>
            </div>
        </div>

        <nav class="sidebar-nav">
            <button class="nav-item active" data-view="dashboard">
                <svg class="nav-icon" viewBox="0 0 24 24"><path d="M3 13h1v7c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-7h1a1 1 0 0 0 .7-1.7l-9-9a1 1 0 0 0-1.4 0l-9 9A1 1 0 0 0 3 13zm7 7v-5h4v5h-4zm2-15.6 7 7V20h-3v-5c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v5H5v-8.6l7-7z"/></svg>
                <span>داشبورد</span>
            </button>
            <button class="nav-item" data-view="devices">
                <svg class="nav-icon" viewBox="0 0 24 24"><path d="M4 6h18V4H4c-1.1 0-2 .9-2 2v11H0v3h14v-3H4V6zm19 2h-6c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V9c0-.55-.45-1-1-1zm-1 9h-4v-7h4v7z"/></svg>
                <span>دستگاه‌ها</span>
            </button>
            <button class="nav-item" data-view="reception">
                <svg class="nav-icon" viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                <span>دریافت داده</span>
            </button>
            <button class="nav-item" data-view="rmto">
                <svg class="nav-icon" viewBox="0 0 24 24"><path d="M4.01 6.03l7.51 3.22-7.52-1 .01-2.22m7.5 8.72L4 17.97v-2.22l7.51-1M2.01 3L2 10l15 2-15 2 .01 7L23 12 2.01 3z"/></svg>
                <span>ارسال رهسام</span>
            </button>
            <button class="nav-item" data-view="settings">
                <svg class="nav-icon" viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"/></svg>
                <span>تنظیمات</span>
            </button>
        </nav>

        <div class="sidebar-footer">
            <div class="sidebar-user">
                <div class="user-avatar">ا</div>
                <div class="user-info">
                    <span class="user-name">اپراتور</span>
                    <span class="user-role">مدیر</span>
                </div>
            </div>
        </div>
    </aside>

    <!-- Main -->
    <div class="main-wrapper">

        <!-- Top Bar -->
        <header class="topbar">
            <button class="topbar-toggle" id="sidebar-toggle">
                <svg viewBox="0 0 24 24" width="22" height="22"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>
            </button>
            <div class="topbar-title" id="topbar-title">داشبورد</div>
            <div class="topbar-left">
                <span class="topbar-time" id="topbar-time"></span>
                <span class="topbar-badge" id="topbar-status">در انتظار اتصال</span>
                <span class="topbar-user-name" id="topbar-user" style="font-size:12px;color:#64748b"></span>
            </div>
        </header>

        <!-- Content Area -->
        <main class="content">

            <!-- ===== Dashboard ===== -->
            <section class="view active" id="view-dashboard">
                <div class="stats-row">
                    <div class="stat-card">
                        <div class="stat-icon blue">
                            <svg viewBox="0 0 24 24"><path d="M4 6h18V4H4c-1.1 0-2 .9-2 2v11H0v3h14v-3H4V6zm19 2h-6c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h6c.55 0 1-.45 1-1V9c0-.55-.45-1-1-1zm-1 9h-4v-7h4v7z"/></svg>
                        </div>
                        <div class="stat-body">
                            <div class="stat-value" id="stat-total-devices">-</div>
                            <div class="stat-label">کل دستگاه‌ها</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon green">
                            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                        </div>
                        <div class="stat-body">
                            <div class="stat-value" id="stat-online-devices">-</div>
                            <div class="stat-label">دستگاه آنلاین</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon orange">
                            <svg viewBox="0 0 24 24"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>
                        </div>
                        <div class="stat-body">
                            <div class="stat-value" id="stat-today-vehicles">-</div>
                            <div class="stat-label">تردد امروز</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon red">
                            <svg viewBox="0 0 24 24"><path d="M4.01 6.03l7.51 3.22-7.52-1 .01-2.22m7.5 8.72L4 17.97v-2.22l7.51-1M2.01 3L2 10l15 2-15 2 .01 7L23 12 2.01 3z"/></svg>
                        </div>
                        <div class="stat-body">
                            <div class="stat-value" id="stat-unsent-rmto">-</div>
                            <div class="stat-label">صف ارسال رهسام</div>
                        </div>
                    </div>
                </div>

                <!-- Live Monitor -->
                <div class="panel" style="margin-bottom:16px">
                    <div class="panel-header">
                        <h3 class="panel-title">مانیتور زنده (درخواست‌های ورودی)</h3>
                        <div class="panel-tools">
                            <label class="toggle-label" style="font-size:12px">
                                <input type="checkbox" id="live-auto-refresh" checked>
                                <span>بروزرسانی خودکار</span>
                            </label>
                            <button class="btn btn-sm btn-primary" id="btn-refresh-live">بروزرسانی</button>
                        </div>
                    </div>
                    <div class="table-wrapper" style="max-height:300px;overflow-y:auto">
                        <table class="data-table" id="live-table">
                            <thead>
                                <tr>
                                    <th>زمان</th>
                                    <th>نوع</th>
                                    <th>IP</th>
                                    <th>کد دستگاه</th>
                                    <th>جزئیات</th>
                                </tr>
                            </thead>
                            <tbody id="live-table-body">
                                <tr><td colspan="5" style="text-align:center;color:#94a3b8">منتظر داده...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Device Status Table -->
                <div class="panel">
                    <div class="panel-header">
                        <h3 class="panel-title">وضعیت دستگاه‌ها</h3>
                        <div class="panel-tools">
                            <button class="btn btn-sm btn-primary" id="btn-refresh-dashboard">بروزرسانی</button>
                        </div>
                    </div>
                    <div class="table-wrapper">
                        <table class="data-table" id="dashboard-table">
                            <thead>
                                <tr>
                                    <th>کد</th>
                                    <th>نام دستگاه</th>
                                    <th>نوع</th>
                                    <th>وضعیت</th>
                                    <th>آخرین اتصال</th>
                                </tr>
                            </thead>
                            <tbody id="dashboard-table-body">
                                <tr><td colspan="5" style="text-align:center;color:#94a3b8">در حال بارگذاری...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <!-- ===== Devices ===== -->
            <section class="view" id="view-devices">
                <div class="panel">
                    <div class="panel-header">
                        <h3 class="panel-title">مدیریت دستگاه‌ها</h3>
                        <div class="panel-tools">
                            <button class="btn btn-primary" id="btn-add-device">+ دستگاه جدید</button>
                            <div class="search-box">
                                <label>جستجو:</label>
                                <input type="text" id="devices-search" class="search-input">
                            </div>
                        </div>
                    </div>
                    <div class="table-wrapper">
                        <table class="data-table" id="devices-table">
                            <thead>
                                <tr>
                                    <th>ردیف</th>
                                    <th>کد دستگاه</th>
                                    <th>نام دستگاه</th>
                                    <th>نوع</th>
                                    <th>محور</th>
                                    <th>وضعیت</th>
                                    <th>آخرین اتصال</th>
                                    <th>عملیات</th>
                                </tr>
                            </thead>
                            <tbody id="devices-table-body">
                                <tr><td colspan="8" style="text-align:center;color:#94a3b8">در حال بارگذاری...</td></tr>
                            </tbody>
                        </table>
                    </div>
                    <div class="table-footer">
                        <div class="table-info" id="devices-table-info"></div>
                        <div class="pagination" id="devices-pagination"></div>
                    </div>
                </div>
            </section>

            <!-- ===== Data Reception ===== -->
            <section class="view" id="view-reception">
                <div class="panel">
                    <div class="panel-header">
                        <h3 class="panel-title">داده‌های دریافتی از دستگاه‌ها</h3>
                        <div class="panel-tools">
                            <div class="search-box">
                                <label>کد دستگاه:</label>
                                <input type="text" id="reception-filter-code" class="search-input" placeholder="مثال: 1001" dir="ltr" style="width:100px">
                            </div>
                            <button class="btn btn-sm btn-primary" id="btn-refresh-reception">بروزرسانی</button>
                        </div>
                    </div>
                    <div class="table-wrapper">
                        <table class="data-table" id="reception-table">
                            <thead>
                                <tr>
                                    <th>کد دستگاه</th>
                                    <th>شروع</th>
                                    <th>پایان</th>
                                    <th>لاین</th>
                                    <th>موتور(a)</th>
                                    <th>سواری(b)</th>
                                    <th>ون(c)</th>
                                    <th>اتوبوس(d)</th>
                                    <th>کامیون(e)</th>
                                    <th>نامشخص(x)</th>
                                    <th>کل</th>
                                </tr>
                            </thead>
                            <tbody id="reception-table-body">
                                <tr><td colspan="11" style="text-align:center;color:#94a3b8">در حال بارگذاری...</td></tr>
                            </tbody>
                        </table>
                    </div>
                    <div class="table-footer">
                        <div class="table-info" id="reception-table-info"></div>
                        <div class="pagination" id="reception-pagination"></div>
                    </div>
                </div>
            </section>

            <!-- ===== RMTO Send ===== -->
            <section class="view" id="view-rmto">
                <div class="stats-row" style="grid-template-columns: repeat(3, 1fr)">
                    <div class="stat-card">
                        <div class="stat-icon orange">
                            <svg viewBox="0 0 24 24"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
                        </div>
                        <div class="stat-body">
                            <div class="stat-value" id="rmto-unsent-count">-</div>
                            <div class="stat-label">در صف ارسال</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon green">
                            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                        </div>
                        <div class="stat-body">
                            <div class="stat-value" id="rmto-sent-count">-</div>
                            <div class="stat-label">ارسال شده</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon blue">
                            <svg viewBox="0 0 24 24"><path d="M4.01 6.03l7.51 3.22-7.52-1 .01-2.22m7.5 8.72L4 17.97v-2.22l7.51-1M2.01 3L2 10l15 2-15 2 .01 7L23 12 2.01 3z"/></svg>
                        </div>
                        <div class="stat-body">
                            <div class="stat-value" id="rmto-last-send">-</div>
                            <div class="stat-label">آخرین ارسال</div>
                        </div>
                    </div>
                </div>

                <div style="display:flex;gap:8px;margin-bottom:16px">
                    <button class="btn btn-primary" id="btn-rmto-send-now">ارسال الان</button>
                    <button class="btn btn-secondary" id="btn-rmto-aggregate">تجمیع و ارسال</button>
                    <button class="btn btn-secondary" id="btn-rmto-refresh">بروزرسانی</button>
                </div>

                <!-- Unsent Queue -->
                <div class="panel" style="margin-bottom:16px">
                    <div class="panel-header">
                        <h3 class="panel-title">صف ارسال (ارسال نشده)</h3>
                    </div>
                    <div class="table-wrapper">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>کد دستگاه</th>
                                    <th>شروع دوره</th>
                                    <th>تعداد خودرو</th>
                                    <th>سرعت متوسط</th>
                                    <th>زمان ایجاد</th>
                                </tr>
                            </thead>
                            <tbody id="rmto-unsent-body">
                                <tr><td colspan="5" style="text-align:center;color:#94a3b8">در حال بارگذاری...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Send Log -->
                <div class="panel">
                    <div class="panel-header">
                        <h3 class="panel-title">تاریخچه ارسال</h3>
                    </div>
                    <div class="table-wrapper">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>متد</th>
                                    <th>کد دستگاه</th>
                                    <th>وضعیت</th>
                                    <th>پاسخ</th>
                                    <th>زمان</th>
                                </tr>
                            </thead>
                            <tbody id="rmto-log-body">
                                <tr><td colspan="5" style="text-align:center;color:#94a3b8">در حال بارگذاری...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <!-- ===== Settings ===== -->
            <section class="view" id="view-settings">
                <div class="settings-grid">
                    <!-- RMTO Settings -->
                    <div class="panel">
                        <div class="panel-header">
                            <h3 class="panel-title">تنظیمات ارتباط رهسام (RMTO)</h3>
                        </div>
                        <div class="panel-body">
                            <div class="form-group">
                                <label>آدرس WSDL</label>
                                <input type="text" id="setting-rmto-wsdl" dir="ltr" placeholder="http://otf.rmto.ir/Companies/Companies.asmx?WSDL">
                            </div>
                            <div class="form-group">
                                <label>کد شرکت</label>
                                <input type="text" id="setting-rmto-company" dir="ltr" placeholder="58">
                            </div>
                            <div class="form-group">
                                <label>نام کاربری رهسام</label>
                                <input type="text" id="setting-rmto-user" dir="ltr">
                            </div>
                            <div class="form-group">
                                <label>رمز عبور رهسام</label>
                                <input type="password" id="setting-rmto-pass" dir="ltr">
                            </div>
                            <button class="btn btn-primary" id="btn-save-rmto">ذخیره تنظیمات رهسام</button>
                        </div>
                    </div>

                    <!-- General Settings -->
                    <div class="panel">
                        <div class="panel-header">
                            <h3 class="panel-title">تنظیمات عمومی</h3>
                        </div>
                        <div class="panel-body">
                            <div class="form-group">
                                <label>نام سامانه</label>
                                <input type="text" id="setting-name" value="نوآوران جنوب شرق">
                            </div>
                            <div class="form-group">
                                <label>آدرس IP سرور</label>
                                <input type="text" id="setting-server" value="0.0.0.0" dir="ltr">
                            </div>
                            <div class="form-group">
                                <label>پورت سرور</label>
                                <input type="number" id="setting-port" value="3000" dir="ltr">
                            </div>
                            <div class="form-group">
                                <label>فاصله ارسال به رهسام (دقیقه)</label>
                                <input type="number" id="setting-refresh" value="15" dir="ltr">
                            </div>
                            <div class="form-group">
                                <label>حداکثر سرعت مجاز (km/h)</label>
                                <input type="number" id="setting-max-speed" value="120" dir="ltr">
                            </div>
                            <button class="btn btn-primary" id="btn-save-settings">ذخیره تنظیمات</button>
                        </div>
                    </div>

                    <!-- Password -->
                    <div class="panel">
                        <div class="panel-header">
                            <h3 class="panel-title">تغییر رمز عبور</h3>
                        </div>
                        <div class="panel-body">
                            <div class="form-group">
                                <label>رمز عبور فعلی</label>
                                <input type="password" id="setting-old-pass" dir="ltr">
                            </div>
                            <div class="form-group">
                                <label>رمز عبور جدید</label>
                                <input type="password" id="setting-new-pass" dir="ltr">
                            </div>
                            <button class="btn btn-primary" id="btn-change-pass">تغییر رمز</button>
                            <button class="btn btn-danger" id="btn-logout" style="margin-right:8px">خروج</button>
                        </div>
                    </div>

                    <!-- Backup -->
                    <div class="panel">
                        <div class="panel-header">
                            <h3 class="panel-title">پشتیبان‌گیری و بازیابی</h3>
                        </div>
                        <div class="panel-body">
                            <div class="form-group">
                                <button class="btn btn-primary" id="btn-backup-download">دانلود پشتیبان دیتابیس</button>
                            </div>
                            <div class="form-group">
                                <label>بازیابی از فایل (.db یا .sql.gz)</label>
                                <input type="file" id="backup-file" accept=".db,.sql,.gz,.sql.gz" style="margin-top:6px">
                            </div>
                            <button class="btn btn-danger" id="btn-backup-restore">آپلود و بازیابی</button>
                            <div id="backup-status" style="margin-top:12px;font-size:13px;color:#475569"></div>
                        </div>
                    </div>

                    <!-- About -->
                    <div class="panel">
                        <div class="panel-header">
                            <h3 class="panel-title">درباره</h3>
                        </div>
                        <div class="panel-body about-info">
                            <p><strong>نوآوران جنوب شرق</strong></p>
                            <p>نسخه: <span dir="ltr">1.2.0</span></p>
                            <p>سامانه مدیریت ترددشمار هوشمند</p>
                            <p>سازگار با TC Manager رهسام (RMTO)</p>
                        </div>
                    </div>
                </div>
            </section>

        </main>

        <!-- Footer -->
        <footer class="footer">
            <div class="footer-right">نوآوران جنوب شرق - TC Manager &copy; ۱۴۰۴</div>
            <div class="footer-left">
                <span class="footer-status" id="footer-device-count">0 دستگاه فعال</span>
            </div>
        </footer>
    </div>

    <!-- Modal -->
    <div class="modal-overlay" id="modal-overlay">
        <div class="modal">
            <div class="modal-header">
                <h3 id="modal-title">جزئیات</h3>
                <button class="modal-close" id="modal-close">&times;</button>
            </div>
            <div class="modal-body" id="modal-body"></div>
            <div class="modal-footer" id="modal-footer">
                <button class="btn btn-secondary" id="modal-cancel">بستن</button>
                <button class="btn btn-primary" id="modal-save" style="display:none;">ذخیره</button>
            </div>
        </div>
    </div>

    <!-- Add Modal -->
    <div class="modal-overlay" id="add-modal-overlay">
        <div class="modal">
            <div class="modal-header">
                <h3 id="add-modal-title">افزودن</h3>
                <button class="modal-close" id="add-modal-close">&times;</button>
            </div>
            <div class="modal-body" id="add-modal-body"></div>
            <div class="modal-footer">
                <button class="btn btn-secondary" id="add-modal-cancel">انصراف</button>
                <button class="btn btn-primary" id="add-modal-save">ذخیره</button>
            </div>
        </div>
    </div>

    <script src="js/app.js"></script>
</body>
</html>
ENDOFFILE_INDEX_HTML

echo "[+] css/style.css"
cat > "$APP_DIR/css/style.css" << 'ENDOFFILE_CSS_STYLE_CSS'
/* === Reset === */
*, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }

:root {
    --sidebar-w: 240px;
    --sidebar-bg: #1e293b;
    --sidebar-active: #3b82f6;
    --topbar-h: 56px;
    --footer-h: 40px;
    --bg: #f1f5f9;
    --white: #ffffff;
    --border: #e2e8f0;
    --text: #334155;
    --text-light: #94a3b8;
    --primary: #3b82f6;
    --primary-dark: #2563eb;
    --success: #22c55e;
    --warning: #f59e0b;
    --error: #ef4444;
    --radius: 8px;
    --shadow: 0 1px 3px rgba(0,0,0,.08);
    --shadow-md: 0 4px 12px rgba(0,0,0,.1);
}

body {
    font-family: Tahoma, 'Segoe UI', Arial, sans-serif;
    background: var(--bg);
    color: var(--text);
    direction: rtl;
    display: flex;
    min-height: 100vh;
}

/* === Sidebar === */
.sidebar {
    width: var(--sidebar-w);
    background: var(--sidebar-bg);
    color: #cbd5e1;
    display: flex;
    flex-direction: column;
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    z-index: 100;
    transition: transform .25s;
}

.sidebar-header {
    padding: 20px 16px;
    border-bottom: 1px solid rgba(255,255,255,.08);
}

.sidebar-logo {
    display: flex;
    align-items: center;
    gap: 12px;
}

.logo-icon {
    width: 42px;
    height: 42px;
    background: var(--primary);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 16px;
    color: white;
    letter-spacing: -1px;
}

.logo-text { display: flex; flex-direction: column; }
.logo-title { font-size: 18px; font-weight: 700; color: white; }
.logo-sub { font-size: 11px; color: #64748b; }

.sidebar-nav {
    flex: 1;
    padding: 12px 8px;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.nav-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 11px 14px;
    border: none;
    background: none;
    border-radius: var(--radius);
    color: #94a3b8;
    font-size: 14px;
    cursor: pointer;
    text-align: right;
    width: 100%;
    transition: all .15s;
    font-family: inherit;
}

.nav-item:hover { background: rgba(255,255,255,.06); color: #e2e8f0; }

.nav-item.active {
    background: var(--sidebar-active);
    color: white;
}

.nav-icon {
    width: 20px;
    height: 20px;
    fill: currentColor;
    flex-shrink: 0;
}

.sidebar-footer {
    padding: 16px;
    border-top: 1px solid rgba(255,255,255,.08);
}

.sidebar-user {
    display: flex;
    align-items: center;
    gap: 10px;
}

.user-avatar {
    width: 36px;
    height: 36px;
    background: #475569;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    color: white;
}

.user-info { display: flex; flex-direction: column; }
.user-name { font-size: 13px; color: #e2e8f0; }
.user-role { font-size: 11px; color: #64748b; }

/* === Main Wrapper === */
.main-wrapper {
    margin-right: var(--sidebar-w);
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 100vh;
}

/* === Topbar === */
.topbar {
    height: var(--topbar-h);
    background: var(--white);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    padding: 0 24px;
    gap: 16px;
    position: sticky;
    top: 0;
    z-index: 50;
}

.topbar-toggle {
    display: none;
    background: none;
    border: none;
    cursor: pointer;
    fill: var(--text);
    padding: 4px;
}

.topbar-title {
    font-size: 16px;
    font-weight: 700;
    color: var(--text);
}

.topbar-left {
    margin-right: auto;
    display: flex;
    align-items: center;
    gap: 12px;
}

.topbar-time {
    font-size: 13px;
    color: var(--text-light);
    direction: ltr;
}

.topbar-badge {
    font-size: 11px;
    padding: 3px 10px;
    border-radius: 20px;
    font-weight: 600;
}

.topbar-badge.online {
    background: rgba(34,197,94,.12);
    color: var(--success);
}

/* === Content === */
.content {
    flex: 1;
    padding: 24px;
}

.view { display: none; }
.view.active { display: block; }

/* === Stats Row === */
.stats-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 24px;
}

.stat-card {
    background: var(--white);
    border-radius: var(--radius);
    padding: 20px;
    display: flex;
    align-items: center;
    gap: 16px;
    box-shadow: var(--shadow);
}

.stat-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.stat-icon svg { width: 24px; height: 24px; fill: white; }
.stat-icon.blue { background: var(--primary); }
.stat-icon.green { background: var(--success); }
.stat-icon.orange { background: var(--warning); }
.stat-icon.red { background: var(--error); }

.stat-body { display: flex; flex-direction: column; }

.stat-value {
    font-size: 26px;
    font-weight: 800;
    color: var(--text);
    direction: ltr;
    text-align: right;
}

.stat-label {
    font-size: 12px;
    color: var(--text-light);
    margin-top: 2px;
}

/* === Panel === */
.panel {
    background: var(--white);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    overflow: hidden;
}

.panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
    flex-wrap: wrap;
    gap: 12px;
}

.panel-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--text);
}

.panel-tools {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
}

.panel-body {
    padding: 20px;
}

/* === Export Buttons === */
.export-btns {
    display: flex;
    gap: 0;
}

.export-btn {
    padding: 6px 14px;
    border: 1px solid var(--border);
    background: var(--white);
    font-size: 12px;
    cursor: pointer;
    color: var(--text);
    font-family: inherit;
    transition: background .15s;
}

.export-btn:first-child { border-radius: 0 var(--radius) var(--radius) 0; }
.export-btn:last-child { border-radius: var(--radius) 0 0 var(--radius); }
.export-btn:not(:last-child) { border-left: none; }

.export-btn:hover {
    background: var(--primary);
    color: white;
    border-color: var(--primary);
}

/* === Search Box === */
.search-box {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--text-light);
}

.search-input {
    padding: 6px 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: 13px;
    width: 180px;
    font-family: inherit;
    direction: rtl;
}

.search-input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(59,130,246,.12);
}

/* === Data Table === */
.table-wrapper { overflow-x: auto; }

.data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
}

.data-table thead { background: #f8fafc; }

.data-table th {
    text-align: right;
    padding: 12px 16px;
    font-weight: 600;
    color: var(--text-light);
    font-size: 12px;
    border-bottom: 2px solid var(--border);
    white-space: nowrap;
    cursor: pointer;
    user-select: none;
}

.data-table th:hover { color: var(--primary); }

.data-table th.sort-asc::after { content: " \25B2"; font-size: 10px; }
.data-table th.sort-desc::after { content: " \25BC"; font-size: 10px; }

.data-table td {
    padding: 11px 16px;
    border-bottom: 1px solid #f1f5f9;
    color: var(--text);
}

.data-table tbody tr:hover { background: #f8fafc; }

.data-table tbody tr:nth-child(even) { background: #fafbfc; }
.data-table tbody tr:nth-child(even):hover { background: #f1f5f9; }

/* === Status Badges === */
.status-badge {
    display: inline-block;
    font-size: 11px;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 20px;
}

.status-badge.online { background: rgba(34,197,94,.1); color: var(--success); }
.status-badge.offline { background: rgba(148,163,184,.15); color: var(--text-light); }
.status-badge.warning { background: rgba(245,158,11,.1); color: var(--warning); }
.status-badge.error { background: rgba(239,68,68,.1); color: var(--error); }

.type-badge {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 4px;
    background: #f1f5f9;
    color: #475569;
}

/* === Table Footer === */
.table-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    border-top: 1px solid var(--border);
    font-size: 13px;
    color: var(--text-light);
}

.pagination {
    display: flex;
    gap: 4px;
}

.page-btn {
    min-width: 32px;
    height: 32px;
    border: 1px solid var(--border);
    background: var(--white);
    border-radius: 6px;
    font-size: 12px;
    cursor: pointer;
    color: var(--text);
    font-family: inherit;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all .15s;
}

.page-btn:hover { border-color: var(--primary); color: var(--primary); }

.page-btn.active {
    background: var(--primary);
    color: white;
    border-color: var(--primary);
}

.page-btn:disabled {
    opacity: .4;
    cursor: not-allowed;
}

/* === Buttons === */
.btn {
    padding: 8px 18px;
    border: none;
    border-radius: var(--radius);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background .15s;
    white-space: nowrap;
}

.btn-primary { background: var(--primary); color: white; }
.btn-primary:hover { background: var(--primary-dark); }
.btn-secondary { background: #e2e8f0; color: var(--text); }
.btn-secondary:hover { background: #cbd5e1; }
.btn-danger { background: var(--error); color: white; }
.btn-danger:hover { background: #dc2626; }

.btn-sm { padding: 5px 10px; font-size: 12px; }

.action-btns { display: flex; gap: 6px; }

/* === Forms === */
.form-group {
    margin-bottom: 16px;
}

.form-group > label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: #475569;
    margin-bottom: 6px;
}

.form-group input[type="text"],
.form-group input[type="password"],
.form-group input[type="number"],
.form-group input[type="date"],
.form-group select {
    width: 100%;
    padding: 9px 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: 13px;
    font-family: inherit;
    direction: rtl;
    background: var(--white);
}

.form-group input:focus,
.form-group select:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(59,130,246,.12);
}

.toggle-label {
    display: flex !important;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    font-weight: 400 !important;
}

.toggle-label input { accent-color: var(--primary); }

/* === Report Filters === */
.report-filters {
    display: flex;
    align-items: flex-end;
    gap: 16px;
    margin-bottom: 20px;
    flex-wrap: wrap;
    background: var(--white);
    padding: 16px 20px;
    border-radius: var(--radius);
    box-shadow: var(--shadow);
}

.filter-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.filter-group label {
    font-size: 12px;
    font-weight: 600;
    color: #475569;
}

.filter-group select,
.filter-group input {
    padding: 8px 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: 13px;
    font-family: inherit;
    min-width: 160px;
}

/* === Settings === */
.settings-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
    gap: 20px;
}

.about-info p {
    margin-bottom: 8px;
    font-size: 13px;
    color: #475569;
    line-height: 1.8;
}

/* === Modal === */
.modal-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,.45);
    z-index: 200;
    align-items: center;
    justify-content: center;
}

.modal-overlay.active { display: flex; }

.modal {
    background: var(--white);
    border-radius: 12px;
    width: 92%;
    max-width: 520px;
    max-height: 85vh;
    overflow-y: auto;
    box-shadow: 0 20px 60px rgba(0,0,0,.25);
}

.modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 24px;
    border-bottom: 1px solid var(--border);
}

.modal-header h3 { font-size: 16px; font-weight: 700; }

.modal-close {
    background: none;
    border: none;
    font-size: 22px;
    color: var(--text-light);
    cursor: pointer;
    line-height: 1;
}

.modal-close:hover { color: var(--text); }

.modal-body { padding: 24px; }

.modal-footer {
    display: flex;
    justify-content: flex-start;
    gap: 10px;
    padding: 16px 24px;
    border-top: 1px solid var(--border);
}

/* === Detail Grid in Modal === */
.detail-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
}

.detail-item { display: flex; flex-direction: column; gap: 4px; }

.detail-label {
    font-size: 11px;
    color: var(--text-light);
    letter-spacing: .3px;
}

.detail-value {
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
}

/* === Footer === */
.footer {
    height: var(--footer-h);
    background: var(--white);
    border-top: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
    font-size: 12px;
    color: var(--text-light);
}

.footer-status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

.footer-status::before {
    content: "";
    width: 7px;
    height: 7px;
    background: var(--success);
    border-radius: 50%;
}

/* === Responsive === */
@media (max-width: 1024px) {
    .stats-row { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 768px) {
    .sidebar { transform: translateX(100%); }
    .sidebar.open { transform: translateX(0); }

    .main-wrapper { margin-right: 0; }

    .topbar-toggle { display: block; }

    .stats-row { grid-template-columns: 1fr; }

    .panel-header { flex-direction: column; align-items: flex-start; }

    .settings-grid { grid-template-columns: 1fr; }

    .detail-grid { grid-template-columns: 1fr; }

    .report-filters { flex-direction: column; align-items: stretch; }
}

/* === Login Page === */
.login-overlay {
    position: fixed;
    inset: 0;
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    z-index: 999;
    display: flex;
    align-items: center;
    justify-content: center;
}

.login-overlay.hidden { display: none; }

.login-box {
    background: var(--white);
    border-radius: 16px;
    padding: 40px 36px;
    width: 380px;
    max-width: 92%;
    box-shadow: 0 20px 60px rgba(0,0,0,.3);
}

.login-logo {
    text-align: center;
    margin-bottom: 28px;
}

.login-logo h2 {
    font-size: 22px;
    color: var(--text);
    margin-bottom: 4px;
}

.login-logo p {
    font-size: 13px;
    color: var(--text-light);
}
ENDOFFILE_CSS_STYLE_CSS

echo "[+] js/app.js"
cat > "$APP_DIR/js/app.js" << 'ENDOFFILE_JS_APP_JS'
(function () {
    "use strict";

    // ============================================================
    // Helpers
    // ============================================================
    var $ = function (sel) { return document.querySelector(sel); };
    var $$ = function (sel) { return document.querySelectorAll(sel); };

    function escapeHtml(str) {
        if (str == null) return "";
        var div = document.createElement("div");
        div.appendChild(document.createTextNode(String(str)));
        return div.innerHTML;
    }

    function formatTime(iso) {
        if (!iso) return "-";
        var d = new Date(iso);
        if (isNaN(d.getTime())) return String(iso);
        var y = d.getFullYear();
        var mo = String(d.getMonth() + 1).padStart(2, "0");
        var dy = String(d.getDate()).padStart(2, "0");
        var h = String(d.getHours()).padStart(2, "0");
        var m = String(d.getMinutes()).padStart(2, "0");
        return y + "/" + mo + "/" + dy + " " + h + ":" + m;
    }

    function api(method, url, body, callback) {
        var xhr = new XMLHttpRequest();
        xhr.open(method, url, true);
        xhr.withCredentials = true;
        if (body && method !== "GET") {
            xhr.setRequestHeader("Content-Type", "application/json");
        }
        xhr.onload = function () {
            var data = null;
            try { data = JSON.parse(xhr.responseText); } catch (e) { data = null; }
            callback(xhr.status, data);
        };
        xhr.onerror = function () { callback(0, null); };
        xhr.send(body ? JSON.stringify(body) : null);
    }

    var TYPE_LABELS = { counter: "ترددشمار", sensor: "سنسور", loop: "حلقه القایی", radar: "رادار" };
    var STATUS_LABELS = { online: "آنلاین", offline: "آفلاین", warning: "هشدار", error: "خطا" };

    var VIEW_TITLES = {
        dashboard: "داشبورد",
        devices: "دستگاه‌ها",
        reception: "دریافت داده",
        rmto: "ارسال رهسام",
        settings: "تنظیمات"
    };

    var PAGE_SIZE = 20;

    // ============================================================
    // Authentication
    // ============================================================
    var loginOverlay = $("#login-overlay");
    var loginForm = $("#login-form");
    var loginError = $("#login-error");
    var serverConnected = false;

    function checkAuth() {
        api("GET", "/api/auth/check", null, function (status, data) {
            if (status === 200 && data && data.loggedIn) {
                loginOverlay.classList.add("hidden");
                serverConnected = true;
                updateConnectionStatus(true);
                if (data.username) {
                    var u = $("#topbar-user"); if (u) u.textContent = data.username;
                    var n = $(".user-name"); if (n) n.textContent = data.username;
                }
                loadDashboard();
            } else if (status === 200) {
                loginOverlay.classList.remove("hidden");
                serverConnected = true;
                updateConnectionStatus(true);
            } else {
                serverConnected = false;
                updateConnectionStatus(false);
                loginOverlay.classList.remove("hidden");
            }
        });
    }

    function updateConnectionStatus(connected) {
        var badge = $("#topbar-status");
        if (!badge) return;
        if (connected) {
            badge.textContent = "متصل به سرور";
            badge.className = "topbar-badge online";
        } else {
            badge.textContent = "عدم اتصال";
            badge.className = "topbar-badge";
            badge.style.background = "rgba(239,68,68,.12)";
            badge.style.color = "#ef4444";
        }
    }

    if (loginForm) {
        loginForm.addEventListener("submit", function (e) {
            e.preventDefault();
            var user = $("#login-user").value;
            var pass = $("#login-pass").value;
            api("POST", "/api/auth/login", { username: user, password: pass }, function (status, data) {
                if (status === 200 && data && data.success) {
                    loginOverlay.classList.add("hidden");
                    loginError.style.display = "none";
                    serverConnected = true;
                    updateConnectionStatus(true);
                    if (data.username) {
                        var u = $("#topbar-user"); if (u) u.textContent = data.username;
                        var n = $(".user-name"); if (n) n.textContent = data.username;
                    }
                    loadDashboard();
                } else {
                    loginError.textContent = (data && data.error) || "نام کاربری یا رمز عبور اشتباه است";
                    loginError.style.display = "block";
                }
            });
        });
    }

    checkAuth();

    // ============================================================
    // Navigation
    // ============================================================
    $$(".nav-item").forEach(function (btn) {
        btn.addEventListener("click", function () {
            switchView(btn.getAttribute("data-view"));
        });
    });

    function switchView(view) {
        $$(".nav-item").forEach(function (b) { b.classList.remove("active"); });
        var activeBtn = document.querySelector('.nav-item[data-view="' + view + '"]');
        if (activeBtn) activeBtn.classList.add("active");
        $$(".view").forEach(function (v) { v.classList.remove("active"); });
        var target = $("#view-" + view);
        if (target) target.classList.add("active");
        $("#topbar-title").textContent = VIEW_TITLES[view] || view;

        if (view === "dashboard") loadDashboard();
        else if (view === "devices") loadDevices();
        else if (view === "reception") loadReception();
        else if (view === "rmto") loadRMTO();
        else if (view === "settings") loadSettings();
    }

    // Sidebar toggle (mobile)
    $("#sidebar-toggle").addEventListener("click", function () {
        $("#sidebar").classList.toggle("open");
    });

    // Clock
    function updateClock() {
        var now = new Date();
        var h = String(now.getHours()).padStart(2, "0");
        var m = String(now.getMinutes()).padStart(2, "0");
        var s = String(now.getSeconds()).padStart(2, "0");
        $("#topbar-time").textContent = h + ":" + m + ":" + s;
    }
    updateClock();
    setInterval(updateClock, 1000);

    // ============================================================
    // Dashboard
    // ============================================================
    function loadDashboard() {
        api("GET", "/api/stats", null, function (status, data) {
            if (status === 200 && data) {
                $("#stat-total-devices").textContent = data.totalDevices || 0;
                $("#stat-online-devices").textContent = data.onlineDevices || 0;
                $("#stat-today-vehicles").textContent = data.todayVehicles || 0;
                $("#stat-unsent-rmto").textContent = (data.unsentRMTO || 0) + (data.unsentRMTO5 || 0);
                $("#footer-device-count").textContent = (data.onlineDevices || 0) + " دستگاه فعال";
            }
        });

        api("GET", "/api/devices", null, function (status, data) {
            var tbody = $("#dashboard-table-body");
            if (status !== 200 || !data || !data.length) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94a3b8">دستگاهی ثبت نشده است</td></tr>';
                return;
            }
            tbody.innerHTML = data.map(function (d) {
                var st = d.status || "offline";
                return "<tr>" +
                    '<td dir="ltr" style="text-align:right;font-weight:700">' + escapeHtml(d.device_code) + "</td>" +
                    "<td>" + escapeHtml(d.name) + "</td>" +
                    '<td><span class="type-badge">' + escapeHtml(TYPE_LABELS[d.type] || d.type) + "</span></td>" +
                    '<td><span class="status-badge ' + st + '">' + escapeHtml(STATUS_LABELS[st] || st) + "</span></td>" +
                    '<td dir="ltr" style="text-align:right">' + escapeHtml(formatTime(d.last_seen)) + "</td>" +
                    "</tr>";
            }).join("");
        });
    }

    var refreshDashBtn = $("#btn-refresh-dashboard");
    if (refreshDashBtn) refreshDashBtn.addEventListener("click", loadDashboard);

    // ============================================================
    // Live Monitor
    // ============================================================
    var lastLiveTs = 0;

    function loadLive() {
        var url = "/api/live?limit=50";
        if (lastLiveTs > 0) url = "/api/live?since=" + lastLiveTs;

        api("GET", url, null, function (status, data) {
            var tbody = $("#live-table-body");
            if (status !== 200 || !data || !data.length) {
                if (lastLiveTs === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94a3b8">هنوز داده‌ای دریافت نشده</td></tr>';
                }
                return;
            }

            if (lastLiveTs === 0) tbody.innerHTML = "";

            // Update timestamp
            if (data[0] && data[0].ts) lastLiveTs = data[0].ts;

            var newHtml = data.map(function (e) {
                var typeLabel = { data: "HTTP", irawdata: "HTTP-iraw", tcp: "TCP", "tcp-raw": "TCP-خام", unknown: "نامشخص" }[e.type] || e.type;
                var typeClass = { data: "online", irawdata: "online", tcp: "online", "tcp-raw": "warning", unknown: "warning" }[e.type] || "";
                var detail = "";
                if (e.type === "tcp") {
                    detail = "تردد=" + (e.total||0) + " | a:" + (e.a||0) + " b:" + (e.b||0) + " c:" + (e.c||0) + " d:" + (e.d||0) + " e:" + (e.e||0) + " x:" + (e.x||0) + " لاین:" + (e.lane||1);
                } else if (e.type === "tcp-raw") {
                    detail = e.detail || "raw data";
                } else if (e.type === "irawdata") {
                    detail = "a:" + (e.a||0) + " b:" + (e.b||0) + " c:" + (e.c||0) + " d:" + (e.d||0) + " e:" + (e.e||0) + " x:" + (e.x||0);
                } else if (e.type === "unknown") {
                    detail = escapeHtml(e.path || "");
                    if (e.body) {
                        var keys = Object.keys(e.body).slice(0, 5).join(",");
                        detail += " {" + keys + "}";
                    }
                } else if (e.type === "data") {
                    if (e.body && e.body.records) detail = e.body.records.length + " records";
                    else detail = "1 record";
                }
                var time = e.time || "";
                if (time) {
                    var d = new Date(time);
                    time = String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0") + ":" + String(d.getSeconds()).padStart(2,"0");
                }
                return "<tr>" +
                    '<td dir="ltr" style="text-align:right;font-size:12px;font-family:monospace">' + escapeHtml(time) + "</td>" +
                    '<td><span class="status-badge ' + typeClass + '">' + escapeHtml(typeLabel) + "</span></td>" +
                    '<td dir="ltr" style="text-align:right;font-size:11px">' + escapeHtml(e.ip || "-") + "</td>" +
                    '<td dir="ltr" style="text-align:right;font-weight:700">' + escapeHtml(e.device || "-") + "</td>" +
                    '<td dir="ltr" style="font-size:11px;max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escapeHtml(detail) + "</td>" +
                    "</tr>";
            }).join("");

            tbody.insertAdjacentHTML("afterbegin", newHtml);

            // Keep max 100 rows
            while (tbody.children.length > 100) tbody.removeChild(tbody.lastChild);
        });
    }

    var refreshLiveBtn = $("#btn-refresh-live");
    if (refreshLiveBtn) refreshLiveBtn.addEventListener("click", function () { lastLiveTs = 0; loadLive(); });

    // Auto-refresh live monitor every 3 seconds
    setInterval(function () {
        var autoCheck = $("#live-auto-refresh");
        var activeView = document.querySelector(".view.active");
        if (autoCheck && autoCheck.checked && activeView && activeView.id === "view-dashboard") {
            loadLive();
        }
    }, 3000);

    // ============================================================
    // Devices
    // ============================================================
    var allDevices = [];
    var deviceState = { page: 1, search: "" };

    function loadDevices() {
        api("GET", "/api/devices", null, function (status, data) {
            if (status === 200 && data) {
                allDevices = data;
            } else {
                allDevices = [];
            }
            deviceState.page = 1;
            renderDeviceTable();
        });
    }

    function renderDeviceTable() {
        var q = deviceState.search.toLowerCase();
        var filtered = allDevices.filter(function (d) {
            if (!q) return true;
            return (d.name || "").toLowerCase().indexOf(q) !== -1 ||
                   (d.device_code || "").indexOf(q) !== -1;
        });
        var total = filtered.length;
        var start = (deviceState.page - 1) * PAGE_SIZE;
        var paged = filtered.slice(start, start + PAGE_SIZE);

        var tbody = $("#devices-table-body");
        if (!paged.length) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#94a3b8">دستگاهی یافت نشد</td></tr>';
        } else {
            tbody.innerHTML = paged.map(function (d, i) {
                var st = d.status || "offline";
                return "<tr>" +
                    "<td>" + (start + i + 1) + "</td>" +
                    '<td dir="ltr" style="text-align:right;font-weight:700">' + escapeHtml(d.device_code) + "</td>" +
                    "<td><strong>" + escapeHtml(d.name) + "</strong></td>" +
                    '<td><span class="type-badge">' + escapeHtml(TYPE_LABELS[d.type] || d.type) + "</span></td>" +
                    "<td>" + escapeHtml(d.route || "-") + "</td>" +
                    '<td><span class="status-badge ' + st + '">' + escapeHtml(STATUS_LABELS[st] || st) + "</span></td>" +
                    '<td dir="ltr" style="text-align:right">' + escapeHtml(formatTime(d.last_seen)) + "</td>" +
                    "<td>" +
                        '<div class="action-btns">' +
                            '<button class="btn btn-sm btn-danger btn-dev-delete" data-code="' + escapeHtml(d.device_code) + '">حذف</button>' +
                        "</div></td>" +
                    "</tr>";
            }).join("");

            tbody.querySelectorAll(".btn-dev-delete").forEach(function (btn) {
                btn.addEventListener("click", function () {
                    var code = btn.getAttribute("data-code");
                    if (confirm("آیا از حذف دستگاه " + code + " مطمئن هستید؟")) {
                        api("DELETE", "/api/devices/" + code, null, function (s) {
                            if (s === 200) loadDevices();
                            else alert("خطا در حذف");
                        });
                    }
                });
            });
        }

        renderTableInfo("devices", start, paged.length, total);
        renderPagination("devices", deviceState, total, renderDeviceTable);
    }

    var devSearch = $("#devices-search");
    if (devSearch) devSearch.addEventListener("input", function () {
        deviceState.search = this.value.trim();
        deviceState.page = 1;
        renderDeviceTable();
    });

    // Add device
    var addDevBtn = $("#btn-add-device");
    if (addDevBtn) addDevBtn.addEventListener("click", function () {
        $("#add-modal-title").textContent = "افزودن دستگاه جدید";
        $("#add-modal-body").innerHTML =
            '<form id="add-device-form">' +
                '<div class="form-group"><label>کد دستگاه (حداکثر ۸ رقم)</label><input type="text" id="new-dev-code" maxlength="8" pattern="\\d{1,8}" dir="ltr" placeholder="مثال: 10010001" required></div>' +
                '<div class="form-group"><label>نام دستگاه</label><input type="text" id="new-dev-name" required></div>' +
                '<div class="form-group"><label>نوع</label><select id="new-dev-type">' +
                    '<option value="counter">ترددشمار</option>' +
                    '<option value="sensor">سنسور</option>' +
                    '<option value="loop">حلقه القایی</option>' +
                    '<option value="radar">رادار</option>' +
                '</select></div>' +
                '<div class="form-group"><label>محور</label><input type="text" id="new-dev-route" placeholder="نام محور"></div>' +
            '</form>';
        currentAddMode = "device";
        $("#add-modal-overlay").classList.add("active");
    });

    // ============================================================
    // Data Reception (irawdata)
    // ============================================================
    var receptionState = { page: 1, total: 0, filterCode: "" };

    function loadReception() {
        var code = receptionState.filterCode;
        var offset = (receptionState.page - 1) * PAGE_SIZE;
        var url = "/api/irawdata/list?limit=" + PAGE_SIZE + "&offset=" + offset;
        if (code) url += "&device_code=" + encodeURIComponent(code);

        api("GET", url, null, function (status, data) {
            var tbody = $("#reception-table-body");
            if (status !== 200 || !data || !data.rows || !data.rows.length) {
                tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:#94a3b8">داده‌ای دریافت نشده</td></tr>';
                receptionState.total = 0;
                renderTableInfo("reception", 0, 0, 0);
                renderPagination("reception", receptionState, 0, loadReception);
                return;
            }

            receptionState.total = data.total;
            var rows = data.rows;
            var start = (receptionState.page - 1) * PAGE_SIZE;

            tbody.innerHTML = rows.map(function (r) {
                var total = (r.a||0) + (r.b||0) + (r.c||0) + (r.d||0) + (r.e||0) + (r.x||0);
                return "<tr>" +
                    '<td dir="ltr" style="text-align:right;font-weight:700">' + escapeHtml(r.device_code) + "</td>" +
                    '<td dir="ltr" style="text-align:right;font-size:11px">' + escapeHtml(formatTime(r.create_at)) + "</td>" +
                    '<td dir="ltr" style="text-align:right;font-size:11px">' + escapeHtml(formatTime(r.stop)) + "</td>" +
                    '<td dir="ltr" style="text-align:center">' + (r.lane||1) + "</td>" +
                    '<td dir="ltr" style="text-align:center">' + (r.a||0) + "</td>" +
                    '<td dir="ltr" style="text-align:center">' + (r.b||0) + "</td>" +
                    '<td dir="ltr" style="text-align:center">' + (r.c||0) + "</td>" +
                    '<td dir="ltr" style="text-align:center">' + (r.d||0) + "</td>" +
                    '<td dir="ltr" style="text-align:center">' + (r.e||0) + "</td>" +
                    '<td dir="ltr" style="text-align:center">' + (r.x||0) + "</td>" +
                    '<td dir="ltr" style="text-align:center;font-weight:700">' + total + "</td>" +
                    "</tr>";
            }).join("");

            renderTableInfo("reception", start, rows.length, data.total);
            renderPagination("reception", receptionState, data.total, loadReception);
        });
    }

    var recFilter = $("#reception-filter-code");
    if (recFilter) recFilter.addEventListener("change", function () {
        receptionState.filterCode = this.value.trim();
        receptionState.page = 1;
        loadReception();
    });

    var recRefresh = $("#btn-refresh-reception");
    if (recRefresh) recRefresh.addEventListener("click", function () {
        receptionState.page = 1;
        loadReception();
    });

    // ============================================================
    // RMTO Send
    // ============================================================
    function loadRMTO() {
        // Load queue
        api("GET", "/api/rmto/queue", null, function (status, data) {
            if (status !== 200 || !data) return;

            // Unsent
            var ubody = $("#rmto-unsent-body");
            if (data.unsent && data.unsent.length) {
                ubody.innerHTML = data.unsent.map(function (r) {
                    return "<tr>" +
                        '<td dir="ltr" style="text-align:right;font-weight:700">' + escapeHtml(r.device_code) + "</td>" +
                        '<td dir="ltr" style="text-align:right">' + escapeHtml(formatTime(r.period_start)) + "</td>" +
                        '<td dir="ltr" style="text-align:center">' + (r.total_vehicles||0) + "</td>" +
                        '<td dir="ltr" style="text-align:center">' + (r.avg_speed||0) + "</td>" +
                        '<td dir="ltr" style="text-align:right;font-size:11px">' + escapeHtml(formatTime(r.created_at)) + "</td>" +
                        "</tr>";
                }).join("");
                $("#rmto-unsent-count").textContent = data.unsent.length;
            } else {
                ubody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94a3b8">صف ارسال خالی</td></tr>';
                $("#rmto-unsent-count").textContent = "0";
            }

            // Sent
            if (data.sent && data.sent.length) {
                $("#rmto-sent-count").textContent = data.sent.length + "+";
                var lastSent = data.sent[0];
                if (lastSent && lastSent.sent_at) {
                    $("#rmto-last-send").textContent = formatTime(lastSent.sent_at);
                }
            } else {
                $("#rmto-sent-count").textContent = "0";
                $("#rmto-last-send").textContent = "-";
            }
        });

        // Load logs
        api("GET", "/api/rmto/logs?limit=30", null, function (status, data) {
            var lbody = $("#rmto-log-body");
            if (status !== 200 || !data || !data.length) {
                lbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94a3b8">هنوز ارسالی انجام نشده</td></tr>';
                return;
            }
            lbody.innerHTML = data.map(function (r) {
                var ok = r.success === 1;
                var resp = r.response_data || "";
                if (resp.length > 60) resp = resp.substring(0, 60) + "...";
                return "<tr>" +
                    "<td>" + escapeHtml(r.method) + "</td>" +
                    '<td dir="ltr" style="text-align:right;font-weight:700">' + escapeHtml(r.device_code) + "</td>" +
                    '<td><span class="status-badge ' + (ok ? "online" : "error") + '">' + (ok ? "موفق" : "خطا") + "</span></td>" +
                    '<td dir="ltr" style="font-size:11px;max-width:200px;overflow:hidden;text-overflow:ellipsis">' + escapeHtml(resp) + "</td>" +
                    '<td dir="ltr" style="text-align:right;font-size:11px">' + escapeHtml(formatTime(r.created_at)) + "</td>" +
                    "</tr>";
            }).join("");
        });
    }

    var rmtoSendBtn = $("#btn-rmto-send-now");
    if (rmtoSendBtn) rmtoSendBtn.addEventListener("click", function () {
        rmtoSendBtn.disabled = true;
        rmtoSendBtn.textContent = "در حال ارسال...";
        api("POST", "/api/rmto/send-now", {}, function (status) {
            rmtoSendBtn.disabled = false;
            rmtoSendBtn.textContent = "ارسال الان";
            if (status === 200) {
                alert("ارسال انجام شد. نتیجه را در تاریخچه ببینید.");
                loadRMTO();
            } else alert("خطا در ارسال");
        });
    });

    var rmtoAggBtn = $("#btn-rmto-aggregate");
    if (rmtoAggBtn) rmtoAggBtn.addEventListener("click", function () {
        rmtoAggBtn.disabled = true;
        api("POST", "/api/rmto/aggregate", {}, function (status) {
            rmtoAggBtn.disabled = false;
            if (status === 200) {
                alert("تجمیع و ارسال انجام شد.");
                loadRMTO();
            } else alert("خطا");
        });
    });

    var rmtoRefreshBtn = $("#btn-rmto-refresh");
    if (rmtoRefreshBtn) rmtoRefreshBtn.addEventListener("click", loadRMTO);

    // ============================================================
    // Settings
    // ============================================================
    function loadSettings() {
        api("GET", "/api/settings", null, function (status, data) {
            if (status !== 200 || !data) return;
            if (data.system_name) $("#setting-name").value = data.system_name;
            if (data.server_ip) $("#setting-server").value = data.server_ip;
            if (data.server_port) $("#setting-port").value = data.server_port;
            if (data.refresh_interval) $("#setting-refresh").value = data.refresh_interval;
            if (data.max_speed) $("#setting-max-speed").value = data.max_speed;
            // RMTO
            if (data.rmto_wsdl) $("#setting-rmto-wsdl").value = data.rmto_wsdl;
            if (data.rmto_company_code) $("#setting-rmto-company").value = data.rmto_company_code;
            if (data.rmto_username) $("#setting-rmto-user").value = data.rmto_username;
            if (data.rmto_password) $("#setting-rmto-pass").value = data.rmto_password;
        });
    }

    function saveSettings(body, msg) {
        api("POST", "/api/settings", body, function (status) {
            if (status === 200) alert(msg || "ذخیره شد");
            else alert("خطا در ذخیره");
        });
    }

    var saveSettingsBtn = $("#btn-save-settings");
    if (saveSettingsBtn) saveSettingsBtn.addEventListener("click", function () {
        saveSettings({
            system_name: $("#setting-name").value,
            server_ip: $("#setting-server").value,
            server_port: $("#setting-port").value,
            refresh_interval: $("#setting-refresh").value,
            max_speed: $("#setting-max-speed").value
        }, "تنظیمات عمومی ذخیره شد.");
    });

    var saveRmtoBtn = $("#btn-save-rmto");
    if (saveRmtoBtn) saveRmtoBtn.addEventListener("click", function () {
        saveSettings({
            rmto_wsdl: $("#setting-rmto-wsdl").value,
            rmto_company_code: $("#setting-rmto-company").value,
            rmto_username: $("#setting-rmto-user").value,
            rmto_password: $("#setting-rmto-pass").value
        }, "تنظیمات رهسام ذخیره شد.");
    });

    // Change password
    var changePassBtn = $("#btn-change-pass");
    if (changePassBtn) changePassBtn.addEventListener("click", function () {
        var oldP = $("#setting-old-pass").value;
        var newP = $("#setting-new-pass").value;
        if (!oldP || !newP) { alert("لطفا هر دو فیلد را پر کنید"); return; }
        api("POST", "/api/auth/change-password", { old_password: oldP, new_password: newP }, function (status, data) {
            if (status === 200) { alert("رمز عبور تغییر کرد"); $("#setting-old-pass").value = ""; $("#setting-new-pass").value = ""; }
            else alert((data && data.error) || "خطا");
        });
    });

    // Logout
    var logoutBtn = $("#btn-logout");
    if (logoutBtn) logoutBtn.addEventListener("click", function () {
        api("POST", "/api/auth/logout", {}, function () {
            loginOverlay.classList.remove("hidden");
        });
    });

    // Backup download
    var backupDlBtn = $("#btn-backup-download");
    if (backupDlBtn) backupDlBtn.addEventListener("click", function () {
        window.location.href = "/api/backup/download";
    });

    // Backup restore
    var backupRestoreBtn = $("#btn-backup-restore");
    if (backupRestoreBtn) backupRestoreBtn.addEventListener("click", function () {
        var fileInput = $("#backup-file");
        if (!fileInput.files || !fileInput.files[0]) { alert("لطفا فایل پشتیبان را انتخاب کنید"); return; }
        var formData = new FormData();
        formData.append("backup", fileInput.files[0]);
        var statusEl = $("#backup-status");
        statusEl.textContent = "در حال آپلود و پردازش...";
        statusEl.style.color = "#475569";
        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/backup/restore", true);
        xhr.withCredentials = true;
        xhr.onload = function () {
            var r;
            try { r = JSON.parse(xhr.responseText); } catch (e) { r = {}; }
            if (xhr.status === 200) {
                statusEl.textContent = r.message || "بازیابی انجام شد";
                statusEl.style.color = "#22c55e";
            } else {
                statusEl.textContent = r.error || "خطا در بازیابی";
                statusEl.style.color = "#ef4444";
            }
        };
        xhr.onerror = function () { statusEl.textContent = "خطا در ارتباط با سرور"; statusEl.style.color = "#ef4444"; };
        xhr.send(formData);
    });

    // ============================================================
    // Add Modal (shared)
    // ============================================================
    var currentAddMode = "";

    var addSaveBtn = $("#add-modal-save");
    if (addSaveBtn) addSaveBtn.addEventListener("click", function () {
        if (currentAddMode === "device") {
            var dcode = ($("#new-dev-code") || {}).value;
            var dname = ($("#new-dev-name") || {}).value;
            if (!dcode || !/^\d{1,8}$/.test(dcode)) { alert("کد دستگاه باید عددی و حداکثر ۸ رقم باشد"); return; }
            if (!dname || !dname.trim()) { alert("لطفا نام دستگاه را وارد کنید"); return; }
            var dtype = ($("#new-dev-type") || {}).value || "counter";
            var droute = ($("#new-dev-route") || {}).value || "";

            api("POST", "/api/devices", {
                device_code: dcode,
                name: dname.trim(),
                type: dtype,
                route: droute
            }, function (status, data) {
                if (status === 200) {
                    $("#add-modal-overlay").classList.remove("active");
                    loadDevices();
                } else {
                    alert((data && data.error) || "خطا در ثبت دستگاه");
                }
            });
        }
    });

    // ============================================================
    // Modal Close Handlers
    // ============================================================
    ["modal-close", "modal-cancel"].forEach(function (id) {
        var el = $("#" + id);
        if (el) el.addEventListener("click", function () { $("#modal-overlay").classList.remove("active"); });
    });

    ["add-modal-close", "add-modal-cancel"].forEach(function (id) {
        var el = $("#" + id);
        if (el) el.addEventListener("click", function () { $("#add-modal-overlay").classList.remove("active"); });
    });

    ["modal-overlay", "add-modal-overlay"].forEach(function (id) {
        var el = $("#" + id);
        if (el) el.addEventListener("click", function (e) {
            if (e.target === el) el.classList.remove("active");
        });
    });

    // ============================================================
    // Shared: Table Info & Pagination
    // ============================================================
    function renderTableInfo(prefix, start, count, total) {
        var el = $("#" + prefix + "-table-info");
        if (!el) return;
        if (total === 0) {
            el.textContent = "داده‌ای یافت نشد";
        } else {
            el.textContent = "نمایش " + (start + 1) + " تا " + (start + count) + " از " + total + " ردیف";
        }
    }

    function renderPagination(prefix, state, total, renderFn) {
        var container = $("#" + prefix + "-pagination");
        if (!container) return;
        var pages = Math.ceil(total / PAGE_SIZE);
        if (pages <= 1) { container.innerHTML = ""; return; }

        var html = "";
        html += '<button class="page-btn" data-p="prev" ' + (state.page <= 1 ? "disabled" : "") + '>&laquo;</button>';
        var startPage = Math.max(1, state.page - 2);
        var endPage = Math.min(pages, startPage + 4);
        for (var i = startPage; i <= endPage; i++) {
            html += '<button class="page-btn ' + (i === state.page ? "active" : "") + '" data-p="' + i + '">' + i + '</button>';
        }
        html += '<button class="page-btn" data-p="next" ' + (state.page >= pages ? "disabled" : "") + '>&raquo;</button>';
        container.innerHTML = html;

        container.querySelectorAll(".page-btn").forEach(function (btn) {
            btn.addEventListener("click", function () {
                var p = btn.getAttribute("data-p");
                if (p === "prev") state.page = Math.max(1, state.page - 1);
                else if (p === "next") state.page = Math.min(pages, state.page + 1);
                else state.page = parseInt(p, 10);
                renderFn();
            });
        });
    }

    // ============================================================
    // Auto-refresh every 30s
    // ============================================================
    setInterval(function () {
        var activeView = document.querySelector(".view.active");
        if (!activeView) return;
        var id = activeView.id;
        if (id === "view-dashboard") loadDashboard();
        else if (id === "view-reception") loadReception();
    }, 30000);

})();
ENDOFFILE_JS_APP_JS

echo "[+] server/index.js"
cat > "$APP_DIR/server/index.js" << 'ENDOFFILE_SERVER_INDEX_JS'
/**
 * TC Manager Server (Noavaran Jonoob Shargh)
 * - Login authentication
 * - Backup / Restore
 * - Receives data from 100+ devices
 * - Aggregates and sends to RMTO via SOAP
 */
require("dotenv").config();

var express = require("express");
var cors = require("cors");
var path = require("path");
var fs = require("fs");
var crypto = require("crypto");
var session = require("express-session");
var multer = require("multer");
var bcrypt = require("bcryptjs");
var db = require("./db");
var rmto = require("./rmto-client");
var scheduler = require("./scheduler");

var app = express();
var PORT = process.env.PORT || 3000;
var HOST = process.env.HOST || "0.0.0.0";

// --- Session & Auth Setup ---
var SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
var ADMIN_USER = process.env.ADMIN_USER || "admin";
var ADMIN_PASS_HASH = null;

// Initialize admin password
(function initAdmin() {
    // Check if users table exists
    db.exec([
        "CREATE TABLE IF NOT EXISTS users (",
        "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
        "  username TEXT NOT NULL UNIQUE,",
        "  password_hash TEXT NOT NULL,",
        "  role TEXT DEFAULT 'admin',",
        "  created_at TEXT DEFAULT (datetime('now'))",
        ");"
    ].join("\n"));

    var admin = db.prepare("SELECT * FROM users WHERE username = ?").get(ADMIN_USER);
    if (!admin) {
        var defaultPass = process.env.ADMIN_PASS || "admin123";
        var hash = bcrypt.hashSync(defaultPass, 10);
        db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)").run(ADMIN_USER, hash, "admin");
        console.log("[Auth] Default admin user created (user: " + ADMIN_USER + ", pass: " + defaultPass + ")");
    }
})();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Multer for file uploads (backup restore)
var upload = multer({ dest: path.join(__dirname, "uploads/"), limits: { fileSize: 500 * 1024 * 1024 } });

// ============================================================
// Auth Middleware
// ============================================================
function requireAuth(req, res, next) {
    if (req.session && req.session.user) return next();
    return res.status(401).json({ error: "unauthorized" });
}

// ============================================================
// Auth API
// ============================================================
app.post("/api/auth/login", function (req, res) {
    var username = (req.body.username || "").trim();
    var password = req.body.password || "";

    var user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: "نام کاربری یا رمز عبور اشتباه است" });
    }

    req.session.user = { id: user.id, username: user.username, role: user.role };
    res.json({ success: true, username: user.username, role: user.role });
});

app.post("/api/auth/logout", function (req, res) {
    req.session.destroy();
    res.json({ success: true });
});

app.get("/api/auth/check", function (req, res) {
    if (req.session && req.session.user) {
        return res.json({ loggedIn: true, username: req.session.user.username, role: req.session.user.role });
    }
    res.json({ loggedIn: false });
});

app.post("/api/auth/change-password", requireAuth, function (req, res) {
    var oldPass = req.body.old_password || "";
    var newPass = req.body.new_password || "";

    if (newPass.length < 4) return res.status(400).json({ error: "رمز عبور باید حداقل ۴ کاراکتر باشد" });

    var user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.session.user.id);
    if (!bcrypt.compareSync(oldPass, user.password_hash)) {
        return res.status(401).json({ error: "رمز عبور فعلی اشتباه است" });
    }

    var hash = bcrypt.hashSync(newPass, 10);
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, user.id);
    res.json({ success: true });
});

// ============================================================
// Serve Frontend (login page is public, dashboard requires auth)
// ============================================================
app.use(express.static(path.join(__dirname, "..")));

// ============================================================
// Live Log - keeps last 100 incoming requests for monitoring
// ============================================================
var liveLog = [];
var MAX_LOG = 200;

function addLiveLog(entry) {
    liveLog.unshift(entry);
    if (liveLog.length > MAX_LOG) liveLog.length = MAX_LOG;
}

// API to read live log (requires auth)
app.get("/api/live", requireAuth, function (req, res) {
    var since = parseInt(req.query.since, 10) || 0;
    if (since > 0) {
        var filtered = liveLog.filter(function (e) { return e.ts > since; });
        return res.json(filtered);
    }
    var limit = parseInt(req.query.limit, 10) || 50;
    res.json(liveLog.slice(0, limit));
});

// ============================================================
// Device data reception - NO AUTH (devices send data here)
// ============================================================
app.post("/api/data", function (req, res) {
    var b = req.body;
    var code = String(b.device_code || b.device_id || b.code || "");

    addLiveLog({ ts: Date.now(), time: new Date().toISOString(), type: "data", ip: req.ip, device: code, body: b });

    if (!code || !/^\d+$/.test(code)) {
        return res.status(400).json({ error: "device_code required" });
    }

    autoRegisterDevice(code);

    var insert = db.prepare(
        "INSERT INTO traffic_data (device_code, timestamp, vehicle_class, speed, direction, lane, raw_payload) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?)"
    );

    var count = 0;
    if (b.records && Array.isArray(b.records)) {
        var insertMany = db.transaction(function (records) {
            records.forEach(function (r) {
                insert.run(code, r.timestamp || new Date().toISOString(), r.vehicle_class || 0, r.speed || 0, r.direction || 1, r.lane || 1, JSON.stringify(r));
                count++;
            });
        });
        insertMany(b.records);
    } else {
        insert.run(code, b.timestamp || new Date().toISOString(), b.vehicle_class || 0, b.speed || 0, b.direction || 1, b.lane || 1, JSON.stringify(b));
        count = 1;
    }
    res.json({ success: true, received: count });
});

/**
 * POST /api/irawdata - iccore format (5-class vehicle + speed)
 * Body: { device_id, create_at, stop, lane, a,b,c,d,e,x, sa..sx, sao..sxo, overtaking, tooclose }
 * Or batch: { device_id, records: [{...}, ...] }
 * Vehicle: a=motorcycle b=car c=van d=bus e=truck x=unknown
 * Speed: sa..sx = sum of speeds per class
 * Violations: sao..sxo = over-speed count per class
 */
app.post("/api/irawdata", function (req, res) {
    var b = req.body;
    var code = String(b.device_id || b.device_code || b.code || "");

    addLiveLog({ ts: Date.now(), time: new Date().toISOString(), type: "irawdata", ip: req.ip, device: code, a: b.a||0, b: b.b||0, c: b.c||0, d: b.d||0, e: b.e||0, x: b.x||0, lane: b.lane||1 });

    if (!code || !/^\d+$/.test(code)) return res.status(400).json({ error: "device_id required" });

    autoRegisterDevice(code);

    var insertRaw = db.prepare(
        "INSERT INTO irawdata (device_code, create_at, stop, lane, is_read, a,b,c,d,e,x, sa,sb,sc,sd,se,sx, sao,sbo,sco,sdo,seo,sxo, overtaking, tooclose) " +
        "VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    var insertTraffic = db.prepare(
        "INSERT INTO traffic_data (device_code, timestamp, vehicle_class, speed, direction, lane, raw_payload) VALUES (?, ?, ?, ?, 1, ?, ?)"
    );

    var count = 0;
    function insertOne(r) {
        var now = new Date().toISOString();
        var ca = r.create_at || r.start || now;
        var st = r.stop || r.end || now;
        var ln = r.lane || 1;
        insertRaw.run(code, ca, st, ln, r.a||0, r.b||0, r.c||0, r.d||0, r.e||0, r.x||0, r.sa||0, r.sb||0, r.sc||0, r.sd||0, r.se||0, r.sx||0, r.sao||0, r.sbo||0, r.sco||0, r.sdo||0, r.seo||0, r.sxo||0, r.overtaking||0, r.tooclose||0);
        count++;
        // Also store in traffic_data for RMTO aggregation
        var classes = [{cls:1,n:r.a||0,s:r.sa||0},{cls:2,n:r.b||0,s:r.sb||0},{cls:3,n:r.c||0,s:r.sc||0},{cls:4,n:r.d||0,s:r.sd||0},{cls:5,n:r.e||0,s:r.se||0}];
        classes.forEach(function(c){ if(c.n>0) insertTraffic.run(code, ca, c.cls, c.s/c.n, ln, JSON.stringify(r)); });
    }

    if (b.records && Array.isArray(b.records)) {
        db.transaction(function(recs){ recs.forEach(insertOne); })(b.records);
    } else {
        insertOne(b);
    }
    res.json({ success: true, received: count });
});

// Auto-register unknown devices
function autoRegisterDevice(code) {
    var existing = db.prepare("SELECT device_code FROM devices WHERE device_code = ?").get(code);
    if (!existing) {
        try { db.prepare("INSERT INTO devices (device_code, name, type, status) VALUES (?, ?, 'counter', 'online')").run(code, "ترددشمار " + code); } catch(e){}
    }
    db.prepare("UPDATE devices SET status = 'online', last_seen = datetime('now') WHERE device_code = ?").run(code);
}

// Log ALL POST requests to catch unknown device formats
app.post("*", function (req, res, next) {
    if (req.path.indexOf("/api/auth") === -1 && req.path.indexOf("/api/settings") === -1 && req.path.indexOf("/api/backup") === -1) {
        addLiveLog({ ts: Date.now(), time: new Date().toISOString(), type: "unknown", ip: req.ip, path: req.path, body: req.body });
    }
    next();
});

// ============================================================
// All API below requires authentication
// ============================================================
app.use("/api/devices", requireAuth);
app.use("/api/stats", requireAuth);
app.use("/api/rmto", requireAuth);
app.use("/api/traffic", requireAuth);
app.use("/api/backup", requireAuth);
app.use("/api/settings", requireAuth);

// ============================================================
// API: Settings
// ============================================================
app.get("/api/settings", function (req, res) {
    var rows = db.prepare("SELECT key, value FROM settings").all();
    var settings = {};
    rows.forEach(function (r) { settings[r.key] = r.value; });
    res.json(settings);
});

app.post("/api/settings", function (req, res) {
    var upsert = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?");
    var b = req.body;
    var allowed = ["system_name", "server_ip", "server_port", "refresh_interval", "max_speed", "alert_offline", "alert_speed", "alert_error", "offline_timeout", "rmto_company_code", "rmto_username", "rmto_password", "rmto_wsdl"];
    var updated = 0;
    allowed.forEach(function (k) {
        if (b[k] !== undefined) {
            upsert.run(k, String(b[k]), String(b[k]));
            updated++;
        }
    });
    res.json({ success: true, updated: updated });
});

// ============================================================
// API: Device Management
// ============================================================
app.get("/api/devices", function (req, res) {
    res.json(db.prepare("SELECT * FROM devices ORDER BY device_code").all());
});

app.get("/api/devices/:code", function (req, res) {
    var row = db.prepare("SELECT * FROM devices WHERE device_code = ?").get(req.params.code);
    if (!row) return res.status(404).json({ error: "not found" });
    res.json(row);
});

app.post("/api/devices", function (req, res) {
    var b = req.body;
    if (!b.device_code || !b.name) return res.status(400).json({ error: "device_code and name required" });
    if (!/^\d{1,8}$/.test(b.device_code)) return res.status(400).json({ error: "device_code must be 1-8 digits" });
    try {
        db.prepare("INSERT INTO devices (device_code, name, type, route, ip, status, firmware) VALUES (?, ?, ?, ?, ?, ?, ?)").run(b.device_code, b.name, b.type || "sensor", b.route || "", b.ip || "", "offline", b.firmware || "");
        res.json({ success: true, device_code: b.device_code });
    } catch (e) {
        if (e.message.indexOf("UNIQUE") !== -1) return res.status(409).json({ error: "duplicate device_code" });
        res.status(500).json({ error: e.message });
    }
});

app.put("/api/devices/:code", function (req, res) {
    var b = req.body;
    db.prepare("UPDATE devices SET name = COALESCE(?, name), type = COALESCE(?, type), route = COALESCE(?, route), ip = COALESCE(?, ip), firmware = COALESCE(?, firmware) WHERE device_code = ?").run(b.name, b.type, b.route, b.ip, b.firmware, req.params.code);
    res.json({ success: true });
});

app.delete("/api/devices/:code", function (req, res) {
    db.prepare("DELETE FROM devices WHERE device_code = ?").run(req.params.code);
    res.json({ success: true });
});

// ============================================================
// API: Dashboard Stats
// ============================================================
app.get("/api/stats", function (req, res) {
    var totalDevices = db.prepare("SELECT COUNT(*) as c FROM devices").get().c;
    var onlineDevices = db.prepare("SELECT COUNT(*) as c FROM devices WHERE status = 'online'").get().c;
    var todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    var todayVehicles = db.prepare("SELECT COUNT(*) as c FROM traffic_data WHERE timestamp >= ?").get(todayStart.toISOString()).c;
    var todayAvgSpeed = db.prepare("SELECT AVG(speed) as avg FROM traffic_data WHERE timestamp >= ? AND speed > 0").get(todayStart.toISOString()).avg || 0;
    var unsentCount = db.prepare("SELECT COUNT(*) as c FROM rmto_queue WHERE sent = 0").get().c;
    var unsent5Count = db.prepare("SELECT COUNT(*) as c FROM rmto_queue_5class WHERE sent = 0").get().c;
    res.json({ totalDevices: totalDevices, onlineDevices: onlineDevices, todayVehicles: todayVehicles, todayAvgSpeed: Math.round(todayAvgSpeed), unsentRMTO: unsentCount, unsentRMTO5: unsent5Count });
});

// ============================================================
// API: RMTO
// ============================================================
app.get("/api/rmto/logs", function (req, res) {
    var limit = parseInt(req.query.limit, 10) || 50;
    res.json(db.prepare("SELECT * FROM send_log ORDER BY created_at DESC LIMIT ?").all(limit));
});

app.post("/api/rmto/send-now", function (req, res) {
    scheduler.sendUnsentData();
    res.json({ success: true });
});

app.post("/api/rmto/aggregate", function (req, res) {
    scheduler.aggregateAndSend();
    res.json({ success: true });
});

app.get("/api/rmto/queue", function (req, res) {
    var unsent = db.prepare("SELECT device_code, period_start, total_vehicles, avg_speed, created_at FROM rmto_queue WHERE sent = 0 ORDER BY period_start DESC LIMIT 100").all();
    var sent = db.prepare("SELECT device_code, period_start, total_vehicles, avg_speed, sent_at, rmto_response FROM rmto_queue WHERE sent = 1 ORDER BY sent_at DESC LIMIT 50").all();
    res.json({ unsent: unsent, sent: sent });
});

// ============================================================
// API: Traffic Data Query
// ============================================================
app.get("/api/traffic", function (req, res) {
    var code = req.query.device_code || "";
    var from = req.query.from || "";
    var to = req.query.to || "";
    var limit = parseInt(req.query.limit, 10) || 100;
    var sql = "SELECT * FROM traffic_data WHERE 1=1";
    var params = [];
    if (code) { sql += " AND device_code = ?"; params.push(code); }
    if (from) { sql += " AND timestamp >= ?"; params.push(from); }
    if (to) { sql += " AND timestamp <= ?"; params.push(to); }
    sql += " ORDER BY timestamp DESC LIMIT ?";
    params.push(limit);
    var rows = db.prepare(sql).all.apply(db.prepare(sql), params);
    res.json(rows);
});

// ============================================================
// API: irawdata list (Data Reception view)
// ============================================================
app.use("/api/irawdata/list", requireAuth);
app.get("/api/irawdata/list", function (req, res) {
    var limit = parseInt(req.query.limit, 10) || 100;
    var offset = parseInt(req.query.offset, 10) || 0;
    var code = req.query.device_code || "";
    var sql = "SELECT * FROM irawdata WHERE 1=1";
    var countSql = "SELECT COUNT(*) as total FROM irawdata WHERE 1=1";
    var params = [];
    var countParams = [];
    if (code) { sql += " AND device_code = ?"; countSql += " AND device_code = ?"; params.push(code); countParams.push(code); }
    sql += " ORDER BY create_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);
    var rows = db.prepare(sql).all.apply(db.prepare(sql), params);
    var total = db.prepare(countSql).all.apply(db.prepare(countSql), countParams)[0].total;
    res.json({ rows: rows, total: total });
});

// ============================================================
// API: Mehvar (routes from DB)
// ============================================================
app.use("/api/mehvar", requireAuth);
app.get("/api/mehvar", function (req, res) {
    res.json(db.prepare("SELECT * FROM mehvar ORDER BY code").all());
});

app.post("/api/mehvar", function (req, res) {
    var b = req.body;
    if (!b.code || !b.name) return res.status(400).json({ error: "code and name required" });
    try {
        db.prepare("INSERT INTO mehvar (code, name, send_enable, repair, ostan) VALUES (?, ?, ?, ?, ?)").run(parseInt(b.code), b.name, b.send_enable !== undefined ? parseInt(b.send_enable) : 1, b.repair ? parseInt(b.repair) : 0, b.ostan || "");
        res.json({ success: true });
    } catch (e) {
        if (e.message.indexOf("UNIQUE") !== -1) return res.status(409).json({ error: "duplicate code" });
        res.status(500).json({ error: e.message });
    }
});

app.delete("/api/mehvar/:code", function (req, res) {
    db.prepare("DELETE FROM mehvar WHERE code = ?").run(parseInt(req.params.code));
    res.json({ success: true });
});

// ============================================================
// PostgreSQL Dump Importer
// ============================================================
function importPostgresDump(filePath) {
    var zlib = require("zlib");
    var raw;
    if (filePath.endsWith(".gz")) {
        raw = zlib.gunzipSync(fs.readFileSync(filePath)).toString("utf8");
    } else {
        raw = fs.readFileSync(filePath, "utf8");
    }

    var stats = { devices: 0, irawdata: 0, mehvar: 0 };
    var lines = raw.split("\n");
    var copyMode = null;
    var copyColumns = [];

    var insertDevice = db.prepare("INSERT OR IGNORE INTO devices (device_code, name, type, status) VALUES (?, ?, 'counter', 'offline')");
    var insertIraw = db.prepare(
        "INSERT INTO irawdata (device_code, create_at, stop, lane, is_read, a,b,c,d,e,x, sa,sb,sc,sd,se,sx, sao,sbo,sco,sdo,seo,sxo, overtaking, tooclose) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    var insertMehvar = db.prepare("INSERT OR IGNORE INTO mehvar (code, name, send_enable, repair, ostan) VALUES (?, ?, ?, ?, ?)");

    var importTx = db.transaction(function () {
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];

            // Detect COPY ... FROM stdin
            if (line.indexOf("COPY ") === 0 && line.indexOf("FROM stdin") !== -1) {
                var match = line.match(/COPY\s+(\S+)\s*\(([^)]+)\)/);
                if (match) {
                    var tableName = match[1].replace(/^public\./, "");
                    copyColumns = match[2].split(",").map(function (c) { return c.trim(); });
                    if (tableName === "device_device" || tableName === "device_irawdata" || tableName === "device_mehvar") {
                        copyMode = tableName;
                    } else {
                        copyMode = null;
                    }
                }
                continue;
            }

            // End of COPY block
            if (line === "\\." || line === "\\.") {
                copyMode = null;
                copyColumns = [];
                continue;
            }

            if (!copyMode) continue;

            var vals = line.split("\t");
            if (vals.length < 2) continue;

            function colVal(name) {
                var idx = copyColumns.indexOf(name);
                if (idx === -1) return null;
                var v = vals[idx];
                return (v === "\\N" || v === undefined) ? null : v;
            }

            if (copyMode === "device_device") {
                var devCode = colVal("code");
                if (devCode) {
                    insertDevice.run(String(devCode), "Device " + devCode);
                    stats.devices++;
                }
            } else if (copyMode === "device_irawdata") {
                var devId = colVal("device_id");
                var createAt = colVal("create_at") || new Date().toISOString();
                var stop = colVal("stop") || createAt;
                if (devId) {
                    insertIraw.run(String(devId), createAt, stop,
                        parseInt(colVal("lane")) || 1, parseInt(colVal("is_read")) || 0,
                        parseInt(colVal("a")) || 0, parseInt(colVal("b")) || 0, parseInt(colVal("c")) || 0,
                        parseInt(colVal("d")) || 0, parseInt(colVal("e")) || 0, parseInt(colVal("x")) || 0,
                        parseInt(colVal("sa")) || 0, parseInt(colVal("sb")) || 0, parseInt(colVal("sc")) || 0,
                        parseInt(colVal("sd")) || 0, parseInt(colVal("se")) || 0, parseInt(colVal("sx")) || 0,
                        parseInt(colVal("sao")) || 0, parseInt(colVal("sbo")) || 0, parseInt(colVal("sco")) || 0,
                        parseInt(colVal("sdo")) || 0, parseInt(colVal("seo")) || 0, parseInt(colVal("sxo")) || 0,
                        parseInt(colVal("overtaking")) || 0, parseInt(colVal("tooclose")) || 0);
                    stats.irawdata++;
                }
            } else if (copyMode === "device_mehvar") {
                var mCode = colVal("code");
                var mName = colVal("name");
                if (mCode && mName) {
                    insertMehvar.run(parseInt(mCode), mName, parseInt(colVal("send_enable")) || 1, parseInt(colVal("repair")) || 0, colVal("ostan_id") || "");
                    stats.mehvar++;
                }
            }
        }
    });

    importTx();
    console.log("[Backup] Imported from PostgreSQL dump:", JSON.stringify(stats));
    return stats;
}

// ============================================================
// API: Backup & Restore
// ============================================================

// Download backup (copy of SQLite DB file)
app.get("/api/backup/download", function (req, res) {
    var dbPath = path.join(__dirname, "data.db");
    if (!fs.existsSync(dbPath)) return res.status(404).json({ error: "database not found" });

    // Checkpoint WAL before backup
    try { db.pragma("wal_checkpoint(TRUNCATE)"); } catch (e) { /* ok */ }

    var timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    var filename = "tc-manager-backup-" + timestamp + ".db";
    res.download(dbPath, filename);
});

// Restore from uploaded .sql.gz or .db file
app.post("/api/backup/restore", upload.single("backup"), function (req, res) {
    if (!req.file) return res.status(400).json({ error: "فایل بکاپ الزامی است" });

    var tmpPath = req.file.path;
    var origName = req.file.originalname || "";
    var dbPath = path.join(__dirname, "data.db");

    try {
        if (origName.endsWith(".db")) {
            // Direct SQLite DB file - replace
            db.pragma("wal_checkpoint(TRUNCATE)");
            db.close();
            fs.copyFileSync(tmpPath, dbPath);
            // Re-require db (Node caches modules, so we need to clear)
            delete require.cache[require.resolve("./db")];
            res.json({ success: true, message: "بازیابی انجام شد. سرویس باید ریستارت شود." });
        } else if (origName.endsWith(".sql.gz") || origName.endsWith(".gz") || origName.endsWith(".sql")) {
            // PostgreSQL dump - decompress and parse
            var destPath = path.join(__dirname, "uploads", origName);
            fs.renameSync(tmpPath, destPath);
            try {
                var result = importPostgresDump(destPath);
                res.json({ success: true, message: "بازیابی انجام شد. " + result.devices + " دستگاه و " + result.irawdata + " رکورد داده وارد شد.", details: result });
            } catch (parseErr) {
                res.json({ success: true, message: "فایل ذخیره شد ولی پردازش خودکار با خطا مواجه شد: " + parseErr.message, path: destPath });
            }
        } else {
            fs.unlinkSync(tmpPath);
            return res.status(400).json({ error: "فرمت فایل پشتیبانی نمی‌شود. از .db یا .sql.gz استفاده کنید" });
        }
    } catch (e) {
        res.status(500).json({ error: "خطا در بازیابی: " + e.message });
    }
});

// List uploaded backup files
app.get("/api/backup/list", function (req, res) {
    var uploadsDir = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadsDir)) { fs.mkdirSync(uploadsDir, { recursive: true }); return res.json([]); }
    var files = fs.readdirSync(uploadsDir).filter(function (f) {
        return f.endsWith(".db") || f.endsWith(".sql") || f.endsWith(".gz");
    }).map(function (f) {
        var stat = fs.statSync(path.join(uploadsDir, f));
        return { name: f, size: stat.size, date: stat.mtime.toISOString() };
    });
    res.json(files);
});

// ============================================================
// TCP Server for raw device data (port 2022)
// Devices send fixed-length ASCII strings via TCP
// ============================================================
var net = require("net");
var TCP_PORT = parseInt(process.env.TCP_PORT, 10) || 2022;

/**
 * Parse iccore fixed-length raw data from device.
 * Format (based on standard iccore TC protocol):
 *   8 chars: device_code
 *  14 chars: start datetime YYYYMMDDHHmmss
 *  14 chars: stop datetime  YYYYMMDDHHmmss
 *   1 char:  lane
 *   5 chars each: a, b, c, d, e, x     (vehicle counts)     = 30
 *   8 chars each: sa, sb, sc, sd, se, sx (speed sums)        = 48
 *   5 chars each: sao, sbo, sco, sdo, seo, sxo (over-speed)  = 30
 *   5 chars: overtaking
 *   5 chars: tooclose
 * Total minimum: 8+14+14+1+30+48+30+5+5 = 155 chars
 */
function parseIccoreData(raw) {
    raw = raw.replace(/[\r\n\x00]/g, "").trim();
    if (raw.length < 37) return null; // too short - at least device + timestamps + lane

    var pos = 0;
    function take(n) { var s = raw.substring(pos, pos + n); pos += n; return s; }

    var deviceCode = take(8).replace(/^0+/, "") || "0";
    var startStr = take(14);
    var stopStr = take(14);
    var lane = parseInt(take(1), 10) || 1;

    function parseDateTime(s) {
        if (!s || s.length < 14 || s === "00000000000000") return new Date().toISOString();
        var y = s.substring(0, 4), mo = s.substring(4, 6), d = s.substring(6, 8);
        var h = s.substring(8, 10), mi = s.substring(10, 12), se = s.substring(12, 14);
        return y + "-" + mo + "-" + d + "T" + h + ":" + mi + ":" + se;
    }

    var result = {
        device_code: deviceCode,
        create_at: parseDateTime(startStr),
        stop: parseDateTime(stopStr),
        lane: lane,
        a: 0, b: 0, c: 0, d: 0, e: 0, x: 0,
        sa: 0, sb: 0, sc: 0, sd: 0, se: 0, sx: 0,
        sao: 0, sbo: 0, sco: 0, sdo: 0, seo: 0, sxo: 0,
        overtaking: 0, tooclose: 0
    };

    // Parse remaining fields if data is long enough
    if (raw.length >= 67) { // 37 + 30 vehicle counts
        result.a = parseInt(take(5), 10) || 0;
        result.b = parseInt(take(5), 10) || 0;
        result.c = parseInt(take(5), 10) || 0;
        result.d = parseInt(take(5), 10) || 0;
        result.e = parseInt(take(5), 10) || 0;
        result.x = parseInt(take(5), 10) || 0;
    }
    if (raw.length >= 115) { // 67 + 48 speed sums
        result.sa = parseInt(take(8), 10) || 0;
        result.sb = parseInt(take(8), 10) || 0;
        result.sc = parseInt(take(8), 10) || 0;
        result.sd = parseInt(take(8), 10) || 0;
        result.se = parseInt(take(8), 10) || 0;
        result.sx = parseInt(take(8), 10) || 0;
    }
    if (raw.length >= 145) { // 115 + 30 over-speed
        result.sao = parseInt(take(5), 10) || 0;
        result.sbo = parseInt(take(5), 10) || 0;
        result.sco = parseInt(take(5), 10) || 0;
        result.sdo = parseInt(take(5), 10) || 0;
        result.seo = parseInt(take(5), 10) || 0;
        result.sxo = parseInt(take(5), 10) || 0;
    }
    if (raw.length >= 150) result.overtaking = parseInt(take(5), 10) || 0;
    if (raw.length >= 155) result.tooclose = parseInt(take(5), 10) || 0;

    return result;
}

var tcpServer = net.createServer(function (socket) {
    var clientIP = socket.remoteAddress || "";
    var buffer = "";
    console.log("[TCP] Connection from " + clientIP);

    socket.on("data", function (chunk) {
        buffer += chunk.toString();

        // Process complete lines or full messages
        var lines = buffer.split(/[\r\n]+/);
        buffer = lines.pop(); // keep incomplete line in buffer

        lines.forEach(function (line) {
            line = line.trim();
            if (!line) return;
            processRawData(line, clientIP);
        });

        // If buffer is long enough without newline, try to process it
        if (buffer.length >= 37) {
            processRawData(buffer.trim(), clientIP);
            buffer = "";
        }
    });

    socket.on("end", function () {
        if (buffer.trim().length >= 37) {
            processRawData(buffer.trim(), clientIP);
        }
        console.log("[TCP] Disconnected " + clientIP);
    });

    socket.on("error", function (err) {
        console.error("[TCP] Error from " + clientIP + ": " + err.message);
    });
});

function processRawData(raw, ip) {
    console.log("[TCP] Raw data (" + raw.length + " chars): " + raw.substring(0, 80) + (raw.length > 80 ? "..." : ""));

    // Log to live monitor
    var parsed = parseIccoreData(raw);

    if (!parsed || !parsed.device_code) {
        addLiveLog({
            ts: Date.now(), time: new Date().toISOString(), type: "tcp-raw",
            ip: ip, device: "-", detail: "len=" + raw.length + " data=" + raw.substring(0, 60)
        });
        return;
    }

    var total = parsed.a + parsed.b + parsed.c + parsed.d + parsed.e + parsed.x;
    addLiveLog({
        ts: Date.now(), time: new Date().toISOString(), type: "tcp",
        ip: ip, device: parsed.device_code,
        a: parsed.a, b: parsed.b, c: parsed.c, d: parsed.d, e: parsed.e, x: parsed.x,
        total: total, lane: parsed.lane,
        detail: "تردد=" + total + " لاین=" + parsed.lane
    });

    // Auto-register device
    autoRegisterDevice(parsed.device_code);

    // Store in irawdata
    try {
        var insertRaw = db.prepare(
            "INSERT INTO irawdata (device_code, create_at, stop, lane, is_read, a,b,c,d,e,x, sa,sb,sc,sd,se,sx, sao,sbo,sco,sdo,seo,sxo, overtaking, tooclose) " +
            "VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        insertRaw.run(
            parsed.device_code, parsed.create_at, parsed.stop, parsed.lane,
            parsed.a, parsed.b, parsed.c, parsed.d, parsed.e, parsed.x,
            parsed.sa, parsed.sb, parsed.sc, parsed.sd, parsed.se, parsed.sx,
            parsed.sao, parsed.sbo, parsed.sco, parsed.sdo, parsed.seo, parsed.sxo,
            parsed.overtaking, parsed.tooclose
        );
        console.log("[TCP] Stored: device=" + parsed.device_code + " vehicles=" + total);
    } catch (e) {
        console.error("[TCP] DB error: " + e.message);
    }
}

tcpServer.listen(TCP_PORT, "0.0.0.0", function () {
    console.log("[TCP] Listening on port " + TCP_PORT + " for raw device data");
});

tcpServer.on("error", function (err) {
    if (err.code === "EADDRINUSE") {
        console.error("[TCP] Port " + TCP_PORT + " already in use, will retry in 5s");
        setTimeout(function () { tcpServer.listen(TCP_PORT, "0.0.0.0"); }, 5000);
    }
});

// ============================================================
// Start HTTP Server
// ============================================================
app.listen(PORT, HOST, function () {
    console.log("============================================");
    console.log("  TC Manager Server (Noavaran Jonoob Shargh)");
    console.log("  HTTP: http://" + HOST + ":" + PORT);
    console.log("  TCP:  port " + TCP_PORT + " (device data)");
    console.log("  Login: admin / admin123");
    console.log("============================================");

    rmto.initClient(function (err) {
        if (err) console.error("[RMTO] Will retry on first send");
    });

    scheduler.start();
});
ENDOFFILE_SERVER_INDEX_JS

echo "[+] server/db.js"
cat > "$APP_DIR/server/db.js" << 'ENDOFFILE_SERVER_DB_JS'
/**
 * Database module - SQLite via better-sqlite3
 * Stores devices, traffic data, and send logs.
 */
var Database = require("better-sqlite3");
var path = require("path");

var DB_PATH = path.join(__dirname, "data.db");
var db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");

// --- Schema ---
db.exec([
    // Devices: each has a unique 4-digit code
    "CREATE TABLE IF NOT EXISTS devices (",
    "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
    "  device_code TEXT NOT NULL UNIQUE,",
    "  name TEXT NOT NULL,",
    "  type TEXT NOT NULL DEFAULT 'sensor',",
    "  route TEXT,",
    "  ip TEXT,",
    "  status TEXT NOT NULL DEFAULT 'offline',",
    "  last_seen TEXT,",
    "  firmware TEXT,",
    "  created_at TEXT DEFAULT (datetime('now'))",
    ");",

    // Raw traffic data received from devices
    "CREATE TABLE IF NOT EXISTS traffic_data (",
    "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
    "  device_code TEXT NOT NULL,",
    "  timestamp TEXT NOT NULL,",
    "  vehicle_class INTEGER DEFAULT 0,",
    "  speed REAL DEFAULT 0,",
    "  direction INTEGER DEFAULT 1,",
    "  lane INTEGER DEFAULT 1,",
    "  raw_payload TEXT,",
    "  received_at TEXT DEFAULT (datetime('now')),",
    "  FOREIGN KEY (device_code) REFERENCES devices(device_code)",
    ");",

    // Aggregated 15-minute data for RMTO (AddData - simple)
    "CREATE TABLE IF NOT EXISTS rmto_queue (",
    "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
    "  device_code TEXT NOT NULL,",
    "  period_start TEXT NOT NULL,",
    "  period_end TEXT NOT NULL,",
    "  total_vehicles INTEGER DEFAULT 0,",
    "  avg_speed REAL DEFAULT 0,",
    "  sent INTEGER DEFAULT 0,",
    "  sent_at TEXT,",
    "  rmto_response TEXT,",
    "  created_at TEXT DEFAULT (datetime('now'))",
    ");",

    // 5-class data for RMTO (AddData5)
    "CREATE TABLE IF NOT EXISTS rmto_queue_5class (",
    "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
    "  device_code TEXT NOT NULL,",
    "  period_start TEXT NOT NULL,",
    "  period_end TEXT NOT NULL,",
    "  -- Volume classes (5 classes by vehicle size)",
    "  class1_count INTEGER DEFAULT 0,",
    "  class2_count INTEGER DEFAULT 0,",
    "  class3_count INTEGER DEFAULT 0,",
    "  class4_count INTEGER DEFAULT 0,",
    "  class5_count INTEGER DEFAULT 0,",
    "  -- Speed classes (5 classes by speed range)",
    "  speed1_count INTEGER DEFAULT 0,",
    "  speed2_count INTEGER DEFAULT 0,",
    "  speed3_count INTEGER DEFAULT 0,",
    "  speed4_count INTEGER DEFAULT 0,",
    "  speed5_count INTEGER DEFAULT 0,",
    "  -- Violation count",
    "  violations INTEGER DEFAULT 0,",
    "  avg_speed REAL DEFAULT 0,",
    "  sent INTEGER DEFAULT 0,",
    "  sent_at TEXT,",
    "  rmto_response TEXT,",
    "  created_at TEXT DEFAULT (datetime('now'))",
    ");",

    // 8-class data for RMTO (AddData8)
    "CREATE TABLE IF NOT EXISTS rmto_queue_8class (",
    "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
    "  device_code TEXT NOT NULL,",
    "  period_start TEXT NOT NULL,",
    "  period_end TEXT NOT NULL,",
    "  class1_count INTEGER DEFAULT 0,",
    "  class2_count INTEGER DEFAULT 0,",
    "  class3_count INTEGER DEFAULT 0,",
    "  class4_count INTEGER DEFAULT 0,",
    "  class5_count INTEGER DEFAULT 0,",
    "  class6_count INTEGER DEFAULT 0,",
    "  class7_count INTEGER DEFAULT 0,",
    "  class8_count INTEGER DEFAULT 0,",
    "  speed1_count INTEGER DEFAULT 0,",
    "  speed2_count INTEGER DEFAULT 0,",
    "  speed3_count INTEGER DEFAULT 0,",
    "  speed4_count INTEGER DEFAULT 0,",
    "  speed5_count INTEGER DEFAULT 0,",
    "  speed6_count INTEGER DEFAULT 0,",
    "  speed7_count INTEGER DEFAULT 0,",
    "  speed8_count INTEGER DEFAULT 0,",
    "  violations INTEGER DEFAULT 0,",
    "  avg_speed REAL DEFAULT 0,",
    "  sent INTEGER DEFAULT 0,",
    "  sent_at TEXT,",
    "  rmto_response TEXT,",
    "  created_at TEXT DEFAULT (datetime('now'))",
    ");",

    // Send log for auditing
    "CREATE TABLE IF NOT EXISTS send_log (",
    "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
    "  method TEXT NOT NULL,",
    "  device_code TEXT NOT NULL,",
    "  request_data TEXT,",
    "  response_data TEXT,",
    "  success INTEGER DEFAULT 0,",
    "  error_message TEXT,",
    "  created_at TEXT DEFAULT (datetime('now'))",
    ");",

    // Indexes
    "CREATE INDEX IF NOT EXISTS idx_traffic_device ON traffic_data(device_code);",
    "CREATE INDEX IF NOT EXISTS idx_traffic_time ON traffic_data(timestamp);",
    "CREATE INDEX IF NOT EXISTS idx_rmto_unsent ON rmto_queue(sent, device_code);",
    "CREATE INDEX IF NOT EXISTS idx_rmto5_unsent ON rmto_queue_5class(sent, device_code);",
    "CREATE INDEX IF NOT EXISTS idx_rmto8_unsent ON rmto_queue_8class(sent, device_code);",

    // irawdata table - matches iccore device_irawdata format
    "CREATE TABLE IF NOT EXISTS irawdata (",
    "  id INTEGER PRIMARY KEY AUTOINCREMENT,",
    "  device_code TEXT NOT NULL,",
    "  create_at TEXT NOT NULL,",
    "  stop TEXT NOT NULL,",
    "  lane INTEGER DEFAULT 1,",
    "  is_read INTEGER DEFAULT 0,",
    "  a INTEGER DEFAULT 0,",
    "  b INTEGER DEFAULT 0,",
    "  c INTEGER DEFAULT 0,",
    "  d INTEGER DEFAULT 0,",
    "  e INTEGER DEFAULT 0,",
    "  x INTEGER DEFAULT 0,",
    "  sa INTEGER DEFAULT 0,",
    "  sb INTEGER DEFAULT 0,",
    "  sc INTEGER DEFAULT 0,",
    "  sd INTEGER DEFAULT 0,",
    "  se INTEGER DEFAULT 0,",
    "  sx INTEGER DEFAULT 0,",
    "  sao INTEGER DEFAULT 0,",
    "  sbo INTEGER DEFAULT 0,",
    "  sco INTEGER DEFAULT 0,",
    "  sdo INTEGER DEFAULT 0,",
    "  seo INTEGER DEFAULT 0,",
    "  sxo INTEGER DEFAULT 0,",
    "  overtaking INTEGER DEFAULT 0,",
    "  tooclose INTEGER DEFAULT 0,",
    "  received_at TEXT DEFAULT (datetime('now'))",
    ");",

    // Mehvar (routes) table
    "CREATE TABLE IF NOT EXISTS mehvar (",
    "  code INTEGER PRIMARY KEY,",
    "  name TEXT NOT NULL,",
    "  send_enable INTEGER DEFAULT 1,",
    "  repair INTEGER DEFAULT 0,",
    "  ostan TEXT",
    ");",

    "CREATE INDEX IF NOT EXISTS idx_irawdata_device ON irawdata(device_code);",
    "CREATE INDEX IF NOT EXISTS idx_irawdata_time ON irawdata(create_at);",
    "CREATE INDEX IF NOT EXISTS idx_irawdata_read ON irawdata(is_read);",

    // Settings (key-value store)
    "CREATE TABLE IF NOT EXISTS settings (",
    "  key TEXT PRIMARY KEY,",
    "  value TEXT",
    ");"
].join("\n"));

// Insert default settings if not exists
var defaultSettings = {
    system_name: "نوآوران جنوب شرق",
    server_ip: "0.0.0.0",
    server_port: "3000",
    refresh_interval: "30",
    max_speed: "120",
    alert_offline: "1",
    alert_speed: "1",
    alert_error: "1",
    offline_timeout: "5",
    rmto_company_code: "58",
    rmto_username: "",
    rmto_password: "",
    rmto_wsdl: "http://otf.rmto.ir/Companies/Companies.asmx?WSDL"
};
var insertSetting = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
Object.keys(defaultSettings).forEach(function (k) {
    insertSetting.run(k, defaultSettings[k]);
});

module.exports = db;
ENDOFFILE_SERVER_DB_JS

echo "[+] server/rmto-client.js"
cat > "$APP_DIR/server/rmto-client.js" << 'ENDOFFILE_SERVER_RMTO-CLIENT_JS'
/**
 * RMTO SOAP Client
 * Sends traffic data to otf.rmto.ir/Companies/Companies.asmx
 *
 * Methods:
 *   - AddData  (v1.02): Simple total count + avg speed per 15-min period
 *   - AddData5 (v1.01): 5-class volume + 5-class speed + violations
 *   - AddData8 (v1.00): 8-class volume + 8-class speed + violations
 */
var soap = require("soap");

var WSDL_URL = process.env.RMTO_WSDL || "http://otf.rmto.ir/Companies/Companies.asmx?WSDL";
var COMPANY_CODE = process.env.RMTO_COMPANY_CODE || "58";
var USERNAME = process.env.RMTO_USERNAME || "";
var PASSWORD = process.env.RMTO_PASSWORD || "";

var soapClient = null;

/**
 * Initialize SOAP client (called once at startup).
 */
function initClient(callback) {
    if (soapClient) return callback(null, soapClient);

    soap.createClient(WSDL_URL, function (err, client) {
        if (err) {
            console.error("[RMTO] Failed to create SOAP client:", err.message);
            return callback(err);
        }
        soapClient = client;
        console.log("[RMTO] SOAP client initialized");
        console.log("[RMTO] Available methods:", Object.keys(client.describe().CompanySoap || {}));
        callback(null, client);
    });
}

/**
 * AddData (v1.02) - Simple traffic data
 * @param {object} data
 * @param {string} data.deviceCode - 4-digit device code
 * @param {string} data.dateTime   - Period date/time "YYYY/MM/DD HH:mm"
 * @param {number} data.totalCount - Total vehicles in period
 * @param {number} data.avgSpeed   - Average speed in period
 */
function sendAddData(data, callback) {
    ensureClient(function (err) {
        if (err) return callback(err);

        var args = {
            CompanyCode: COMPANY_CODE,
            UserName: USERNAME,
            Password: PASSWORD,
            StationCode: data.deviceCode,
            Direction: data.direction || 0,
            StartDateTime: data.startDateTime,
            StopDateTime: data.stopDateTime,
            Count: data.totalCount,
            Speed: Math.round(data.avgSpeed)
        };

        console.log("[RMTO] AddData request:", JSON.stringify(args));

        soapClient.AddData(args, function (err, result) {
            if (err) {
                console.error("[RMTO] AddData error:", err.message);
                return callback(err, null);
            }
            var response = result && result.AddDataResult;
            console.log("[RMTO] AddData response:", response);
            callback(null, response);
        });
    });
}

/**
 * AddData5 (v1.01) - 5-class traffic data
 * @param {object} data
 * @param {string} data.deviceCode
 * @param {string} data.startDateTime
 * @param {string} data.stopDateTime
 * @param {number} data.direction
 * @param {number} data.class1Count .. data.class5Count  (volume by vehicle class)
 * @param {number} data.speed1Count .. data.speed5Count  (count by speed range)
 * @param {number} data.violations
 * @param {number} data.avgSpeed
 * @param {number} data.o3
 */
function sendAddData5(data, callback) {
    ensureClient(function (err) {
        if (err) return callback(err);

        var args = {
            CompanyCode: COMPANY_CODE,
            UserName: USERNAME,
            Password: PASSWORD,
            StationCode: data.deviceCode,
            Direction: data.direction || 0,
            StartDateTime: data.startDateTime,
            StopDateTime: data.stopDateTime,
            // 5 volume classes
            C1: data.class1Count || 0,
            C2: data.class2Count || 0,
            C3: data.class3Count || 0,
            C4: data.class4Count || 0,
            C5: data.class5Count || 0,
            // 5 speed classes
            S1: data.speed1Count || 0,
            S2: data.speed2Count || 0,
            S3: data.speed3Count || 0,
            S4: data.speed4Count || 0,
            S5: data.speed5Count || 0,
            // Violation & speed
            Violation: data.violations || 0,
            O3: data.o3 || 0,
            Speed: Math.round(data.avgSpeed || 0)
        };

        console.log("[RMTO] AddData5 request:", JSON.stringify(args));

        soapClient.AddData5(args, function (err, result) {
            if (err) {
                console.error("[RMTO] AddData5 error:", err.message);
                return callback(err, null);
            }
            var response = result && result.AddData5Result;
            console.log("[RMTO] AddData5 response:", response);
            callback(null, response);
        });
    });
}

/**
 * AddData8 (v1.00) - 8-class traffic data
 * @param {object} data
 * @param {string} data.deviceCode
 * @param {string} data.startDateTime
 * @param {string} data.stopDateTime
 * @param {number} data.direction
 * @param {number} data.class1Count .. data.class8Count
 * @param {number} data.speed1Count .. data.speed8Count
 * @param {number} data.violations
 * @param {number} data.avgSpeed
 * @param {number} data.o3
 */
function sendAddData8(data, callback) {
    ensureClient(function (err) {
        if (err) return callback(err);

        var args = {
            CompanyCode: COMPANY_CODE,
            UserName: USERNAME,
            Password: PASSWORD,
            StationCode: data.deviceCode,
            Direction: data.direction || 0,
            StartDateTime: data.startDateTime,
            StopDateTime: data.stopDateTime,
            C1: data.class1Count || 0,
            C2: data.class2Count || 0,
            C3: data.class3Count || 0,
            C4: data.class4Count || 0,
            C5: data.class5Count || 0,
            C6: data.class6Count || 0,
            C7: data.class7Count || 0,
            C8: data.class8Count || 0,
            S1: data.speed1Count || 0,
            S2: data.speed2Count || 0,
            S3: data.speed3Count || 0,
            S4: data.speed4Count || 0,
            S5: data.speed5Count || 0,
            S6: data.speed6Count || 0,
            S7: data.speed7Count || 0,
            S8: data.speed8Count || 0,
            Violation: data.violations || 0,
            O3: data.o3 || 0,
            Speed: Math.round(data.avgSpeed || 0)
        };

        console.log("[RMTO] AddData8 request:", JSON.stringify(args));

        soapClient.AddData8(args, function (err, result) {
            if (err) {
                console.error("[RMTO] AddData8 error:", err.message);
                return callback(err, null);
            }
            var response = result && result.AddData8Result;
            console.log("[RMTO] AddData8 response:", response);
            callback(null, response);
        });
    });
}

function ensureClient(callback) {
    if (soapClient) return callback(null);
    initClient(function (err) { callback(err); });
}

module.exports = {
    initClient: initClient,
    sendAddData: sendAddData,
    sendAddData5: sendAddData5,
    sendAddData8: sendAddData8
};
ENDOFFILE_SERVER_RMTO-CLIENT_JS

echo "[+] server/scheduler.js"
cat > "$APP_DIR/server/scheduler.js" << 'ENDOFFILE_SERVER_SCHEDULER_JS'
/**
 * Scheduler - Aggregates traffic data every 15 minutes and sends to RMTO.
 */
var cron = require("node-cron");
var db = require("./db");
var rmto = require("./rmto-client");

var INTERVAL = parseInt(process.env.SEND_INTERVAL_MINUTES, 10) || 15;

/**
 * Aggregate raw traffic_data into rmto_queue and rmto_queue_5class,
 * then send unsent records to RMTO.
 */
function aggregateAndSend() {
    console.log("[Scheduler] Starting aggregation cycle at", new Date().toISOString());

    var now = new Date();
    var periodEnd = new Date(now);
    periodEnd.setMinutes(Math.floor(periodEnd.getMinutes() / INTERVAL) * INTERVAL, 0, 0);
    var periodStart = new Date(periodEnd.getTime() - INTERVAL * 60 * 1000);

    var startStr = periodStart.toISOString();
    var endStr = periodEnd.toISOString();

    // Get all active devices
    var devices = db.prepare("SELECT device_code FROM devices WHERE status != 'offline'").all();

    devices.forEach(function (dev) {
        var code = dev.device_code;

        // Aggregate raw data for this period
        var agg = db.prepare(
            "SELECT COUNT(*) as total, AVG(speed) as avg_speed, " +
            "SUM(CASE WHEN vehicle_class = 1 THEN 1 ELSE 0 END) as c1, " +
            "SUM(CASE WHEN vehicle_class = 2 THEN 1 ELSE 0 END) as c2, " +
            "SUM(CASE WHEN vehicle_class = 3 THEN 1 ELSE 0 END) as c3, " +
            "SUM(CASE WHEN vehicle_class = 4 THEN 1 ELSE 0 END) as c4, " +
            "SUM(CASE WHEN vehicle_class = 5 THEN 1 ELSE 0 END) as c5, " +
            "SUM(CASE WHEN speed < 60 THEN 1 ELSE 0 END) as s1, " +
            "SUM(CASE WHEN speed >= 60 AND speed < 80 THEN 1 ELSE 0 END) as s2, " +
            "SUM(CASE WHEN speed >= 80 AND speed < 100 THEN 1 ELSE 0 END) as s3, " +
            "SUM(CASE WHEN speed >= 100 AND speed < 120 THEN 1 ELSE 0 END) as s4, " +
            "SUM(CASE WHEN speed >= 120 THEN 1 ELSE 0 END) as s5, " +
            "SUM(CASE WHEN speed > 120 THEN 1 ELSE 0 END) as violations " +
            "FROM traffic_data WHERE device_code = ? AND timestamp >= ? AND timestamp < ?"
        ).get(code, startStr, endStr);

        if (!agg || agg.total === 0) return;

        // Insert into simple queue
        db.prepare(
            "INSERT INTO rmto_queue (device_code, period_start, period_end, total_vehicles, avg_speed) " +
            "VALUES (?, ?, ?, ?, ?)"
        ).run(code, startStr, endStr, agg.total, Math.round(agg.avg_speed || 0));

        // Insert into 5-class queue
        db.prepare(
            "INSERT INTO rmto_queue_5class (device_code, period_start, period_end, " +
            "class1_count, class2_count, class3_count, class4_count, class5_count, " +
            "speed1_count, speed2_count, speed3_count, speed4_count, speed5_count, " +
            "violations, avg_speed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).run(code, startStr, endStr,
            agg.c1, agg.c2, agg.c3, agg.c4, agg.c5,
            agg.s1, agg.s2, agg.s3, agg.s4, agg.s5,
            agg.violations, Math.round(agg.avg_speed || 0));
    });

    // Now send unsent records
    sendUnsentData();
}

/**
 * Send all unsent aggregated data to RMTO.
 */
function sendUnsentData() {
    // --- Send simple AddData ---
    var unsent = db.prepare("SELECT * FROM rmto_queue WHERE sent = 0 ORDER BY period_start LIMIT 50").all();

    unsent.forEach(function (row) {
        var startDt = formatDateTime(row.period_start);
        var stopDt = formatDateTime(row.period_end);

        rmto.sendAddData({
            deviceCode: row.device_code,
            startDateTime: startDt,
            stopDateTime: stopDt,
            direction: 0,
            totalCount: row.total_vehicles,
            avgSpeed: row.avg_speed
        }, function (err, response) {
            var success = !err && response;
            db.prepare(
                "UPDATE rmto_queue SET sent = ?, sent_at = datetime('now'), rmto_response = ? WHERE id = ?"
            ).run(success ? 1 : 0, JSON.stringify(response || (err && err.message)), row.id);

            db.prepare(
                "INSERT INTO send_log (method, device_code, request_data, response_data, success, error_message) " +
                "VALUES (?, ?, ?, ?, ?, ?)"
            ).run("AddData", row.device_code, JSON.stringify(row),
                JSON.stringify(response), success ? 1 : 0, err ? err.message : null);
        });
    });

    // --- Send 5-class AddData5 ---
    var unsent5 = db.prepare("SELECT * FROM rmto_queue_5class WHERE sent = 0 ORDER BY period_start LIMIT 50").all();

    unsent5.forEach(function (row) {
        var startDt = formatDateTime(row.period_start);
        var stopDt = formatDateTime(row.period_end);

        rmto.sendAddData5({
            deviceCode: row.device_code,
            startDateTime: startDt,
            stopDateTime: stopDt,
            direction: 0,
            class1Count: row.class1_count,
            class2Count: row.class2_count,
            class3Count: row.class3_count,
            class4Count: row.class4_count,
            class5Count: row.class5_count,
            speed1Count: row.speed1_count,
            speed2Count: row.speed2_count,
            speed3Count: row.speed3_count,
            speed4Count: row.speed4_count,
            speed5Count: row.speed5_count,
            violations: row.violations,
            o3: 0,
            avgSpeed: row.avg_speed
        }, function (err, response) {
            var success = !err && response;
            db.prepare(
                "UPDATE rmto_queue_5class SET sent = ?, sent_at = datetime('now'), rmto_response = ? WHERE id = ?"
            ).run(success ? 1 : 0, JSON.stringify(response || (err && err.message)), row.id);

            db.prepare(
                "INSERT INTO send_log (method, device_code, request_data, response_data, success, error_message) " +
                "VALUES (?, ?, ?, ?, ?, ?)"
            ).run("AddData5", row.device_code, JSON.stringify(row),
                JSON.stringify(response), success ? 1 : 0, err ? err.message : null);
        });
    });
}

/**
 * Format ISO date to RMTO format: "YYYY-MM-DDTHH:mm:ss"
 */
function formatDateTime(isoStr) {
    var d = new Date(isoStr);
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var dy = String(d.getDate()).padStart(2, "0");
    var h = String(d.getHours()).padStart(2, "0");
    var mn = String(d.getMinutes()).padStart(2, "0");
    var sc = String(d.getSeconds()).padStart(2, "0");
    return y + "-" + m + "-" + dy + "T" + h + ":" + mn + ":" + sc;
}

/**
 * Start the scheduler.
 */
function start() {
    // Run every INTERVAL minutes
    var cronExpr = "*/" + INTERVAL + " * * * *";
    console.log("[Scheduler] Starting with cron:", cronExpr);

    cron.schedule(cronExpr, function () {
        aggregateAndSend();
    });

    // Also allow manual retry of unsent data every hour
    cron.schedule("5 * * * *", function () {
        console.log("[Scheduler] Retry unsent data...");
        sendUnsentData();
    });
}

module.exports = {
    start: start,
    aggregateAndSend: aggregateAndSend,
    sendUnsentData: sendUnsentData
};
ENDOFFILE_SERVER_SCHEDULER_JS

echo "[+] server/package.json"
cat > "$APP_DIR/server/package.json" << 'ENDOFFILE_SERVER_PACKAGE_JSON'
{
  "name": "tc-manager-server",
  "version": "1.0.0",
  "description": "TC Manager - Backend server for traffic device data collection and RMTO integration",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "node index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "better-sqlite3": "^9.4.3",
    "soap": "^1.0.0",
    "node-cron": "^3.0.3",
    "dotenv": "^16.4.1",
    "express-session": "^1.17.3",
    "multer": "^1.4.5-lts.1",
    "bcryptjs": "^2.4.3"
  }
}
ENDOFFILE_SERVER_PACKAGE_JSON

echo "[2/7] .env..."
if [ ! -f "$APP_DIR/server/.env" ]; then
cat > "$APP_DIR/server/.env" << 'ENDENV'
PORT=3000
HOST=0.0.0.0
TCP_PORT=2022
ADMIN_USER=admin
ADMIN_PASS=admin123
SESSION_SECRET=
RMTO_WSDL=http://otf.rmto.ir/Companies/Companies.asmx?WSDL
RMTO_COMPANY_CODE=58
RMTO_USERNAME=
RMTO_PASSWORD=
SEND_INTERVAL_MINUTES=15
ENDENV
else
    # Add TCP_PORT if missing
    grep -q TCP_PORT "$APP_DIR/server/.env" || echo "TCP_PORT=2022" >> "$APP_DIR/server/.env"
fi

echo "[3/7] Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi

echo "[4/7] npm install..."
cd "$APP_DIR/server"
npm install --production 2>&1 | tail -3

echo "[5/7] systemd..."
cat > /etc/systemd/system/tc-manager.service << 'ENDSVC'
[Unit]
Description=TC Manager (Noavaran Jonoob Shargh)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/tc-manager/server
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
ENDSVC
systemctl daemon-reload
systemctl enable tc-manager

echo "[6/7] nginx..."
apt-get install -y nginx 2>/dev/null || true
cat > /etc/nginx/sites-available/tc-manager << 'ENDNGINX'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    client_max_body_size 500M;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade ;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host ;
        proxy_set_header X-Real-IP ;
        proxy_set_header X-Forwarded-For ;
        proxy_cache_bypass ;
    }
}
ENDNGINX
ln -sf /etc/nginx/sites-available/tc-manager /etc/nginx/sites-enabled/tc-manager
rm -f /etc/nginx/sites-enabled/default
nginx -t 2>/dev/null && systemctl reload nginx

echo "[7/7] Starting..."
systemctl restart tc-manager
sleep 2

if systemctl is-active --quiet tc-manager; then
    IP=21.0.0.102
    echo ""
    echo "========================================"
    echo "  OK! TC Manager running"
    echo "  Web:  http://"
    echo "  TCP:  port 2022 (device data)"
    echo "  Login: admin / admin123"
    echo "========================================"
else
    echo "  [ERROR] journalctl -u tc-manager -n 50"
fi
